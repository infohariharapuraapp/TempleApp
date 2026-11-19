import { Request, Response } from 'express';
import { PoolClient } from 'pg';
import { pool } from '../db';
import { AuthRequest } from '../middleware/authMiddleware';


import {
  queueVolunteerServiceCompletedEvents,
} from '../services/volunteerPersonalCompletionEventService';


// ========================================
// HELPERS
// ========================================

class CompletionError extends Error {
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
  throw new CompletionError(status, message);
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

const handleError = (
  res: Response,
  error: unknown
) => {
  if (error instanceof CompletionError) {
    return res.status(error.status).json({
      success: false,
      message: error.message,
    });
  }

  console.error(
    'Volunteer completion error:',
    error
  );

  return res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
};

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
    fail(404, 'Volunteer opportunity not found');
  }
}

// ========================================
// SERVICE SUMMARY QUERY
// ========================================

const SERVICE_SUMMARY_SELECT = `
  SELECT
    m.id AS member_id,
    m.full_name,
    m.member_code,
    m.photo_url,
    m.gender,
    m.is_team_leader,

    m.status AS member_status,

    r.id AS registration_id,
    r.registration_code,
    r.registration_type,
    r.group_name,

    r.status AS registration_status,

    o.id AS opportunity_id,
    o.title AS programme_name,

    COUNT(a.id)::integer
      AS total_assignments,

    COUNT(a.id) FILTER (
      WHERE a.status = 'completed'
    )::integer
      AS completed_assignments,

    COUNT(a.id) FILTER (
      WHERE att.attendance_status = 'present'
      AND att.is_finalized = TRUE
    )::integer
      AS present_count,

    COUNT(a.id) FILTER (
      WHERE att.attendance_status = 'absent'
      AND att.is_finalized = TRUE
    )::integer
      AS absent_count,

    COUNT(a.id) FILTER (
      WHERE att.attendance_status = 'excused'
      AND att.is_finalized = TRUE
    )::integer
      AS excused_count,

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

    COUNT(
      DISTINCT s.service_date
    ) FILTER (
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
      AS service_end_date,

    c.id AS certificate_id,
    c.certificate_number,
    c.status AS certificate_status

  FROM volunteer_members m

  JOIN volunteer_registrations r
    ON r.id = m.registration_id

  JOIN volunteer_opportunities o
    ON o.id = m.opportunity_id

  LEFT JOIN volunteer_assignments a
    ON a.member_id = m.id

    AND a.status NOT IN (
      'cancelled',
      'reassigned'
    )

  LEFT JOIN volunteer_shifts s
    ON s.id = a.shift_id

  LEFT JOIN volunteer_attendance att
    ON att.assignment_id = a.id

  LEFT JOIN volunteer_certificates c
    ON c.member_id = m.id
`;

const SERVICE_SUMMARY_GROUP = `
  GROUP BY
    m.id,
    r.id,
    o.id,
    c.id
`;

// ========================================
// CALCULATE COMPLETION ELIGIBILITY
// ========================================

function calculateEligibility(row: any) {
  const total = Number(
    row.total_assignments
  );

  const present = Number(
    row.present_count
  );

  const reasons: string[] = [];

  if (row.member_status !== 'approved') {
    reasons.push(
      'Volunteer is not in approved status'
    );
  }

  if (
    ![
      'approved',
      'assigned',
      'in_progress',
    ].includes(row.registration_status)
  ) {
    reasons.push(
      'Registration is not eligible'
    );
  }

  if (total === 0) {
    reasons.push(
      'No assigned duties'
    );
  }

  if (
    Number(row.remaining_assignments) > 0
  ) {
    reasons.push(
      'Service shifts are still remaining'
    );
  }

  if (
    Number(row.unfinalized_count) > 0
  ) {
    reasons.push(
      'Attendance is not fully finalized'
    );
  }

  if (
    Number(row.completed_assignments) !== total
  ) {
    reasons.push(
      'Assignment workflow is not fully completed'
    );
  }

  if (present === 0) {
    reasons.push(
      'No finalized present attendance'
    );
  }

  const attendancePercentage =
    total > 0
      ? Number(
          (
            present / total * 100
          ).toFixed(2)
        )
      : 0;

  return {
    ...row,

    total_service_hours:
      Number(row.total_service_hours),

    attendance_percentage:
      attendancePercentage,

    can_complete:
      reasons.length === 0,

    completion_reasons:
      reasons,
  };
}

