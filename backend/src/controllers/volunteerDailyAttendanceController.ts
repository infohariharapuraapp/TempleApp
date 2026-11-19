import type { PoolClient } from 'pg';
import { Request, Response } from 'express';
import { pool } from '../db';
import { AuthRequest } from '../middleware/authMiddleware';
import { isValidServiceDate } from '../services/volunteerServiceDateService';

// ========================================
// HELPERS
// ========================================

class DailyAttendanceError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

function fail(status: number, message: string): never {
  throw new DailyAttendanceError(status, message);
}

function parseId(value: unknown): number {
  if (!/^[1-9]\d*$/.test(String(value))) {
    fail(400, 'Invalid ID');
  }

  const id = Number(value);

  if (!Number.isSafeInteger(id) || id > 2147483647) {
    fail(400, 'Invalid ID');
  }

  return id;
}

function parseDate(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !isValidServiceDate(value)
  ) {
    fail(400, 'Invalid service date');
  }

  return value;
}

function parseText(
  value: unknown,
  maxLength = 2000
): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (
    typeof value !== 'string' ||
    value.trim().length > maxLength
  ) {
    fail(400, 'Invalid remarks');
  }

  return value.trim() || null;
}

function parseTimestamp(
  value: unknown
): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  ) {
    fail(400, 'Invalid attendance timestamp');
  }

  return new Date(value).toISOString();
}

function getAdminId(req: Request): number {
  return parseId((req as AuthRequest).user?.userId);
}

function handleError(res: Response, error: unknown) {
  if (error instanceof DailyAttendanceError) {
    return res.status(error.status).json({
      success: false,
      message: error.message,
    });
  }

  console.error('Daily attendance error:', error);

  return res.status(500).json({
    success: false,
    message: 'Unable to process daily attendance',
  });
}

function parseRecords(value: unknown): any[] {
  if (
    !Array.isArray(value) ||
    !value.length ||
    value.length > 500
  ) {
    fail(400, 'Select between 1 and 500 attendance records');
  }

  const records = value.map(item => ({
    ...item,
    service_date_id: parseId(item?.service_date_id),
  }));

  if (
    new Set(records.map(item => item.service_date_id)).size
      !== records.length
  ) {
    fail(400, 'Duplicate attendance records');
  }

  return records.sort(
    (a, b) => a.service_date_id - b.service_date_id
  );
}

// ========================================
// TRANSACTION
// ========================================

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
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

type DBClient = PoolClient;

// ========================================
// OPPORTUNITY VALIDATION
// ========================================

async function lockOpportunity(
  client: DBClient,
  opportunityId: number
) {
  const result = await client.query(
    `
    SELECT
      id,
      title,
      attendance_mode,
      service_start_date::text,
      service_end_date::text,
      (
        clock_timestamp()
        AT TIME ZONE 'Asia/Kolkata'
      )::date::text AS today
    FROM volunteer_opportunities
    WHERE id = $1
    FOR UPDATE
    `,
    [opportunityId]
  );

  const opportunity = result.rows[0];

  if (!opportunity) {
    fail(404, 'Seva opportunity not found');
  }

  if (
    !['simple', 'detailed'].includes(
      opportunity.attendance_mode
    )
  ) {
    fail(
      409,
      'Daily attendance is not enabled for this opportunity'
    );
  }

  return opportunity;
}

// ========================================
// LOCK VOLUNTEER SERVICE DATE
// ========================================

