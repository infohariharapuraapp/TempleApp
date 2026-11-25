import {
  getDailyServiceSummary,
} from '../services/volunteerDailyServiceSummary';
import { Request, Response } from 'express';
import { PoolClient } from 'pg';
import { randomUUID } from 'crypto';


import {
  queueVolunteerCertificateIssuedEvents,
  queueVolunteerCertificateRevokedEvent,
} from '../services/volunteerPersonalCompletionEventService';


import { pool } from '../db';

import {
  AuthRequest,
} from '../middleware/authMiddleware';

import {
  generateVolunteerCertificate,
} from '../services/volunteerCertificateService';

// ========================================
// HELPERS
// ========================================

class CertificateError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

function fail(
  status: number,
  message: string
): never {
  throw new CertificateError(
    status,
    message
  );
}

const validId = (value: string) =>
  /^[1-9]\d*$/.test(value) &&
  Number(value) <= 2147483647;

const validNumberId = (
  value: unknown
): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value > 0 &&
  value <= 2147483647;

function optionalText(
  value: unknown,
  maxLength: number
): string | null {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  if (
    typeof value !== 'string' ||
    value.trim().length > maxLength
  ) {
    fail(400, 'Invalid text field');
  }

  return value.trim() || null;
}

function handleError(
  res: Response,
  error: unknown
) {
  if (res.headersSent) {
    console.error('Certificate response failed after headers were sent:');
    if (!res.destroyed) {
      res.destroy(error instanceof Error ? error : new Error('Certificate response failed'));
    }
    return;
  }

  if (
    error instanceof CertificateError
  ) {
    return res.status(
      error.status
    ).json({
      success: false,
      message: error.message,
    });
  }

  if (
    (error as { code?: string })?.code
      === '23505'
  ) {
    return res.status(409).json({
      success: false,
      message:
        'Certificate already exists',
    });
  }

  console.error('Volunteer certificate error:');

  return res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
}

// ========================================
// TRANSACTION HELPER
// ========================================

async function transaction<T>(
  action: (
    client: PoolClient
  ) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
    let discardClient = false;

  try {
    await client.query('BEGIN');

    const result =
      await action(client);

    await client.query('COMMIT');

    return result;
  } catch (error) {
    try {
        await client.query('ROLLBACK');
      } catch {
        discardClient = true;
        console.error('Volunteer transaction rollback failed');
      }

    throw error;
  } finally {
    client.release(discardClient);
  }
}

// ========================================
// UNIQUE CERTIFICATE NUMBER
// ========================================

function generateCertificateNumber() {
  const year =
    new Intl.DateTimeFormat(
      'en-IN',
      {
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
      }
    ).format(new Date());

  const code = randomUUID()
    .replace(/-/g, '')
    .toUpperCase();

  return `DHH-CERT-${year}-${code}`;
}

// ========================================
// LOCK OPPORTUNITY
// ========================================

async function lockOpportunity(
  client: PoolClient,
  opportunityId: string
) {
  const result = await client.query(
    `
    SELECT id
    FROM volunteer_opportunities
    WHERE id = $1
    FOR UPDATE
    `,
    [opportunityId]
  );

  if (!result.rows.length) {
    fail(
      404,
      'Volunteer opportunity not found'
    );
  }
}

// ========================================
// CERTIFICATE SELECT
// ========================================

const CERTIFICATE_SELECT = `
  SELECT
    c.*,

    c.service_start_date::text
      AS service_start_date,

    c.service_end_date::text
      AS service_end_date,

    m.member_code,
    m.is_team_leader,

    r.id AS registration_id,
    r.registration_code,
    r.registration_type,
    r.group_name,

    issuer.full_name
      AS issued_by_name,

    revoker.full_name
      AS revoked_by_name

  FROM volunteer_certificates c

  JOIN volunteer_members m
    ON m.id = c.member_id

  JOIN volunteer_registrations r
    ON r.id = m.registration_id

  LEFT JOIN users issuer
    ON issuer.id = c.issued_by

  LEFT JOIN users revoker
    ON revoker.id = c.revoked_by
`;

