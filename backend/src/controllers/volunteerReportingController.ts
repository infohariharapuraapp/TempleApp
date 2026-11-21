import { Request, Response } from 'express';
import { PoolClient } from 'pg';

import { pool } from '../db';

import {
  isValidServiceDate,
} from '../services/volunteerServiceDateService';

import {
  queueVolunteerReportingEvent,
} from '../services/volunteerReportingNotificationService';

import {
  queueVolunteerPersonalDutyEvent,
} from '../services/volunteerPersonalDutyEventService';type AuthenticatedRequest = Request & {
  user?: {
    userId?: number;
  };
};

class ReportingError extends Error {

  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

function parseId(value: unknown): number {

  const text = String(value);

  if (
    !/^[1-9]\d*$/.test(text) ||
    Number(text) > 2147483647
  ) {
    throw new ReportingError(
      400,
      'Invalid ID'
    );
  }

  return Number(text);
}

function getUserId(
  req: AuthenticatedRequest
): number {

  if (!req.user?.userId) {
    throw new ReportingError(
      401,
      'Authentication required'
    );
  }

  return parseId(req.user.userId);
}

function parseDate(value: unknown): string {

  if (!isValidServiceDate(value)) {
    throw new ReportingError(
      400,
      'Invalid service date'
    );
  }

  return value;
}

function requiredText(
  value: unknown,
  label: string,
  max: number
): string {

  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.trim().length > max
  ) {
    throw new ReportingError(
      400,
      `Invalid ${label}`
    );
  }

  return value.trim();
}

function parseTime(value: unknown): string {

  if (
    typeof value !== 'string' ||
    !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value)
  ) {
    throw new ReportingError(
      400,
      'Invalid reporting time'
    );
  }

  return value.length === 5
    ? `${value}:00`
    : value;
}

function parsePhone(value: unknown): string {

  if (typeof value !== 'string') {
    throw new ReportingError(
      400,
      'Invalid coordinator phone number'
    );
  }

  let phone = value
    .trim()
    .replace(/[\s()-]/g, '');

  // Indian mobile numbers.

  if (/^[6-9]\d{9}$/.test(phone)) {
    phone = '+91' + phone;
  }

  if (/^91[6-9]\d{9}$/.test(phone)) {
    phone = '+' + phone;
  }

  if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
    throw new ReportingError(
      400,
      'Enter a valid phone number with country code'
    );
  }

  return phone;
}

function parseDetails(body: any) {

  const instructions =
    body.special_instructions == null ||
    body.special_instructions === ''

      ? null

      : requiredText(
          body.special_instructions,
          'special instructions',
          5000
        );

  return {
    time: parseTime(body.reporting_time),

    location: requiredText(
      body.reporting_location,
      'reporting location',
      1000
    ),

    coordinator: requiredText(
      body.coordinator_name,
      'coordinator name',
      255
    ),

    phone: parsePhone(
      body.coordinator_phone
    ),

    instructions,
  };
}

function handleError(
  res: Response,
  error: unknown
) {

  if (error instanceof ReportingError) {

    return res.status(error.status).json({
      success: false,
      message: error.message,
    });
  }

  console.error(
    'Volunteer reporting error:',
    error
  );

  return res.status(500).json({
    success: false,
    message: 'Unable to process reporting request',
  });
}

async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {

  const client = await pool.connect();

  try {

    await client.query('BEGIN');

    const result = await callback(client);

    await client.query('COMMIT');

    return result;

  } catch (error) {

    await client.query('ROLLBACK')
      .catch(console.error);

    throw error;

  } finally {

    client.release();
  }
}

// ========================================
// ADMIN: DATE-WISE AVAILABLE VOLUNTEERS
// ========================================

