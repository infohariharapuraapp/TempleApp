import type { PoolClient } from 'pg';
import {
  queueAccountPhotos,
} from './accountPhotoQueueService';
import {
  getDailyServiceSummary,
} from './volunteerDailyServiceSummary';
async function preserveAnonymousStatistics(
  client: PoolClient,
  memberId: number
): Promise<void> {
  const result = await client.query(
    `
    SELECT
      m.opportunity_id,
      m.status,
      o.attendance_mode
    FROM volunteer_members m
    JOIN volunteer_opportunities o
      ON o.id = m.opportunity_id
    WHERE m.id = $1
    FOR UPDATE OF m
    `,
    [memberId]
  );
  if (result.rows.length !== 1) {
    throw new Error('Volunteer statistics unavailable');
  }
  const member = result.rows[0];
  let days = 0;
  let hours = 0;
  const completed =
    member.status === 'completed' ? 1 : 0;
  if (member.attendance_mode === 'legacy') {
    const legacy = await client.query(
      `
      SELECT
        COUNT(DISTINCT s.service_date)::integer
          AS days,
        COALESCE(
          ROUND(
            SUM(
              EXTRACT(EPOCH FROM
                (s.end_time - s.start_time)
              ) / 3600
            ),
            2
          ),
          0
        ) AS hours
      FROM volunteer_assignments a
      JOIN volunteer_shifts s
        ON s.id = a.shift_id
      JOIN volunteer_attendance att
        ON att.assignment_id = a.id
      WHERE a.member_id = $1
        AND a.opportunity_id = $2
        AND a.status NOT IN (
          'cancelled',
          'reassigned'
        )
        AND att.attendance_status = 'present'
        AND att.is_finalized = TRUE
      `,
      [memberId, member.opportunity_id]
    );
    days = Number(legacy.rows[0].days);
    hours = Number(legacy.rows[0].hours);
  } else if (
    ['simple', 'detailed', 'none']
      .includes(member.attendance_mode)
  ) {
    const summary = await getDailyServiceSummary(
      member.opportunity_id,
      memberId,
      client
    );
    if (!summary) {
      throw new Error('Service summary unavailable');
    }
    days = summary.total_service_days ?? 0;
    hours = summary.total_service_hours ?? 0;
  } else {
    throw new Error('Invalid attendance mode');
  }
  if (
    !Number.isSafeInteger(days) ||
    days < 0 ||
    !Number.isFinite(hours) ||
    hours < 0
  ) {
    throw new Error('Invalid service statistics');
  }
  const updated = await client.query(
    `
    UPDATE public.anonymous_volunteer_service_totals
    SET
      completed_volunteers =
        completed_volunteers + $1,
      total_service_days =
        total_service_days + $2,
      total_service_hours =
        total_service_hours + $3
    WHERE id = 1
    `,
    [completed, days, hours]
  );
  if (updated.rowCount !== 1) {
    throw new Error('Statistics storage unavailable');
  }
}
export async function deleteVerifiedVolunteerMember(
  client: PoolClient,
  userId: number,
  memberId: number
): Promise<void> {
  if (
    !Number.isSafeInteger(userId) ||
    userId <= 0 ||
    !Number.isSafeInteger(memberId) ||
    memberId <= 0
  ) {
    throw new Error('Invalid deletion identifiers');
  }
  const memberResult = await client.query(
    `
    SELECT id, registration_id, photo_url
    FROM volunteer_members
    WHERE id = $1
      AND user_id = $2
    FOR UPDATE
    `,
    [memberId, userId]
  );
  if (memberResult.rows.length !== 1) {
    throw new Error('Volunteer ownership check failed');
  }
  const member = memberResult.rows[0];

  await preserveAnonymousStatistics(client, memberId);
  const cards = await client.query(
    `
    SELECT photo_url
    FROM volunteer_id_cards
    WHERE member_id = $1
    FOR UPDATE
    `,
    [memberId]
  );
  await queueAccountPhotos(
    client,
    [
      member.photo_url,
      ...cards.rows.map(row => row.photo_url)
    ]
  );
  // Dependent notification jobs must be removed
  // before assignments and member records.
  await client.query(
    `
    DELETE FROM volunteer_notification_jobs
    WHERE member_id = $1
       OR assignment_id IN (
         SELECT id
         FROM volunteer_assignments
         WHERE member_id = $1
       )
    `,
    [memberId]
  );
  await client.query(
    `
    DELETE FROM volunteer_reporting_messages
    WHERE reporting_id IN (
      SELECT r.id
      FROM volunteer_reporting r
      JOIN volunteer_service_dates d
        ON d.id = r.service_date_id
      WHERE d.member_id = $1
    )
    `,
    [memberId]
  );
  await client.query(
    `
    DELETE FROM volunteer_reporting
    WHERE service_date_id IN (
      SELECT id
      FROM volunteer_service_dates
      WHERE member_id = $1
    )
    `,
    [memberId]
  );
  await client.query(
    `
    DELETE FROM volunteer_daily_attendance
    WHERE service_date_id IN (
      SELECT id
      FROM volunteer_service_dates
      WHERE member_id = $1
    )
    `,
    [memberId]
  );
  await client.query(
    `
    DELETE FROM volunteer_attendance
    WHERE assignment_id IN (
      SELECT id
      FROM volunteer_assignments
      WHERE member_id = $1
    )
    `,
    [memberId]
  );
  await client.query(
    'DELETE FROM volunteer_certificates WHERE member_id = $1',
    [memberId]
  );
  await client.query(
    'DELETE FROM volunteer_id_cards WHERE member_id = $1',
    [memberId]
  );
  await client.query(
    'DELETE FROM volunteer_accommodation WHERE member_id = $1',
    [memberId]
  );
  await client.query(
    'DELETE FROM volunteer_availability WHERE member_id = $1',
    [memberId]
  );
  await client.query(
    'DELETE FROM volunteer_assignments WHERE member_id = $1',
    [memberId]
  );
  await client.query(
    'DELETE FROM volunteer_service_dates WHERE member_id = $1',
    [memberId]
  );
  const removed = await client.query(
    `
    DELETE FROM volunteer_members
    WHERE id = $1
      AND user_id = $2
    `,
    [memberId, userId]
  );
  if (removed.rowCount !== 1) {
    throw new Error('Volunteer deletion consistency check failed');
  }
}