import type { PoolClient } from 'pg';
import { pool } from '../db';

export type AttendanceMode =
  | 'legacy'
  | 'simple'
  | 'detailed'
  | 'none';

export const DAILY_SERVICE_SUMMARY_SQL = `
  SELECT
    COUNT(sd.id)::integer
      AS total_selected_dates,

    COUNT(sd.id) FILTER (
      WHERE da.is_finalized = TRUE
        AND da.attendance_mode = o.attendance_mode
    )::integer AS finalized_dates,

    COUNT(sd.id) FILTER (
      WHERE da.attendance_status = 'present'
        AND da.is_finalized = TRUE
        AND da.attendance_mode = o.attendance_mode
    )::integer AS present_count,

    COUNT(sd.id) FILTER (
      WHERE da.attendance_status = 'absent'
        AND da.is_finalized = TRUE
        AND da.attendance_mode = o.attendance_mode
    )::integer AS absent_count,

    COUNT(sd.id) FILTER (
      WHERE da.attendance_status = 'excused'
        AND da.is_finalized = TRUE
        AND da.attendance_mode = o.attendance_mode
    )::integer AS excused_count,

    COUNT(sd.id) FILTER (
      WHERE da.is_finalized IS DISTINCT FROM TRUE
        OR da.attendance_mode IS DISTINCT FROM
          o.attendance_mode
    )::integer AS unfinalized_count,

    COUNT(sd.id) FILTER (
      WHERE sd.service_date > (
        clock_timestamp()
        AT TIME ZONE 'Asia/Kolkata'
      )::date
    )::integer AS remaining_dates,

    CASE
      WHEN o.attendance_mode = 'detailed'
      THEN COALESCE(
        SUM(da.total_service_hours) FILTER (
          WHERE da.attendance_status = 'present'
            AND da.is_finalized = TRUE
            AND da.attendance_mode = 'detailed'
        ),
        0
      )
      ELSE NULL
    END AS total_service_hours,

    MIN(sd.service_date) FILTER (
      WHERE da.attendance_status = 'present'
        AND da.is_finalized = TRUE
        AND da.attendance_mode = o.attendance_mode
    )::text AS service_start_date,

    MAX(sd.service_date) FILTER (
      WHERE da.attendance_status = 'present'
        AND da.is_finalized = TRUE
        AND da.attendance_mode = o.attendance_mode
    )::text AS service_end_date

  FROM volunteer_service_dates sd

  LEFT JOIN volunteer_daily_attendance da
    ON da.service_date_id = sd.id

  WHERE sd.member_id = m.id
    AND sd.opportunity_id = o.id
`;

export interface DailyServiceSummary {
  attendance_mode: AttendanceMode;

  member_id: number;

  total_selected_dates: number;
  finalized_dates: number;

  present_count: number;
  absent_count: number;
  excused_count: number;

  unfinalized_count: number;
  remaining_dates: number;

  total_service_days: number | null;
  total_service_hours: number | null;

  attendance_percentage: number | null;

  service_start_date: string | null;
  service_end_date: string | null;

  can_complete: boolean;
  completion_reasons: string[];
}

export function calculateDailyServiceSummary(
  row: any
): DailyServiceSummary {
  const mode = row.attendance_mode as AttendanceMode;

  const total = Number(row.total_selected_dates);

  const finalized = Number(row.finalized_dates);

  const present = Number(row.present_count);

  const absent = Number(row.absent_count);

  const excused = Number(row.excused_count);

  const unfinalized = Number(row.unfinalized_count);

  const remaining = Number(row.remaining_dates);

  const reasons: string[] = [];

  const tracksAttendance =
    mode === 'simple' || mode === 'detailed';

  if (row.member_status !== 'approved') {
    reasons.push('Volunteer is not in approved status');
  }

  if (
    !['approved', 'assigned', 'in_progress']
      .includes(row.registration_status)
  ) {
    reasons.push('Registration is not eligible');
  }

  if (mode === 'legacy') {
    reasons.push('Use legacy assignment completion');
  }

  if (!['simple', 'detailed', 'none', 'legacy'].includes(mode)) {
    reasons.push('Invalid attendance mode');
  }

  if (total === 0) {
    reasons.push('No selected service dates');
  }

  if (remaining > 0) {
    reasons.push('Selected service dates are still remaining');
  }

  if (tracksAttendance) {
    if (unfinalized > 0 || finalized !== total) {
      reasons.push('Daily attendance is not fully finalized');
    }

    if (present === 0) {
      reasons.push('No finalized present attendance');
    }
  }

  return {
    attendance_mode: mode,

    member_id: Number(row.member_id),

    total_selected_dates: total,

    finalized_dates: tracksAttendance
      ? finalized
      : 0,

    present_count: tracksAttendance
      ? present
      : 0,

    absent_count: tracksAttendance
      ? absent
      : 0,

    excused_count: tracksAttendance
      ? excused
      : 0,

    unfinalized_count: tracksAttendance
      ? unfinalized
      : 0,

    remaining_dates: remaining,

    total_service_days: tracksAttendance
      ? present
      : null,

    total_service_hours:
      mode === 'detailed' &&
      row.total_service_hours != null
        ? Number(row.total_service_hours)
        : null,

    attendance_percentage:
      tracksAttendance && total > 0
        ? Number(
            ((present / total) * 100).toFixed(2)
          )
        : null,

    service_start_date: tracksAttendance
      ? row.service_start_date ?? null
      : null,

    service_end_date: tracksAttendance
      ? row.service_end_date ?? null
      : null,

    can_complete: reasons.length === 0,

    completion_reasons: reasons,
  };
}

export async function getDailyServiceSummary(
  opportunityId: number | string,
  memberId: number | string,
  client: PoolClient | typeof pool = pool
): Promise<DailyServiceSummary | null> {
  const result = await client.query(
    `
    SELECT
      m.id AS member_id,

      m.status AS member_status,

      r.status AS registration_status,

      o.attendance_mode,

      daily.*

    FROM volunteer_members m

    JOIN volunteer_registrations r
      ON r.id = m.registration_id

    JOIN volunteer_opportunities o
      ON o.id = m.opportunity_id

    CROSS JOIN LATERAL (
      ${DAILY_SERVICE_SUMMARY_SQL}
    ) daily

    WHERE m.id = $1
      AND m.opportunity_id = $2
    `,
    [memberId, opportunityId]
  );

  if (!result.rows.length) {
    return null;
  }

  return calculateDailyServiceSummary(
    result.rows[0]
  );
}