export async function getDailyReporting(
  req: Request,
  res: Response
) {

  try {

    const opportunityId =
      parseId(req.params.opportunityId);

    const date =
      parseDate(req.query.service_date);

    const opportunity = await pool.query(
      `
      SELECT id
      FROM volunteer_opportunities
      WHERE id = $1
        AND $2::date BETWEEN
          service_start_date
          AND service_end_date
      `,
      [opportunityId, date]
    );

    if (!opportunity.rows.length) {

      throw new ReportingError(
        404,
        'Opportunity or service date not found'
      );
    }

    const result = await pool.query(
      `
      SELECT
        sd.id AS service_date_id,

        sd.status AS service_date_status,

        sd.closure_reason,

        sd.service_date::text
          AS service_date,

        m.id AS member_id,
        m.member_code,
        m.full_name,
        m.mobile,
        m.is_team_leader,

        r.id AS registration_id,
        r.registration_code,
        r.registration_type,
        r.group_name,

        vr.id AS reporting_id,

        COALESCE(
          vr.status,
          'not_sent'
        ) AS reporting_status,

        vr.reporting_time::text
          AS reporting_time,

        vr.reporting_location,
        vr.coordinator_name,
        vr.coordinator_phone,
        vr.special_instructions,
        vr.responded_at,
        vr.sent_at,
        vr.revision,

        COALESCE(
          da.attendance_status,
          'not_marked'
        ) AS attendance_status,

        COALESCE(
          da.is_finalized,
          FALSE
        ) AS attendance_finalized

      FROM volunteer_service_dates sd

      JOIN volunteer_members m
        ON m.id = sd.member_id
        AND m.opportunity_id =
          sd.opportunity_id

      JOIN volunteer_registrations r
        ON r.id = m.registration_id
        AND r.opportunity_id =
          sd.opportunity_id

      LEFT JOIN volunteer_reporting vr
        ON vr.service_date_id = sd.id

      LEFT JOIN volunteer_daily_attendance da
        ON da.service_date_id = sd.id

      WHERE sd.opportunity_id = $1

        AND sd.service_date = $2::date

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

      ORDER BY
        r.id,
        m.is_team_leader DESC,
        m.full_name,
        m.id
      `,
      [opportunityId, date]
    );

    const rows = result.rows;

    return res.json({

      success: true,

      data: {

        opportunity_id: opportunityId,

        service_date: date,

        stats: {

          total_volunteers: rows.length,

          not_sent: rows.filter(
            row =>
              row.reporting_status ===
                'not_sent'
          ).length,

          awaiting_confirmation: rows.filter(
            row =>
              row.reporting_status ===
                'awaiting_response'
          ).length,

          confirmed: rows.filter(
            row =>
              row.reporting_status ===
                'confirmed'
          ).length,

          cancelled: rows.filter(
            row =>
              row.reporting_status ===
                'cancelled'
          ).length,
        },

        volunteers: rows,
      },
    });

  } catch (error) {

    return handleError(res, error);
  }
}

// ========================================
// ADMIN: SEND INDIVIDUAL OR BULK REPORTING
// ========================================

export async function sendDailyReporting(
  req: AuthenticatedRequest,
  res: Response
) {

  try {

    const adminId = getUserId(req);

    const opportunityId =
      parseId(req.params.opportunityId);

    const body = req.body ?? {};

    const date =
      parseDate(body.service_date);

    const details = parseDetails(body);

    if (
      !Array.isArray(body.service_date_ids) ||
      body.service_date_ids.length === 0 ||
      body.service_date_ids.length > 500
    ) {

      throw new ReportingError(
        400,
        'Select between 1 and 500 volunteers'
      );
    }

    const ids = [
      ...new Set<number>(
        body.service_date_ids.map(
          (value: unknown) => parseId(value)
        )
      ),
    ].sort((a, b) => a - b);

    const result = await transaction(
      async client => {

        const eligible = await client.query(
          `
          SELECT sd.id

          FROM volunteer_service_dates sd

          JOIN volunteer_members m
            ON m.id = sd.member_id
            AND m.opportunity_id =
              sd.opportunity_id

          JOIN volunteer_registrations r
            ON r.id = m.registration_id
            AND r.opportunity_id =
              sd.opportunity_id

          JOIN volunteer_opportunities o
            ON o.id = sd.opportunity_id

          WHERE sd.id = ANY($1::integer[])

            AND sd.status = 'active'

            AND sd.opportunity_id = $2

            AND sd.service_date = $3::date

            AND sd.service_date BETWEEN
              o.service_start_date
              AND o.service_end_date

            AND o.is_published = TRUE

            AND m.status = 'approved'

            AND r.status IN (
              'approved',
              'assigned',
              'in_progress'
            )

            AND (
              ($3::date + $4::time)
              AT TIME ZONE 'Asia/Kolkata'
            ) > clock_timestamp()

          ORDER BY sd.id

          FOR UPDATE OF sd, m, r
          `,
          [
            ids,
            opportunityId,
            date,
            details.time,
          ]
        );

        if (eligible.rows.length !== ids.length) {

          throw new ReportingError(
            409,
            'Some volunteers are no longer eligible or reporting time has passed. Refresh the list.'
          );
        }

        const inserted = await client.query(
          `
          INSERT INTO volunteer_reporting (
            service_date_id,
            reporting_time,
            reporting_location,
            coordinator_name,
            coordinator_phone,
            special_instructions,
            status,
            sent_by,
            updated_by
          )

          SELECT
            selected.id,
            $2::time,
            $3,
            $4,
            $5,
            $6,
            'awaiting_response',
            $7,
            $7

          FROM UNNEST($1::integer[])
            AS selected(id)

          WHERE NOT EXISTS (

            SELECT 1

            FROM volunteer_daily_attendance da

            WHERE da.service_date_id =
              selected.id

              AND (
                da.is_finalized = TRUE
                OR da.attendance_status <>
                  'not_marked'
              )
          )

          ON CONFLICT (service_date_id)
          DO NOTHING

          RETURNING id, service_date_id
          `,
          [
            ids,
            details.time,
            details.location,
            details.coordinator,
            details.phone,
            details.instructions,
            adminId,
          ]
        );

        let queued = 0;

        for (const row of inserted.rows) {

          const notification =
            await queueVolunteerReportingEvent(
              Number(row.id),
              'reporting_sent',
              client
            );

          queued += notification.created;
        }

        return {

          selected: ids.length,

          reporting_created:
            inserted.rows.length,

          skipped:
            ids.length - inserted.rows.length,

          notifications_queued: queued,
        };
      }
    );

    return res.status(201).json({

      success: true,

      message: 'Reporting allocation processed',

      data: result,
    });

  } catch (error) {

    return handleError(res, error);
  }
}