// ========================================
// GET SINGLE MEMBER SERVICE SUMMARY
// ========================================

async function getMemberSummary(
  client: PoolClient,
  opportunityId: string,
  memberId: number
) {
  const result = await client.query(
    `
    ${SERVICE_SUMMARY_SELECT}

    WHERE m.id = $1

    AND m.opportunity_id = $2

    ${SERVICE_SUMMARY_GROUP}
    `,
    [
      memberId,
      opportunityId,
    ]
  );

  if (!result.rows.length) {
    fail(404, 'Volunteer member not found');
  }

  return calculateEligibility(
    result.rows[0]
  );
}

// ========================================
// ADMIN: GET SERVICE COMPLETION LIST
// ========================================

export const getVolunteerCompletionList =
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

      const search = req.query.search;
      const status = req.query.status;

      if (
        search !== undefined &&
        (
          typeof search !== 'string' ||
          search.length > 150
        )
      ) {
        fail(400, 'Invalid search value');
      }

      const allowedStatuses = [
        'eligible',
        'pending',
        'completed',
      ];

      if (
        status !== undefined &&
        (
          typeof status !== 'string' ||
          !allowedStatuses.includes(status)
        )
      ) {
        fail(400, 'Invalid completion status');
      }

      const result = await pool.query(
        `
        ${SERVICE_SUMMARY_SELECT}

        WHERE m.opportunity_id = $1

        AND m.status IN (
          'approved',
          'completed'
        )

        AND r.status IN (
          'approved',
          'assigned',
          'in_progress',
          'completed'
        )

        AND (
          $2::text IS NULL

          OR m.full_name ILIKE $2

          OR m.member_code ILIKE $2

          OR r.registration_code ILIKE $2

          OR r.group_name ILIKE $2
        )

        ${SERVICE_SUMMARY_GROUP}

        ORDER BY
          m.full_name ASC,
          m.id ASC
        `,
        [
          opportunityId,

          typeof search === 'string' &&
          search.trim()
            ? `%${search.trim()}%`
            : null,
        ]
      );

      const rows = result.rows.map(
        calculateEligibility
      );

      const stats = {
        total: rows.length,

        eligible: rows.filter(
          row => row.can_complete
        ).length,

        completed: rows.filter(
          row =>
            row.member_status === 'completed'
        ).length,

        pending: rows.filter(
          row =>
            !row.can_complete &&
            row.member_status !== 'completed'
        ).length,

        certificates_issued: rows.filter(
          row =>
            row.certificate_status === 'issued'
        ).length,
      };

      const filtered = rows.filter(row => {
        if (status === 'eligible') {
          return row.can_complete;
        }

        if (status === 'completed') {
          return row.member_status === 'completed';
        }

        if (status === 'pending') {
          return (
            !row.can_complete &&
            row.member_status !== 'completed'
          );
        }

        return true;
      });

      return res.json({
        success: true,
        data: filtered,
        stats,
      });
    } catch (error) {
      return handleError(res, error);
    }
  };

// ========================================
// ADMIN: GET MEMBER COMPLETION DETAILS
// ========================================