// ========================================
// VERIFY COMPLETED SERVICE
// ========================================

async function getServiceSnapshot(
  client: PoolClient,
  opportunityId: string,
  memberId: number
) {
  const memberResult =
    await client.query(
      `
      SELECT
        m.id,
        m.full_name,
        m.status,
        o.title AS programme_name,
        o.attendance_mode,
        r.status AS registration_status

      FROM volunteer_members m

      JOIN volunteer_opportunities o
        ON o.id = m.opportunity_id

      JOIN volunteer_registrations r
        ON r.id = m.registration_id

      WHERE m.id = $1
        AND m.opportunity_id = $2

      FOR UPDATE OF m, r
      `,
      [
        memberId,
        opportunityId,
      ]
    );

  if (!memberResult.rows.length) {
    fail(404, 'Volunteer not found');
  }

  const member =
    memberResult.rows[0];

  if (
    member.status !== 'completed'
  ) {
    fail(
      409,
      'Service completion must be approved first'
    );
  }

  if (
    ![
      'approved',
      'assigned',
      'in_progress',
      'completed',
    ].includes(
      member.registration_status
    )
  ) {
    fail(
      409,
      'Registration is not eligible'
    );
  }

  if (member.attendance_mode !== 'legacy') {
    const summary = await getDailyServiceSummary(
      opportunityId,
      memberId,
      client
    );
    if (!summary) {
      fail(404, 'Volunteer service summary not found');
    }
    if (
      !['simple', 'detailed', 'none']
        .includes(summary.attendance_mode)
    ) {
      fail(409, 'Invalid attendance mode');
    }
    if (
      summary.total_selected_dates === 0 ||
      summary.remaining_dates > 0
    ) {
      fail(409, 'Volunteer service is not fully completed');
    }
    if (summary.attendance_mode !== 'none') {
      if (
        summary.unfinalized_count > 0 ||
        summary.finalized_dates !==
          summary.total_selected_dates ||
        summary.present_count === 0 ||
        !summary.service_start_date ||
        !summary.service_end_date
      ) {
        fail(
          409,
          'Daily attendance is not fully verified'
        );
      }
    }
    return {
      ...member,
      attendance_mode:
        summary.attendance_mode,
      service_start_date:
        summary.service_start_date,
      service_end_date:
        summary.service_end_date,
      total_service_days:
        summary.total_service_days,
      total_service_hours:
        summary.total_service_hours,
    };
  }
  const serviceResult =
    await client.query(
      `
      SELECT

        COUNT(a.id)::integer
          AS total_assignments,

        COUNT(a.id) FILTER (
          WHERE a.status <> 'completed'
        )::integer
          AS incomplete_assignments,

        COUNT(a.id) FILTER (
          WHERE att.is_finalized
            IS DISTINCT FROM TRUE
        )::integer
          AS unfinalized_count,

        COUNT(a.id) FILTER (
          WHERE (
            (s.service_date + s.end_time)
            AT TIME ZONE 'Asia/Kolkata'
          ) > clock_timestamp()
        )::integer
          AS remaining_assignments,

        COUNT(a.id) FILTER (
          WHERE att.attendance_status = 'present'
            AND att.is_finalized = TRUE
        )::integer
          AS present_count,

        COUNT(DISTINCT s.service_date)
          FILTER (
            WHERE att.attendance_status = 'present'
              AND att.is_finalized = TRUE
          )::integer
          AS total_service_days,

        COALESCE(
          ROUND(
            SUM(
              EXTRACT(
                EPOCH FROM
                (s.end_time - s.start_time)
              ) / 3600
            ) FILTER (
              WHERE att.attendance_status = 'present'
                AND att.is_finalized = TRUE
            ),
            2
          ),
          0
        ) AS total_service_hours,

        MIN(s.service_date) FILTER (
          WHERE att.attendance_status = 'present'
            AND att.is_finalized = TRUE
        )::text
          AS service_start_date,

        MAX(s.service_date) FILTER (
          WHERE att.attendance_status = 'present'
            AND att.is_finalized = TRUE
        )::text
          AS service_end_date

      FROM volunteer_assignments a

      JOIN volunteer_shifts s
        ON s.id = a.shift_id

      LEFT JOIN volunteer_attendance att
        ON att.assignment_id = a.id

      WHERE a.member_id = $1
        AND a.opportunity_id = $2

        AND a.status NOT IN (
          'cancelled',
          'reassigned'
        )
      `,
      [
        memberId,
        opportunityId,
      ]
    );

  const service =
    serviceResult.rows[0];

  if (
    Number(service.total_assignments) === 0 ||
    Number(service.incomplete_assignments) > 0 ||
    Number(service.unfinalized_count) > 0 ||
    Number(service.remaining_assignments) > 0 ||
    Number(service.present_count) === 0
  ) {
    fail(
      409,
      'Volunteer service and attendance are not fully verified'
    );
  }

  return {
    ...member,
    ...service,
  };
}