async function lockServiceDate(
  client: DBClient,
  opportunityId: number,
  serviceDateId: number
) {
  const result = await client.query(
    `
    SELECT
      sd.id AS service_date_id,
      sd.service_date::text AS service_date,
      m.id AS member_id,
      m.status AS member_status,
      r.status AS registration_status,
      (
        clock_timestamp()
        AT TIME ZONE 'Asia/Kolkata'
      )::date::text AS today
    FROM volunteer_service_dates sd
    JOIN volunteer_members m
      ON m.id = sd.member_id
      AND m.opportunity_id = sd.opportunity_id
    JOIN volunteer_registrations r
      ON r.id = m.registration_id
    WHERE sd.id = $1
      AND sd.opportunity_id = $2
    FOR UPDATE OF sd, m, r
    `,
    [serviceDateId, opportunityId]
  );

  const row = result.rows[0];

  if (!row) {
    fail(404, 'Volunteer service date not found');
  }

  if (
    row.member_status !== 'approved' ||
    !['approved', 'assigned', 'in_progress'].includes(
      row.registration_status
    )
  ) {
    fail(
      409,
      'Volunteer must have an active approved registration'
    );
  }

  if (row.service_date > row.today) {
    fail(409, 'Future attendance cannot be recorded');
  }

  return row;
}

// ========================================
// EXISTING ATTENDANCE
// ========================================

async function getExistingAttendance(
  client: DBClient,
  serviceDateId: number
) {
  const result = await client.query(
    `
    SELECT *
    FROM volunteer_daily_attendance
    WHERE service_date_id = $1
    FOR UPDATE
    `,
    [serviceDateId]
  );

  return result.rows[0] || null;
}

function checkRevision(
  record: any,
  revision: unknown
) {
  const expected = record
    ? Number(record.revision)
    : 0;

  if (
    typeof revision !== 'number' ||
    revision !== expected
  ) {
    fail(
      409,
      'Attendance has changed. Refresh records and retry.'
    );
  }
}

// ========================================
// VALIDATE CHECK-IN AND CHECK-OUT
// ========================================

async function validateTimes(
  client: DBClient,
  serviceDate: string,
  checkIn: string | null,
  checkOut: string | null
) {
  if (checkOut && !checkIn) {
    fail(400, 'Check-in is required before check-out');
  }

  if (!checkIn) return;

  const result = await client.query(
    `
    SELECT
      (
        $1::timestamptz
        AT TIME ZONE 'Asia/Kolkata'
      )::date::text AS check_in_date,

      (
        $2::timestamptz
        AT TIME ZONE 'Asia/Kolkata'
      )::date::text AS check_out_date,

      $1::timestamptz > clock_timestamp()
        AS future_check_in,

      $2::timestamptz > clock_timestamp()
        AS future_check_out,

      $2::timestamptz <= $1::timestamptz
        AS invalid_order
    `,
    [checkIn, checkOut]
  );

  const row = result.rows[0];

  if (
    row.future_check_in ||
    row.future_check_out
  ) {
    fail(400, 'Attendance time cannot be in the future');
  }

  if (
    row.check_in_date !== serviceDate ||
    (
      checkOut &&
      row.check_out_date !== serviceDate
    )
  ) {
    fail(
      400,
      'Attendance times must belong to the selected service date'
    );
  }

  if (row.invalid_order) {
    fail(400, 'Check-out must be after check-in');
  }
}

// ========================================
// GET DAILY ATTENDANCE
// ========================================