export const getVolunteerCompletionDetails =
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const opportunityId = String(
        req.params.opportunityId
      );

      const memberId = String(
        req.params.memberId
      );

      if (
        !validId(opportunityId) ||
        !validId(memberId)
      ) {
        fail(400, 'Invalid ID');
      }

      const client = await pool.connect();

      try {
        await client.query(
          'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'
        );

        const summary = await getMemberSummary(
          client,
          opportunityId,
          Number(memberId)
        );

        const assignments = await client.query(
          `
          SELECT
            a.id AS assignment_id,
            a.status AS assignment_status,

            d.name AS duty_name,

            s.service_date::text AS service_date,
            s.shift_name,
            s.start_time,
            s.end_time,

            COALESCE(
              att.attendance_status,
              'not_marked'
            ) AS attendance_status,

            COALESCE(
              att.is_finalized,
              FALSE
            ) AS is_finalized,

            att.check_in_at,
            att.check_out_at,
            att.remarks,

            CASE

              WHEN att.attendance_status = 'present'

              AND att.is_finalized = TRUE

              THEN ROUND(
                EXTRACT(
                  EPOCH FROM
                  (s.end_time - s.start_time)
                ) / 3600,
                2
              )

              ELSE 0

            END AS service_hours

          FROM volunteer_assignments a

          JOIN volunteer_shifts s
            ON s.id = a.shift_id

          JOIN volunteer_requirements req
            ON req.id = a.requirement_id

          JOIN volunteer_duties d
            ON d.id = req.duty_id

          LEFT JOIN volunteer_attendance att
            ON att.assignment_id = a.id

          WHERE a.member_id = $1

          AND a.opportunity_id = $2

          AND a.status NOT IN (
            'cancelled',
            'reassigned'
          )

          ORDER BY
            s.service_date ASC,
            s.start_time ASC
          `,
          [
            memberId,
            opportunityId,
          ]
        );

        await client.query('COMMIT');

        return res.json({
          success: true,

          data: {
            ...summary,

            assignments:
              assignments.rows,
          },
        });
      } catch (error) {
        await client.query('ROLLBACK')
          .catch(console.error);

        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      return handleError(res, error);
    }
  };

// ========================================
// UPDATE PARENT REGISTRATION STATUS
// ========================================

async function refreshRegistrationCompletion(
  client: PoolClient,
  registrationId: number
) {
  const result = await client.query(
    `
    SELECT
      COUNT(*)::integer
        AS total_members,

      COUNT(*) FILTER (
        WHERE status = 'completed'
      )::integer
        AS completed_members,

      COUNT(*) FILTER (
        WHERE status IN (
          'pending',
          'approved'
        )
      )::integer
        AS remaining_members

    FROM volunteer_members

    WHERE registration_id = $1
    `,
    [registrationId]
  );

  const counts = result.rows[0];

  const allMembersResolved =
    counts.total_members > 0 &&
    counts.completed_members > 0 &&
    counts.remaining_members === 0;

  if (allMembersResolved) {
    await client.query(
      `
      UPDATE volunteer_registrations

      SET
        status = 'completed',
        completed_at = NOW(),
        updated_at = NOW()

      WHERE id = $1

      AND status IN (
        'approved',
        'assigned',
        'in_progress'
      )
      `,
      [registrationId]
    );
  }
}

// ========================================
// ADMIN: CONFIRM SINGLE OR BULK COMPLETION
// ========================================