// ========================================
// GET CERTIFICATE WITH LOCK
// ========================================

async function getLockedCertificate(
  client: PoolClient,
  opportunityId: string,
  certificateId: string
) {
  const result = await client.query(
    `
    SELECT *
    FROM volunteer_certificates
    WHERE id = $1
      AND opportunity_id = $2
    FOR UPDATE
    `,
    [
      certificateId,
      opportunityId,
    ]
  );

  if (!result.rows.length) {
    fail(404, 'Certificate not found');
  }

  return result.rows[0];
}

// ========================================
// ADMIN: ELIGIBLE MEMBERS
// ========================================

export const getEligibleCertificateMembers =
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const opportunityId = String(
        req.params.opportunityId
      );

      if (!validId(opportunityId)) {
        fail(400, 'Invalid opportunity ID');
      }

      const result = await pool.query(
        `
        SELECT
          m.id AS member_id,
          m.full_name,
          m.member_code,
          m.is_team_leader,

          r.registration_code,
          r.registration_type,
          r.group_name,

          c.id AS certificate_id,
          c.certificate_number,
          c.status AS certificate_status

        FROM volunteer_members m

        JOIN volunteer_registrations r
          ON r.id = m.registration_id

        LEFT JOIN volunteer_certificates c
          ON c.member_id = m.id

        WHERE m.opportunity_id = $1

          AND m.status = 'completed'

          AND r.status IN (
            'approved',
            'assigned',
            'in_progress',
            'completed'
          )

        ORDER BY m.full_name ASC
        `,
        [opportunityId]
      );

      return res.json({
        success: true,
        data: result.rows.map(row => ({
          ...row,

          can_create:
            !row.certificate_id,
        })),
      });
    } catch (error) {
      return handleError(res, error);
    }
  };

// ========================================
// ADMIN: LIST CERTIFICATES
// ========================================

export const getVolunteerCertificates =
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const opportunityId = String(
        req.params.opportunityId
      );

      if (!validId(opportunityId)) {
        fail(400, 'Invalid opportunity ID');
      }

      const status = req.query.status;
      const search = req.query.search;

      if (
        status !== undefined &&
        (
          typeof status !== 'string' ||
          ![
            'draft',
            'issued',
            'revoked',
          ].includes(status)
        )
      ) {
        fail(400, 'Invalid certificate status');
      }

      if (
        search !== undefined &&
        (
          typeof search !== 'string' ||
          search.length > 150
        )
      ) {
        fail(400, 'Invalid search value');
      }

      const result = await pool.query(
        `
        ${CERTIFICATE_SELECT}

        WHERE c.opportunity_id = $1

          AND (
            $2::text IS NULL
            OR c.status = $2
          )

          AND (
            $3::text IS NULL

            OR c.volunteer_name ILIKE $3

            OR c.certificate_number ILIKE $3

            OR r.group_name ILIKE $3
          )

        ORDER BY
          c.created_at DESC,
          c.id DESC
        `,
        [
          opportunityId,
          status ?? null,

          typeof search === 'string' &&
          search.trim()
            ? `%${search.trim()}%`
            : null,
        ]
      );

      return res.json({
        success: true,
        data: result.rows,
      });
    } catch (error) {
      return handleError(res, error);
    }
  };