// ========================================
// ADMIN: UPDATE OR CANCEL REPORTING
// ========================================

export async function updateDailyReporting(
  req: AuthenticatedRequest,
  res: Response
) {

  try {

    const adminId = getUserId(req);

    const reportingId =
      parseId(req.params.reportingId);

    const body = req.body ?? {};

    const expectedRevision =
      parseId(body.revision);

    const action = body.action;

    if (
      action !== 'update' &&
      action !== 'cancel'
    ) {

      throw new ReportingError(
        400,
        'Invalid reporting action'
      );
    }

    const details = action === 'update'
      ? parseDetails(body)
      : null;

    const result = await transaction(
      async client => {

        const existing = await client.query(
          `
          SELECT
            vr.id,
            vr.status,
            vr.revision,
            vr.service_date_id,
            vr.reporting_time::text AS current_reporting_time,
            vr.reporting_location AS current_reporting_location,
            vr.coordinator_name AS current_coordinator_name,
            vr.coordinator_phone AS current_coordinator_phone,
            vr.special_instructions AS current_special_instructions,

            sd.service_date::text
              AS service_date

          FROM volunteer_reporting vr

          JOIN volunteer_service_dates sd
            ON sd.id = vr.service_date_id

          JOIN volunteer_members m
            ON m.id = sd.member_id
            AND m.opportunity_id =
              sd.opportunity_id

          JOIN volunteer_registrations r
            ON r.id = m.registration_id
            AND r.opportunity_id =
              sd.opportunity_id

          WHERE vr.id = $1

            AND sd.status = 'active'

            AND m.status = 'approved'

            AND r.status IN (
              'approved',
              'assigned',
              'in_progress'
            )

          FOR UPDATE OF sd, m, r, vr
          `,
          [reportingId]
        );

        if (!existing.rows.length) {

          throw new ReportingError(
            404,
            'Eligible reporting record not found'
          );
        }

        const current = existing.rows[0];

        if (
          Number(current.revision) !==
            expectedRevision
        ) {

          throw new ReportingError(
            409,
            'Reporting details changed. Refresh and try again.'
          );
        }

        if (
          ![
            'awaiting_response',
            'confirmed',
            'coordinator_contacted',
            'cancelled',
          ].includes(current.status)
        ) {

          throw new ReportingError(
            409,
            'Reporting cannot be modified'
          );
        }

        const attendance = await client.query(
          `
          SELECT id

          FROM volunteer_daily_attendance

          WHERE service_date_id = $1
            AND (
              is_finalized = TRUE
              OR attendance_status <>
                'not_marked'
            )
          `,
          [current.service_date_id]
        );

        if (attendance.rows.length) {

          throw new ReportingError(
            409,
            'Attendance has already been recorded'
          );
        }

        if (action === 'update' && details) {
          const unchanged =
            String(current.current_reporting_time ?? '').slice(0, 5) === details.time.slice(0, 5) &&
            current.current_reporting_location === details.location &&
            current.current_coordinator_name === details.coordinator &&
            current.current_coordinator_phone === details.phone &&
            (current.current_special_instructions ?? null) === details.instructions;
          if (unchanged) {
            return {
              unchanged: true,
              notifications_queued: 0,
            };
          }
        }
        if (
          action === 'cancel' &&
          current.status === 'cancelled'
        ) {

          return {
            unchanged: true,
            notifications_queued: 0,
          };
        }

        let updated;

        if (action === 'cancel') {

          updated = await client.query(
            `
            UPDATE volunteer_reporting

            SET
              status = 'cancelled',
              revision = revision + 1,
              updated_at = NOW(),
              updated_by = $2

            WHERE id = $1

              AND (
                (
                  $3::date + reporting_time
                ) AT TIME ZONE 'Asia/Kolkata'
              ) > clock_timestamp()

            RETURNING *
            `,
            [
              reportingId,
              adminId,
              current.service_date,
            ]
          );

        } else {

          updated = await client.query(
            `
            UPDATE volunteer_reporting

            SET
              reporting_time = $2::time,
              reporting_location = $3,
              coordinator_name = $4,
              coordinator_phone = $5,
              special_instructions = $6,

              status = 'awaiting_response',

              responded_at = NULL,
              response_deadline = NULL,

              revision = revision + 1,

              updated_by = $7,
              updated_at = NOW()

            WHERE id = $1

              AND (
                ($8::date + $2::time)
                AT TIME ZONE 'Asia/Kolkata'
              ) > clock_timestamp()

              AND $8::date >= (
                clock_timestamp()
                AT TIME ZONE 'Asia/Kolkata'
              )::date

            RETURNING *
            `,
            [
              reportingId,
              details!.time,
              details!.location,
              details!.coordinator,
              details!.phone,
              details!.instructions,
              adminId,
              current.service_date,
            ]
          );
        }

        if (!updated.rows.length) {

          throw new ReportingError(
            409,
            'Reporting time has passed or is invalid'
          );
        }

        const notification =
          await queueVolunteerReportingEvent(
            reportingId,

            action === 'cancel'
              ? 'reporting_cancelled'
              : 'reporting_updated',

            client
          );

        return {

          reporting: updated.rows[0],

          notifications_queued:
            notification.created,
        };
      }
    );

    return res.json({

      success: true,

      message: 'Reporting updated',

      data: result,
    });

  } catch (error) {

    return handleError(res, error);
  }
}