export const completeVolunteerService =
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

      if (
        body.confirm_completion !== true
      ) {
        fail(
          400,
          'Confirm volunteer service completion'
        );
      }

      const memberIds = Array.isArray(
        body.member_ids
      )
        ? body.member_ids
        : [body.member_id];

      if (
        !memberIds.length ||
        memberIds.length > 500 ||
        !memberIds.every(validNumberId) ||
        new Set(memberIds).size !==
          memberIds.length
      ) {
        fail(
          400,
          'Provide between 1 and 500 unique volunteer IDs'
        );
      }

      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        await lockOpportunity(
          client,
          opportunityId
        );

        const completed: any[] = [];

        const registrationIds =
          new Set<number>();

        for (
          const memberId of memberIds
        ) {
          const locked = await client.query(
            `
            SELECT
              m.id,
              m.registration_id,
              m.status

            FROM volunteer_members m

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

          if (!locked.rows.length) {
            fail(
              404,
              'Volunteer member not found'
            );
          }

          const summary =
            await getMemberSummary(
              client,
              opportunityId,
              memberId
            );

          if (summary.member_status === 'completed') {
            fail(
              409,
              `${summary.full_name} is already completed`
            );
          }

          if (!summary.can_complete) {
            fail(
              409,
              `${summary.full_name}: ` +
              summary.completion_reasons.join('; ')
            );
          }

          await client.query(
  `
  UPDATE volunteer_members

  SET
    status = 'completed',

    completed_at = clock_timestamp(),

    updated_at = NOW()

  WHERE id = $1

  AND opportunity_id = $2
  `,
  [
    memberId,
    opportunityId,
  ]
);

          registrationIds.add(
            summary.registration_id
          );

          completed.push({
            member_id:
              summary.member_id,

            full_name:
              summary.full_name,

            registration_id:
              summary.registration_id,

            total_service_days:
              summary.total_service_days,

            total_service_hours:
              summary.total_service_hours,

            attendance_percentage:
              summary.attendance_percentage,

            service_start_date:
              summary.service_start_date,

            service_end_date:
              summary.service_end_date,

            status:
              'completed',
          });
        }

        for (
          const registrationId of registrationIds
        ) {
          await refreshRegistrationCompletion(
            client,
            registrationId
          );
        }

             // ========================================
// QUEUE SERVICE COMPLETION NOTIFICATIONS
// ========================================

const notificationSummary =
  await queueVolunteerServiceCompletedEvents(

    completed.map(

      item => Number(item.member_id)
    ),

    client
  );

if (!notificationSummary.eligible) {

  throw new Error(
    'Unable to queue volunteer service completion notifications'
  );
}

// ========================================
// COMMIT COMPLETION AND NOTIFICATION JOBS
// ========================================

await client.query('COMMIT');
        return res.json({
          success: true,

          message:
            `${completed.length} volunteer(s) marked as completed`,

          data: completed,
        });
      } catch (error) {
        await client.query('ROLLBACK')
          .catch(console.error);

        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      return handleError(res, error);
    }
  };

// ========================================
// ADMIN: REOPEN SERVICE COMPLETION
// ========================================

export const reopenVolunteerCompletion =
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

      const memberId = String(
        req.params.memberId
      );

      if (
        !validId(opportunityId) ||
        !validId(memberId)
      ) {
        fail(400, 'Invalid ID');
      }

      const reason = req.body?.reason;

      if (
        typeof reason !== 'string' ||
        !reason.trim() ||
        reason.trim().length > 2000
      ) {
        fail(
          400,
          'A valid reopening reason is required'
        );
      }

      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        await lockOpportunity(
          client,
          opportunityId
        );

        const result = await client.query(
          `
          SELECT
            m.id,
            m.full_name,
            m.registration_id,
            m.status

          FROM volunteer_members m

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

        if (!result.rows.length) {
          fail(404, 'Volunteer member not found');
        }

        const member = result.rows[0];

        if (member.status !== 'completed') {
          fail(
            409,
            'Only completed service can be reopened'
          );
        }

        const certificate = await client.query(
          `
          SELECT id, status

          FROM volunteer_certificates

          WHERE member_id = $1

          FOR UPDATE
          `,
          [memberId]
        );

        if (
          certificate.rows.some(
            row =>
              row.status === 'issued' ||
              row.status === 'draft'
          )
        ) {
          fail(
            409,
            'Revoke or withdraw the existing certificate before reopening service'
          );
        }

      await client.query(
  `
  UPDATE volunteer_members

  SET
    status = 'approved',

    completed_at = NULL,

    updated_at = NOW()

  WHERE id = $1
  `,
  [memberId]
);

        const correctionNote =
          `[Completion reopened by admin ` +
          `${req.user.userId} at ` +
          `${new Date().toISOString()}] ` +
          `${member.full_name}: ${reason.trim()}`;

        await client.query(
          `
          UPDATE volunteer_registrations r

          SET
            status = CASE

              WHEN EXISTS (
                SELECT 1

                FROM volunteer_assignments a

                JOIN volunteer_members m
                  ON m.id = a.member_id

                WHERE m.registration_id = r.id

                AND a.status = 'in_progress'

              ) THEN 'in_progress'

              WHEN EXISTS (
                SELECT 1

                FROM volunteer_assignments a

                JOIN volunteer_members m
                  ON m.id = a.member_id

                WHERE m.registration_id = r.id

                AND a.status IN (
                  'assigned',
                  'completed'
                )

              ) THEN 'assigned'

              ELSE 'approved'

            END,

            completed_at = NULL,

            admin_remarks = CONCAT_WS(
              E'\\n',
              NULLIF(admin_remarks, ''),
              $1::text
            ),

            updated_at = NOW()

          WHERE r.id = $2
          `,
          [
            correctionNote,
            member.registration_id,
          ]
        );

        await client.query('COMMIT');

        return res.json({
          success: true,

          message:
            'Volunteer service reopened successfully',

          data: {
            member_id: member.id,
            status: 'approved',
          },
        });
      } catch (error) {
        await client.query('ROLLBACK')
          .catch(console.error);

        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      return handleError(res, error);
    }
  };