export const getDailyAttendance = async (
  req: Request,
  res: Response
) => {
  try {
    const opportunityId = parseId(
      req.params.opportunityId
    );

    const serviceDate = parseDate(
      req.query.service_date
    );

    res.setHeader('Cache-Control', 'no-store');

    const data = await transaction(async client => {
      const opportunity = await lockOpportunity(
        client,
        opportunityId
      );

      if (
        serviceDate < opportunity.service_start_date ||
        serviceDate > opportunity.service_end_date
      ) {
        fail(400, 'Date is outside the service period');
      }

      const result = await client.query(
        `
        SELECT
          sd.id AS service_date_id,
          sd.service_date::text AS service_date,

          m.id AS member_id,
          m.member_code,
          m.full_name,
          m.mobile,
          m.status AS member_status,

          r.id AS registration_id,
          r.registration_code,
          r.group_name,
          r.status AS registration_status,

          da.id AS attendance_id,
          COALESCE(
            da.attendance_status,
            'not_marked'
          ) AS attendance_status,

          da.check_in_at,
          da.check_out_at,

          CASE
            WHEN $3 = 'detailed'
              AND da.attendance_status = 'present'
              AND da.check_in_at IS NOT NULL
              AND da.check_out_at IS NOT NULL
            THEN da.total_service_hours
            ELSE NULL
          END AS total_service_hours,

          da.remarks,
          da.marked_at,
          da.finalized_at,

          COALESCE(
            da.is_finalized,
            FALSE
          ) AS is_finalized,

          COALESCE(
            da.revision,
            0
          ) AS revision,

          COALESCE(
            vr.status,
            'not_sent'
          ) AS reporting_status,

          vr.reporting_time,
          vr.coordinator_name

        FROM volunteer_service_dates sd

        JOIN volunteer_members m
          ON m.id = sd.member_id
          AND m.opportunity_id = sd.opportunity_id

        JOIN volunteer_registrations r
          ON r.id = m.registration_id

        LEFT JOIN volunteer_daily_attendance da
          ON da.service_date_id = sd.id

        LEFT JOIN volunteer_reporting vr
          ON vr.service_date_id = sd.id

        WHERE sd.opportunity_id = $1
          AND sd.service_date = $2::date
          AND m.status IN ('approved', 'completed')
          AND r.status IN (
            'approved',
            'assigned',
            'in_progress',
            'completed'
          )

        ORDER BY m.full_name, sd.id
        `,
        [
          opportunityId,
          serviceDate,
          opportunity.attendance_mode,
        ]
      );

      return {
        opportunity_id: opportunityId,
        attendance_mode: opportunity.attendance_mode,
        service_date: serviceDate,
        today: opportunity.today,
        volunteers: result.rows,
      };
    });

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// ========================================
// SAVE ATTENDANCE — INDIVIDUAL OR BULK
// ========================================

export const saveDailyAttendance = async (
  req: Request,
  res: Response
) => {
  try {
    const adminId = getAdminId(req);

    const opportunityId = parseId(
      req.params.opportunityId
    );

    const records = parseRecords(req.body?.records);

    const updated = await transaction(async client => {
      const opportunity = await lockOpportunity(
        client,
        opportunityId
      );

      const mode = opportunity.attendance_mode;

      for (const item of records) {
        const dateRow = await lockServiceDate(
          client,
          opportunityId,
          item.service_date_id
        );

        const existing = await getExistingAttendance(
          client,
          item.service_date_id
        );

        checkRevision(existing, item.revision);

        if (existing?.is_finalized) {
          fail(
            409,
            'Reopen finalized attendance before editing'
          );
        }

        if (
          existing &&
          existing.attendance_mode !== mode
        ) {
          fail(409, 'Attendance mode mismatch');
        }

        const status = item.attendance_status;

        if (
          !['not_marked', 'present', 'absent', 'excused']
            .includes(status)
        ) {
          fail(400, 'Invalid attendance status');
        }

        const checkIn = parseTimestamp(item.check_in_at);

        const checkOut = parseTimestamp(item.check_out_at);

        const remarks = parseText(item.remarks);

        if (
          (mode === 'simple' || status !== 'present') &&
          (checkIn || checkOut)
        ) {
          fail(
            400,
            'Check-in and check-out are not permitted for this attendance record'
          );
        }

        if (mode === 'detailed' && status === 'present') {
          await validateTimes(
            client,
            dateRow.service_date,
            checkIn,
            checkOut
          );
        }

        await client.query(
          `
          INSERT INTO volunteer_daily_attendance (
            service_date_id,
            attendance_mode,
            attendance_status,
            check_in_at,
            check_out_at,
            remarks,
            marked_by,
            marked_at
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, NOW()
          )

          ON CONFLICT (service_date_id)
          DO UPDATE SET
            attendance_status = EXCLUDED.attendance_status,
            check_in_at = EXCLUDED.check_in_at,
            check_out_at = EXCLUDED.check_out_at,
            remarks = EXCLUDED.remarks,
            marked_by = EXCLUDED.marked_by,
            marked_at = NOW(),
            revision =
              volunteer_daily_attendance.revision + 1,
            updated_at = NOW()
          `,
          [
            item.service_date_id,
            mode,
            status,
            checkIn,
            checkOut,
            remarks,
            adminId,
          ]
        );
      }

      return records.length;
    });

    return res.json({
      success: true,
      message: 'Attendance saved successfully',
      data: { updated },
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// ========================================
// FINALIZE ATTENDANCE
// ========================================

export const finalizeDailyAttendance = async (
  req: Request,
  res: Response
) => {
  try {
    const adminId = getAdminId(req);

    const opportunityId = parseId(
      req.params.opportunityId
    );

    const records = parseRecords(req.body?.records);

    const finalized = await transaction(async client => {
      const opportunity = await lockOpportunity(
        client,
        opportunityId
      );

      for (const item of records) {
        await lockServiceDate(
          client,
          opportunityId,
          item.service_date_id
        );

        const attendance = await getExistingAttendance(
          client,
          item.service_date_id
        );

        checkRevision(attendance, item.revision);

        if (!attendance) {
          fail(409, 'Save attendance before finalizing');
        }

        if (
          attendance.attendance_mode !==
          opportunity.attendance_mode
        ) {
          fail(409, 'Attendance mode mismatch');
        }

        if (attendance.is_finalized) {
          fail(409, 'Attendance is already finalized');
        }

        if (attendance.attendance_status === 'not_marked') {
          fail(409, 'Mark attendance before finalizing');
        }

        if (
          opportunity.attendance_mode === 'detailed' &&
          attendance.attendance_status === 'present' &&
          (
            !attendance.check_in_at ||
            !attendance.check_out_at
          )
        ) {
          fail(
            409,
            'Check-in and check-out are required'
          );
        }

        await client.query(
          `
          UPDATE volunteer_daily_attendance
          SET
            is_finalized = TRUE,
            finalized_by = $2,
            finalized_at = NOW(),
            updated_at = NOW(),
            revision = revision + 1
          WHERE service_date_id = $1
          `,
          [item.service_date_id, adminId]
        );
      }

      return records.length;
    });

    return res.json({
      success: true,
      message: 'Attendance finalized successfully',
      data: { finalized },
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// ========================================
// REOPEN ATTENDANCE FOR CORRECTION
// ========================================

export const reopenDailyAttendance = async (
  req: Request,
  res: Response
) => {
  try {
    const adminId = getAdminId(req);

    const opportunityId = parseId(
      req.params.opportunityId
    );

    const serviceDateId = parseId(
      req.params.serviceDateId
    );

    const reason = parseText(req.body?.reason);

    if (!reason) {
      fail(400, 'Correction reason is required');
    }

    await transaction(async client => {
      await lockOpportunity(
        client,
        opportunityId
      );

      const row = await lockServiceDate(
        client,
        opportunityId,
        serviceDateId
      );

      const attendance = await getExistingAttendance(
        client,
        serviceDateId
      );

      checkRevision(attendance, req.body?.revision);

      if (!attendance?.is_finalized) {
        fail(409, 'Attendance is not finalized');
      }

      const certificates = await client.query(
        `
        SELECT id
        FROM volunteer_certificates
        WHERE member_id = $1
          AND status IN ('draft', 'issued')
        LIMIT 1
        `,
        [row.member_id]
      );

      if (certificates.rows.length) {
        fail(
          409,
          'Certificate must be withdrawn before correcting attendance'
        );
      }

      const correction =
        `Attendance reopened: ${reason}`;

      await client.query(
        `
        UPDATE volunteer_daily_attendance
        SET
          is_finalized = FALSE,
          finalized_by = NULL,
          finalized_at = NULL,
          remarks = LEFT(
            CONCAT_WS(
              E'\\n',
              NULLIF(remarks, ''),
              $3
            ),
            5000
          ),
          marked_by = $2,
          marked_at = NOW(),
          updated_at = NOW(),
          revision = revision + 1
        WHERE service_date_id = $1
        `,
        [serviceDateId, adminId, correction]
      );
    });

    return res.json({
      success: true,
      message: 'Attendance reopened successfully',
      data: {
        service_date_id: serviceDateId,
      },
    });
  } catch (error) {
    return handleError(res, error);
  }
};