// ========================================
// ADMIN: GET SINGLE CERTIFICATE
// ========================================

export const getVolunteerCertificateById =
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const opportunityId = String(
        req.params.opportunityId
      );

      const certificateId = String(
        req.params.certificateId
      );

      if (
        !validId(opportunityId) ||
        !validId(certificateId)
      ) {
        fail(400, 'Invalid ID');
      }

      const result = await pool.query(
        `
        ${CERTIFICATE_SELECT}

        WHERE c.id = $1
          AND c.opportunity_id = $2
        `,
        [
          certificateId,
          opportunityId,
        ]
      );

      if (!result.rows.length) {
        fail(404, 'Certificate not found');
      }

      return res.json({
        success: true,
        data: result.rows[0],
      });
    } catch (error) {
      return handleError(res, error);
    }
  };

// ========================================
// ADMIN: CREATE CERTIFICATE DRAFTS
// ========================================

export const createVolunteerCertificates =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      if (!req.user) {
        fail(401, 'Authentication required');
      }

      const opportunityId = String(
        req.params.opportunityId
      );

      if (!validId(opportunityId)) {
        fail(400, 'Invalid opportunity ID');
      }

      const body = req.body ?? {};

      const memberIds = Array.isArray(
        body.member_ids
      )
        ? body.member_ids
        : [body.member_id];

      if (
        memberIds.length < 1 ||
        memberIds.length > 200 ||
        !memberIds.every(validNumberId) ||
        new Set(memberIds).size !==
          memberIds.length
      ) {
        fail(
          400,
          'Provide between 1 and 200 unique volunteer IDs'
        );
      }

      const title =
        optionalText(
          body.certificate_title,
          80
        ) ||
        'Certificate of Appreciation';

      const message = optionalText(
        body.certificate_message,
        400
      );

      const signatoryName = optionalText(
        body.signatory_name,
        100
      );

      const signatoryDesignation =
        optionalText(
          body.signatory_designation,
          120
        );

      const data = await transaction(
        async client => {
          await lockOpportunity(
            client,
            opportunityId
          );

          const created: any[] = [];

          for (const memberId of memberIds) {
            const snapshot =
              await getServiceSnapshot(
                client,
                opportunityId,
                memberId
              );

            const existing =
              await client.query(
                `
                SELECT id
                FROM volunteer_certificates
                WHERE member_id = $1
                `,
                [memberId]
              );

            if (existing.rows.length) {
              fail(
                409,
                `Certificate already exists for ${snapshot.full_name}`
              );
            }

            const result =
              await client.query(
                `
                INSERT INTO volunteer_certificates (
                  opportunity_id,
                  member_id,
                  certificate_number,
                  volunteer_name,
                  programme_name,
                  certificate_title,
                  certificate_message,
                  service_start_date,
                  service_end_date,
                  total_service_days,
                  total_service_hours,
                  signatory_name,
                  signatory_designation,
                  attendance_mode,
                  status
                )

                VALUES (
                  $1,$2,$3,$4,$5,$6,$7,
                  $8,$9,$10,$11,$12,$13,
                  $14,
                  'draft'
                )

                RETURNING *
                `,
                [
                  opportunityId,
                  memberId,

                  generateCertificateNumber(),

                  snapshot.full_name,
                  snapshot.programme_name,

                  title,
                  message,

                  snapshot.service_start_date,
                  snapshot.service_end_date,

                  snapshot.total_service_days,
                  snapshot.total_service_hours,

                  signatoryName,
                  signatoryDesignation,
                  snapshot.attendance_mode,
                ]
              );

            created.push(result.rows[0]);
          }

          return created;
        }
      );

      return res.status(201).json({
        success: true,

        message:
          `${data.length} certificate draft(s) created`,

        data,
      });
    } catch (error) {
      return handleError(res, error);
    }
  };