// ========================================
// DEVOTEE: VIEW MY REPORTING DETAILS
// ========================================

export async function getMyReporting(
  req: AuthenticatedRequest,
  res: Response
) {

  res.set(
    'Cache-Control',
    'private, no-store'
  );

  try {

    const userId = getUserId(req);

    const registrationId =
      parseId(req.params.registrationId);

    // Verify registration ownership or linked membership
    // independently of reporting availability.
    const access = await pool.query(
      `
      SELECT r.id
      FROM volunteer_registrations r
      WHERE r.id = $1
        AND (
          r.user_id = $2
          OR EXISTS (
            SELECT 1
            FROM volunteer_members m
            WHERE m.registration_id = r.id
              AND m.user_id = $2
          )
        )
      LIMIT 1
      `,
      [registrationId, userId]
    );
    if (!access.rows.length) {
      throw new ReportingError(
        404,
        'Seva registration not found'
      );
    }

    const result = await pool.query(
      `
      SELECT
        sd.id AS service_date_id,

        sd.status AS service_date_status,

        sd.closure_reason,

        sd.service_date::text
          AS service_date,

        m.id AS member_id,
        m.full_name,
        m.member_code,

        vr.id AS reporting_id,

        COALESCE(
          vr.status,
          'not_sent'
        ) AS reporting_status,

        vr.reporting_time::text
          AS reporting_time,

        vr.reporting_location,
        vr.coordinator_name,
        vr.coordinator_phone,
        vr.special_instructions,
        vr.revision,
        vr.responded_at,
        COALESCE(
          da.attendance_status,
          'not_marked'
        ) AS attendance_status,
        COALESCE(
          da.is_finalized,
          FALSE
        ) AS attendance_finalized,

        COALESCE(

          vr.status IN (
            'awaiting_response',
            'confirmed'
          )

          AND sd.status = 'active'

          AND m.status = 'approved'

          AND r.status IN (
            'approved',
            'assigned',
            'in_progress'
          )

          AND (
            (
              sd.service_date +
              vr.reporting_time
            ) AT TIME ZONE 'Asia/Kolkata'
          ) > clock_timestamp(),

          FALSE

        ) AS can_confirm

      FROM volunteer_service_dates sd

      JOIN volunteer_members m
        ON m.id = sd.member_id
        AND m.opportunity_id =
          sd.opportunity_id

      JOIN volunteer_registrations r
        ON r.id = m.registration_id
        AND r.opportunity_id =
          sd.opportunity_id

      LEFT JOIN volunteer_reporting vr
        ON vr.service_date_id = sd.id       LEFT JOIN volunteer_daily_attendance da
         ON da.service_date_id = sd.id

      WHERE r.id = $1

        AND (
          r.user_id = $2
          OR m.user_id = $2
        )

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

      ORDER BY
        sd.service_date,
        m.is_team_leader DESC,
        m.id
      `,
      [
        registrationId,
        userId,
      ]
    );

    return res.json({

      success: true,

      data: result.rows,
    });

  } catch (error) {

    return handleError(res, error);
  }
}