// ========================================
// ADMIN: UPDATE CERTIFICATE DRAFT
// ========================================

export const updateVolunteerCertificate =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      if (!req.user) {
        fail(401, 'Authentication required');
      }

      const opportunityId = String(
        req.params.opportunityId
      );

      const certificateId = String(
        req.params.certificateId
      );

      if (
        !validId(opportunityId) ||
        !validId(certificateId)
      ) {
        fail(400, 'Invalid ID');
      }

      const body = req.body ?? {};

      const fieldLimits: Record<
        string,
        number
      > = {
        certificate_title: 80,
        certificate_message: 400,
        signatory_name: 100,
        signatory_designation: 120,
      };

      const fields =
        Object.keys(fieldLimits).filter(
          key => body[key] !== undefined
        );

      if (!fields.length) {
        fail(400, 'No editable fields provided');
      }

      const values = fields.map(key => {
        const value = optionalText(
          body[key],
          fieldLimits[key]
        );

        if (
          key === 'certificate_title' &&
          !value
        ) {
          fail(
            400,
            'Certificate title is required'
          );
        }

        return value;
      });

      const data = await transaction(
        async client => {
          await lockOpportunity(
            client,
            opportunityId
          );

          const certificate =
            await getLockedCertificate(
              client,
              opportunityId,
              certificateId
            );

          if (
            certificate.status !== 'draft'
          ) {
            fail(
              409,
              'Only draft certificates can be edited'
            );
          }

          const setters = fields.map(
            (field, index) =>
              `${field} = $${index + 1}`
          );

          const result =
            await client.query(
              `
              UPDATE volunteer_certificates

              SET
                ${setters.join(', ')},
                updated_at = NOW()

              WHERE id = $${values.length + 1}

                AND opportunity_id =
                  $${values.length + 2}

              RETURNING *
              `,
              [
                ...values,
                certificateId,
                opportunityId,
              ]
            );

          return result.rows[0];
        }
      );

      return res.json({
        success: true,
        message: 'Certificate draft updated',
        data,
      });
    } catch (error) {
      return handleError(res, error);
    }
  };

// ========================================
// ADMIN: PREVIEW CERTIFICATE PDF
// ========================================

export const previewVolunteerCertificate =
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const opportunityId = String(
        req.params.opportunityId
      );

      const certificateId = String(
        req.params.certificateId
      );

      if (
        !validId(opportunityId) ||
        !validId(certificateId)
      ) {
        fail(400, 'Invalid ID');
      }

      const result = await pool.query(
        `
        ${CERTIFICATE_SELECT}

        WHERE c.id = $1
          AND c.opportunity_id = $2
        `,
        [
          certificateId,
          opportunityId,
        ]
      );

      if (!result.rows.length) {
        fail(404, 'Certificate not found');
      }

      generateVolunteerCertificate(
        result.rows[0],
        res,
        true
      );
    } catch (error) {
      return handleError(res, error);
    }
  };

// ========================================
// ADMIN: ISSUE CERTIFICATES
// ========================================

export const issueVolunteerCertificates =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      if (!req.user) {
        fail(401, 'Authentication required');
      }

      const adminId = req.user.userId;

      const opportunityId = String(
        req.params.opportunityId
      );

      if (!validId(opportunityId)) {
        fail(400, 'Invalid opportunity ID');
      }

      const body = req.body ?? {};

      if (body.confirm_issue !== true) {
        fail(
          400,
          'Confirm certificate issuance'
        );
      }

      const certificateIds =
        Array.isArray(body.certificate_ids)
          ? body.certificate_ids
          : [body.certificate_id];

      if (
        certificateIds.length < 1 ||
        certificateIds.length > 200 ||
        !certificateIds.every(validNumberId) ||
        new Set(certificateIds).size !==
          certificateIds.length
      ) {
        fail(
          400,
          'Provide valid unique certificate IDs'
        );
      }

      const data = await transaction(
        async client => {
          await lockOpportunity(
            client,
            opportunityId
          );

          const issued: any[] = [];

          for (
            const certificateId of certificateIds
          ) {
            const certificate =
              await getLockedCertificate(
                client,
                opportunityId,
                String(certificateId)
              );

            if (
              certificate.status !== 'draft'
            ) {
              fail(
                409,
                'Only draft certificates can be issued'
              );
            }

            if (
              !certificate.signatory_name ||
              !certificate.signatory_designation
            ) {
              fail(
                400,
                'Authorized signatory details are required'
              );
            }

            const snapshot =
              await getServiceSnapshot(
                client,
                opportunityId,
                certificate.member_id
              );

            if (
              certificate.attendance_mode !==
              snapshot.attendance_mode
            ) {
              fail(
                409,
                'Certificate attendance mode does not match the programme'
              );
            }
            const downloadPath =
              `/api/volunteer/certificates/${certificateId}/download`;

            const result =
              await client.query(
                `
                UPDATE volunteer_certificates

                SET
                  volunteer_name = $1,
                  programme_name = $2,

                  service_start_date = $3,
                  service_end_date = $4,

                  total_service_days = $5,
                  total_service_hours = $6,

                  certificate_url = $7,

                  status = 'issued',
                  issued_by = $8,
                  issued_at = NOW(),

                  updated_at = NOW()

                WHERE id = $9

                  AND opportunity_id = $10

                RETURNING *
                `,
                [
                  snapshot.full_name,
                  snapshot.programme_name,

                  snapshot.service_start_date,
                  snapshot.service_end_date,

                  snapshot.total_service_days,
                  snapshot.total_service_hours,

                  downloadPath,
                  adminId,

                  certificateId,
                  opportunityId,
                ]
              );

                        issued.push(result.rows[0]);
          }

          // ========================================
          // QUEUE CERTIFICATE ISSUANCE NOTIFICATIONS
          // ========================================

          const notificationSummary =
            await queueVolunteerCertificateIssuedEvents(

              issued.map(

                item => Number(item.id)
              ),

              client
            );

          if (!notificationSummary.eligible) {

            throw new Error(
              'Unable to queue volunteer certificate issuance notifications'
            );
          }

          return issued;
        }
      );

      // The transaction helper has successfully
      // committed before returning data.



      return res.json({
        success: true,

        message:
          `${data.length} certificate(s) issued successfully`,

        data,
      });
    } catch (error) {
      return handleError(res, error);
    }
  };

// ========================================
// ADMIN: REVOKE OR WITHDRAW CERTIFICATE
// ========================================

export const revokeVolunteerCertificate =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      if (!req.user) {
        fail(401, 'Authentication required');
      }

      const adminId = req.user.userId;

      const opportunityId = String(
        req.params.opportunityId
      );

      const certificateId = String(
        req.params.certificateId
      );

      if (
        !validId(opportunityId) ||
        !validId(certificateId)
      ) {
        fail(400, 'Invalid ID');
      }

      const reason = optionalText(
        req.body?.revocation_reason,
        2000
      );

      if (!reason) {
        fail(
          400,
          'Revocation reason is required'
        );
      }

      const data = await transaction(
        async client => {

          // ========================================
          // LOCK OPPORTUNITY
          // ========================================

          await lockOpportunity(
            client,
            opportunityId
          );

          // ========================================
          // LOCK CERTIFICATE
          // ========================================

          const certificate =
            await getLockedCertificate(
              client,
              opportunityId,
              certificateId
            );

          if (
            certificate.status === 'revoked'
          ) {
            fail(
              409,
              'Certificate is already revoked'
            );
          }

          // ========================================
          // CHECK PREVIOUS PUBLICATION STATUS
          // ========================================

          const wasIssued =
            certificate.status === 'issued';

          // ========================================
          // REVOKE CERTIFICATE
          // ========================================

          const result =
            await client.query(
              `
              UPDATE volunteer_certificates

              SET
                status = 'revoked',

                revoked_by = $1,

                revoked_at = clock_timestamp(),

                revocation_reason = $2,

                updated_at = NOW()

              WHERE id = $3
                AND opportunity_id = $4

              RETURNING *
              `,
              [
                adminId,
                reason,
                certificateId,
                opportunityId,
              ]
            );

          // ========================================
          // QUEUE CERTIFICATE REVOCATION EVENT
          // ========================================

          // Notify only when the certificate
          // was previously issued to devotees.
          // Unpublished drafts do not generate
          // revocation notifications.

          if (wasIssued) {

            const notificationSummary =
              await queueVolunteerCertificateRevokedEvent(

                Number(result.rows[0].id),

                client
              );

            if (!notificationSummary.eligible) {

              throw new Error(
                'Unable to queue volunteer certificate revocation notification'
              );
            }
          }

          // The transaction helper commits
          // the certificate update and queue jobs
          // together after this return.

          return result.rows[0];
        }
      );

      return res.json({
        success: true,
        message: 'Certificate revoked',
        data,
      });

    } catch (error) {

      return handleError(res, error);
    }
  };