// ========================================
// DEVOTEE: CONFIRM AVAILABILITY
// ========================================

export async function confirmMyReporting(
  req: AuthenticatedRequest,
  res: Response
) {

  res.set(
    'Cache-Control',
    'private, no-store'
  );

  try {

    const userId = getUserId(req);

    const reportingId =
      parseId(req.params.reportingId);

    const revision =
      parseId(req.body?.revision);

    const result = await transaction(
      async client => {

        const current = await client.query(
          `
          SELECT
            vr.id,
            vr.revision,
            vr.status,

            (
              (
                sd.service_date +
                vr.reporting_time
              ) AT TIME ZONE 'Asia/Kolkata'
            ) > clock_timestamp()
              AS is_upcoming

          FROM volunteer_reporting vr

          JOIN volunteer_service_dates sd
            ON sd.id = vr.service_date_id

          JOIN volunteer_members m
            ON m.id = sd.member_id
            AND m.opportunity_id =
              sd.opportunity_id

          JOIN volunteer_registrations r
            ON r.id = m.registration_id
            AND r.opportunity_id =
              sd.opportunity_id

          WHERE vr.id = $1

            AND sd.status = 'active'

            AND (
              r.user_id = $2
              OR m.user_id = $2
            )

            AND m.status = 'approved'

            AND r.status IN (
              'approved',
              'assigned',
              'in_progress'
            )

          FOR UPDATE OF sd, m, r, vr
          `,
          [
            reportingId,
            userId,
          ]
        );

        if (!current.rows.length) {

          throw new ReportingError(
            404,
            'Reporting record not found'
          );
        }

        const row = current.rows[0];

        if (
          Number(row.revision) !== revision
        ) {

          throw new ReportingError(
            409,
            'Reporting details have changed. Refresh before confirming.'
          );
        }

        if (row.status === 'confirmed') {

          return {
            reporting_id: reportingId,
            status: 'confirmed',
            unchanged: true,
          };
        }

        if (
          row.status !== 'awaiting_response' ||
          !row.is_upcoming
        ) {

          throw new ReportingError(
            409,
            'Reporting is no longer available for confirmation'
          );
        }

        const updated = await client.query(
          `
          UPDATE volunteer_reporting

          SET
            status = 'confirmed',
            responded_at = NOW(),
            updated_at = NOW()

          WHERE id = $1

          RETURNING
            id AS reporting_id,
            status,
            revision,
            responded_at
          `,
          [reportingId]
        );

        return updated.rows[0];
      }
    );

    return res.json({

      success: true,

      message: 'Availability confirmed',

      data: result,
    });

  } catch (error) {

    return handleError(res, error);
  }
}