// ========================================
// DEVOTEE: GET OWN ISSUED CERTIFICATES
// ========================================

export const getMyVolunteerCertificates =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      if (!req.user) {
        fail(401, 'Authentication required');
      }

      res.set(
        'Cache-Control',
        'private, no-store'
      );

      const registrationId =
        req.query.registration_id;

      if (
        registrationId !== undefined &&
        (
          typeof registrationId !== 'string' ||
          !validId(registrationId)
        )
      ) {
        fail(400, 'Invalid registration ID');
      }

      const result = await pool.query(
        `
        SELECT
          c.id,
          c.opportunity_id,
          c.member_id,

          c.certificate_number,
          c.volunteer_name,
          c.programme_name,

          c.certificate_title,
          c.certificate_message,

          c.service_start_date::text
            AS service_start_date,

          c.service_end_date::text
            AS service_end_date,

          c.total_service_days,
          c.total_service_hours,
          c.attendance_mode,

          c.certificate_url,
          c.signatory_name,
          c.signatory_designation,
          c.issued_at,
          c.status,

          r.id AS registration_id,
          r.registration_code,
          r.registration_type,
          r.group_name

        FROM volunteer_certificates c

        JOIN volunteer_members m
          ON m.id = c.member_id

        JOIN volunteer_registrations r
          ON r.id = m.registration_id

        WHERE (
          r.user_id = $1
          OR m.user_id = $1
        )

          AND c.status = 'issued'

          AND m.status = 'completed'

          AND r.status IN (
            'approved',
            'assigned',
            'in_progress',
            'completed'
          )

          AND (
            $2::integer IS NULL
            OR r.id = $2
          )

        ORDER BY c.issued_at DESC
        `,
        [
          req.user.userId,
          registrationId ?? null,
        ]
      );

      return res.json({
        success: true,
        data: result.rows,
      });
    } catch (error) {
      return handleError(res, error);
    }
  };

// ========================================
// DEVOTEE: SECURE CERTIFICATE DOWNLOAD
// ========================================

export const downloadMyVolunteerCertificate =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      if (!req.user) {
        fail(401, 'Authentication required');
      }

      const certificateId = String(
        req.params.certificateId
      );

      if (!validId(certificateId)) {
        fail(400, 'Invalid certificate ID');
      }

      const result = await pool.query(
        `
        ${CERTIFICATE_SELECT}

        WHERE c.id = $1

          AND (
            r.user_id = $2
            OR m.user_id = $2
          )

          AND c.status = 'issued'

          AND m.status = 'completed'

          AND r.status IN (
            'approved',
            'assigned',
            'in_progress',
            'completed'
          )
        `,
        [
          certificateId,
          req.user.userId,
        ]
      );

      if (!result.rows.length) {
        fail(
          404,
          'Certificate not found or unavailable'
        );
      }

      generateVolunteerCertificate(
        result.rows[0],
        res
      );
    } catch (error) {
      return handleError(res, error);
    }
  };