// ========================================
// DEVOTEE: WITHDRAW FROM ONE SERVICE DATE
// ========================================
export async function withdrawMyReporting(
  req: AuthenticatedRequest,
  res: Response
) {
  res.set('Cache-Control', 'private, no-store');
  try {
    const userId = getUserId(req);
    const reportingId = parseId(req.params.reportingId);
    const revision = parseId(req.body?.revision);
    const result = await transaction(async client => {
      // LOCK OPPORTUNITY BEFORE SERVICE DATE
      // Resolve ownership first without acquiring row locks.
      const opportunityLookup = await client.query(
        `
        SELECT sd.opportunity_id
        FROM volunteer_reporting vr
        JOIN volunteer_service_dates sd
          ON sd.id = vr.service_date_id
        JOIN volunteer_members m
          ON m.id = sd.member_id
        JOIN volunteer_registrations r
          ON r.id = m.registration_id
        WHERE vr.id = $1
          AND (r.user_id = $2 OR m.user_id = $2)
        `,
        [reportingId, userId]
      );
      if (!opportunityLookup.rows.length) {
        throw new ReportingError(
          404,
          'Reporting record not found'
        );
      }
      const opportunityId =
        Number(opportunityLookup.rows[0].opportunity_id);
      const opportunityLock = await client.query(
        `
        SELECT id
        FROM volunteer_opportunities
        WHERE id = $1
        FOR UPDATE
        `,
        [opportunityId]
      );
      if (!opportunityLock.rows.length) {
        throw new ReportingError(
          404,
          'Seva opportunity not found'
        );
      }      const current = await client.query(
        `
        SELECT
          vr.id AS reporting_id,
          vr.revision,
          vr.status AS reporting_status,
          sd.id AS service_date_id,
          sd.opportunity_id,
          sd.member_id,
          sd.service_date::text AS service_date,
          sd.status AS service_date_status
        FROM volunteer_reporting vr
        JOIN volunteer_service_dates sd
          ON sd.id = vr.service_date_id
        JOIN volunteer_members m
          ON m.id = sd.member_id
          AND m.opportunity_id = sd.opportunity_id
        JOIN volunteer_registrations r
          ON r.id = m.registration_id
          AND r.opportunity_id = sd.opportunity_id
        WHERE vr.id = $1
          AND (r.user_id = $2 OR m.user_id = $2)
        FOR UPDATE OF sd, m, r, vr
        `,
        [reportingId, userId]
      );
      if (!current.rows.length) {
        throw new ReportingError(404, 'Reporting record not found');
      }
      const row = current.rows[0];
      if (Number(row.revision) !== revision) {
        throw new ReportingError(
          409,
          'Reporting details have changed. Please refresh.'
        );
      }
      if (row.service_date_status !== 'active') {
        throw new ReportingError(
          409,
          'This service date is already closed'
        );
      }
      if (
        !['awaiting_response', 'confirmed', 'custom_requested',
          'revised_pending', 'coordinator_contacted'].includes(row.reporting_status)
      ) {
        throw new ReportingError(
          409,
          'Withdrawal is not available for this reporting status'
        );
      }
      const dailyAttendance = await client.query(
        `
        SELECT id
        FROM volunteer_daily_attendance
        WHERE service_date_id = $1
        LIMIT 1
        FOR UPDATE
        `,
        [row.service_date_id]
      );
      if (dailyAttendance.rows.length) {
        throw new ReportingError(
          409,
          'Attendance already exists. Please contact the coordinator.'
        );
      }
      const assignments = await client.query(
        `
        SELECT
          a.id,
          a.status,
          (
            (s.service_date + s.start_time)
            AT TIME ZONE 'Asia/Kolkata'
          ) > clock_timestamp() AS is_future
        FROM volunteer_assignments a
        JOIN volunteer_shifts s
          ON s.id = a.shift_id
          AND s.opportunity_id = a.opportunity_id
        WHERE a.member_id = $1
          AND a.opportunity_id = $2
          AND s.service_date = $3::date
        ORDER BY a.id
        FOR UPDATE OF a
        `,
        [
          row.member_id,
          row.opportunity_id,
          row.service_date
        ]
      );
      for (const assignment of assignments.rows) {
        if (
          ['in_progress', 'completed'].includes(assignment.status)
        ) {
          throw new ReportingError(
            409,
            'A duty has already started or completed. Contact the coordinator.'
          );
        }
        if (
          assignment.status === 'assigned' &&
          !assignment.is_future
        ) {
          throw new ReportingError(
            409,
            'An assigned duty has already started. Contact the coordinator.'
          );
        }
      }
      const attendance = await client.query(
        `
        SELECT att.id
        FROM volunteer_attendance att
        JOIN volunteer_assignments a
          ON a.id = att.assignment_id
        JOIN volunteer_shifts s
          ON s.id = a.shift_id
          AND s.opportunity_id = a.opportunity_id
        WHERE a.member_id = $1
          AND a.opportunity_id = $2
          AND s.service_date = $3::date
        LIMIT 1
        `,
        [
          row.member_id,
          row.opportunity_id,
          row.service_date
        ]
      );
      if (attendance.rows.length) {
        throw new ReportingError(
          409,
          'Duty attendance exists. Please contact the coordinator.'
        );
      }
      const cancelled = await client.query(
        `
        UPDATE volunteer_assignments a
        SET
          status = 'cancelled',
          cancellation_reason = 'Volunteer unavailable for service date',
          updated_at = NOW()
        FROM volunteer_shifts s
        WHERE s.id = a.shift_id
          AND s.opportunity_id = a.opportunity_id
          AND a.member_id = $1
          AND a.opportunity_id = $2
          AND s.service_date = $3::date
          AND a.status = 'assigned'
          AND (
            (s.service_date + s.start_time)
            AT TIME ZONE 'Asia/Kolkata'
          ) > clock_timestamp()
        RETURNING a.id
        `,
        [
          row.member_id,
          row.opportunity_id,
          row.service_date
        ]
      );
      for (const assignment of cancelled.rows) {
        const notification = await queueVolunteerPersonalDutyEvent(
          Number(assignment.id),
          'duty_cancelled',
          client
        );
        if (!notification.eligible) {
          throw new ReportingError(
            409,
            'Duty cancellation notification could not be queued'
          );
        }
      }      const closed = await client.query(
        `
        UPDATE volunteer_service_dates
        SET
          status = 'closed',
          closure_reason = 'Volunteer reported not available',
          closed_at = NOW(),
          closed_by = $1
        WHERE id = $2
          AND status = 'active'
        RETURNING id
        `,
        [userId, row.service_date_id]
      );
      if (closed.rowCount !== 1) {
        throw new ReportingError(
          409,
          'Service date could not be closed'
        );
      }
      const updated = await client.query(
        `
        UPDATE volunteer_reporting
        SET
          status = 'unavailable',
          responded_at = NOW(),
          updated_at = NOW(),
          revision = revision + 1
        WHERE id = $1
          AND revision = $2
        RETURNING id, status, revision, responded_at
        `,
        [reportingId, revision]
      );
      if (updated.rowCount !== 1) {
        throw new ReportingError(
          409,
          'Reporting response changed. Please refresh.'
        );
      }
      return {
        reporting: updated.rows[0],
        service_date_id: row.service_date_id,
        cancelled_assignment_ids: cancelled.rows.map(
          item => Number(item.id)
        )
      };
    });
    return res.json({
      success: true,
      message: 'You have withdrawn from the selected service date',
      data: result
    });
  } catch (error) {
    return handleError(res, error);
  }
}
export async function requestMyReportingTime(
  req: AuthenticatedRequest,
  res: Response
) {
  res.set('Cache-Control', 'private, no-store');
  try {
    const userId = getUserId(req);
    const reportingId = parseId(req.params.reportingId);
    const revision = parseId(req.body?.revision);
    const requestedTime = req.body?.requested_reporting_time;
    const message = req.body?.volunteer_message;
    if (
      typeof requestedTime !== 'string' ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(requestedTime)
    ) {
      throw new ReportingError(
        400,
        'Enter a valid requested time in HH:MM format'
      );
    }
    if (
      message != null &&
      (typeof message !== 'string' || message.length > 1000)
    ) {
      throw new ReportingError(
        400,
        'Message must not exceed 1000 characters'
      );
    }
    const result = await transaction(async client => {
      const lookup = await client.query(
        `
        SELECT sd.opportunity_id
        FROM volunteer_reporting vr
        JOIN volunteer_service_dates sd
          ON sd.id = vr.service_date_id
        JOIN volunteer_members m
          ON m.id = sd.member_id
        JOIN volunteer_registrations r
          ON r.id = m.registration_id
        WHERE vr.id = $1
          AND (r.user_id = $2 OR m.user_id = $2)
        `,
        [reportingId, userId]
      );
      if (!lookup.rows.length) {
        throw new ReportingError(404, 'Reporting record not found');
      }
      await client.query(
        `
        SELECT id
        FROM volunteer_opportunities
        WHERE id = $1
        FOR UPDATE
        `,
        [lookup.rows[0].opportunity_id]
      );
      const current = await client.query(
        `
        SELECT
          vr.id,
          vr.revision,
          vr.status,
          sd.status AS service_date_status,
          m.status AS member_status,
          r.status AS registration_status,
          (
            (sd.service_date + vr.reporting_time)
            AT TIME ZONE 'Asia/Kolkata'
          ) > clock_timestamp() AS is_upcoming
        FROM volunteer_reporting vr
        JOIN volunteer_service_dates sd
          ON sd.id = vr.service_date_id
        JOIN volunteer_members m
          ON m.id = sd.member_id
          AND m.opportunity_id = sd.opportunity_id
        JOIN volunteer_registrations r
          ON r.id = m.registration_id
          AND r.opportunity_id = sd.opportunity_id
        WHERE vr.id = $1
          AND (r.user_id = $2 OR m.user_id = $2)
        FOR UPDATE OF sd, m, r, vr
        `,
        [reportingId, userId]
      );
      if (!current.rows.length) {
        throw new ReportingError(404, 'Reporting record not found');
      }
      const row = current.rows[0];
      if (Number(row.revision) !== revision) {
        throw new ReportingError(
          409,
          'Reporting details changed. Refresh and try again.'
        );
      }
      if (
        row.service_date_status !== 'active' ||
        row.member_status !== 'approved' ||
        !['approved', 'assigned', 'in_progress'].includes(
          row.registration_status
        ) ||
        !['awaiting_response', 'confirmed', 'revised_pending'].includes(
          row.status
        ) ||
        !row.is_upcoming
      ) {
        throw new ReportingError(
          409,
          'Alternate reporting time cannot be requested for this date'
        );
      }
      const updated = await client.query(
        `
        UPDATE volunteer_reporting
        SET
          status = 'custom_requested',
          requested_reporting_time = $2::time,
          volunteer_message = $3,
          admin_reply = NULL,
          responded_at = NOW(),
          updated_at = NOW(),
          revision = revision + 1
        WHERE id = $1
        RETURNING
          id AS reporting_id,
          status,
          revision,
          requested_reporting_time,
          responded_at
        `,
        [
          reportingId,
          requestedTime,
          typeof message === 'string'
            ? message.trim()
            : null,
        ]
      );
      return updated.rows[0];
    });
    return res.json(result);
  } catch (error) {
    return handleError(res, error);
  }
}// ========================================
// DEVOTEE: CONTACTED COORDINATOR
// ========================================
export async function markMyCoordinatorContacted(
  req: AuthenticatedRequest,
  res: Response
) {
  res.set('Cache-Control', 'private, no-store');
  try {
    const userId = getUserId(req);
    const reportingId = parseId(req.params.reportingId);
    const revision = parseId(req.body?.revision);
    const result = await transaction(async client => {
      // Identify the opportunity without acquiring a row lock.
      const lookup = await client.query(
        `
        SELECT sd.opportunity_id
        FROM volunteer_reporting vr
        JOIN volunteer_service_dates sd
          ON sd.id = vr.service_date_id
        JOIN volunteer_members m
          ON m.id = sd.member_id
          AND m.opportunity_id = sd.opportunity_id
        JOIN volunteer_registrations r
          ON r.id = m.registration_id
          AND r.opportunity_id = sd.opportunity_id
        WHERE vr.id = $1
          AND (r.user_id = $2 OR m.user_id = $2)
        `,
        [reportingId, userId]
      );
      if (!lookup.rows.length) {
        throw new ReportingError(
          404,
          'Reporting record not found'
        );
      }
      // Match the lock ordering used by withdrawal.
      await client.query(
        `
        SELECT id
        FROM volunteer_opportunities
        WHERE id = $1
        FOR UPDATE
        `,
        [lookup.rows[0].opportunity_id]
      );
      const current = await client.query(
        `
        SELECT
          vr.id,
          vr.revision,
          vr.status,
          vr.coordinator_contacted_at,
          sd.status AS service_date_status,
          m.status AS member_status,
          r.status AS registration_status,
          COALESCE(
            da.attendance_status,
            'not_marked'
          ) AS attendance_status,
          (
            (sd.service_date + vr.reporting_time)
            AT TIME ZONE 'Asia/Kolkata'
          ) > clock_timestamp() AS is_upcoming
        FROM volunteer_reporting vr
        JOIN volunteer_service_dates sd
          ON sd.id = vr.service_date_id
        JOIN volunteer_members m
          ON m.id = sd.member_id
          AND m.opportunity_id = sd.opportunity_id
        JOIN volunteer_registrations r
          ON r.id = m.registration_id
          AND r.opportunity_id = sd.opportunity_id
        LEFT JOIN volunteer_daily_attendance da
          ON da.service_date_id = sd.id
        WHERE vr.id = $1
          AND (r.user_id = $2 OR m.user_id = $2)
        FOR UPDATE OF sd, m, r, vr
        `,
        [reportingId, userId]
      );
      if (!current.rows.length) {
        throw new ReportingError(
          404,
          'Reporting record not found'
        );
      }
      const row = current.rows[0];
      if (Number(row.revision) !== revision) {
        throw new ReportingError(
          409,
          'Reporting details changed. Refresh and try again.'
        );
      }
      if (
        row.service_date_status !== 'active' ||
        row.member_status !== 'approved' ||
        !['approved', 'assigned', 'in_progress'].includes(
          row.registration_status
        ) ||
        row.attendance_status !== 'not_marked' ||
        !row.is_upcoming
      ) {
        throw new ReportingError(
          409,
          'Coordinator contact response is no longer available'
        );
      }
      if (row.status === 'coordinator_contacted') {
        return {
          reporting_id: reportingId,
          status: row.status,
          revision: row.revision,
          coordinator_contacted_at:
            row.coordinator_contacted_at,
          unchanged: true
        };
      }
      if (
        ![
          'awaiting_response',
          'confirmed',
          'revised_pending'
        ].includes(row.status)
      ) {
        throw new ReportingError(
          409,
          'Coordinator contact cannot be recorded for this reporting status'
        );
      }
      const updated = await client.query(
        `
        UPDATE volunteer_reporting
        SET
          status = 'coordinator_contacted',
          coordinator_contacted_at = NOW(),
          coordinator_contact_method = NULL,
          responded_at = NOW(),
          updated_at = NOW(),
          revision = revision + 1
        WHERE id = $1
        RETURNING
          id AS reporting_id,
          status,
          revision,
          coordinator_contacted_at,
          responded_at
        `,
        [reportingId]
      );
      return updated.rows[0];
    });
    return res.json({
      success: true,
      message: 'Coordinator contact recorded',
      data: result
    });
  } catch (error) {
    return handleError(res, error);
  }
}
