import { PoolClient } from 'pg';

import { pool } from '../db';

import {
  enqueueVolunteerNotification,
  VolunteerNotificationJob,
} from './volunteerNotificationQueueService';

import type {
  VolunteerDeliveryContent,
} from './volunteerNotificationDeliveryService';

export type ReportingEvent =
  | 'reporting_sent'
  | 'reporting_updated'
  | 'reporting_cancelled';

function validId(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value > 0 &&
    value <= 2147483647
  );
}

// ========================================
// QUEUE REPORTING NOTIFICATIONS
// ========================================

export async function queueVolunteerReportingEvent(
  reportingId: number,
  event: ReportingEvent,
  client: PoolClient
) {
  if (!validId(reportingId)) {
    throw new Error('Invalid reporting ID');
  }

  const result = await client.query(
    `
    SELECT
      vr.id,
      vr.revision,
      vr.status,
      sd.opportunity_id,
      sd.member_id,
      m.registration_id,
      m.user_id AS member_user_id,
      r.user_id AS owner_user_id,
      clock_timestamp() AS database_now,
      (
        sd.service_date + vr.reporting_time
      ) AT TIME ZONE 'Asia/Kolkata'
        AS reporting_at

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

      AND m.status = 'approved'

      AND r.status IN (
        'approved',
        'assigned',
        'in_progress'
      )

    FOR UPDATE OF vr
    `,
    [reportingId]
  );

  const summary = {
    recipients: 0,
    created: 0,
    duplicates: 0,
  };

  if (!result.rows.length) {
    return summary;
  }

  const row = result.rows[0];

  const cancelled =
    event === 'reporting_cancelled';

  if (
    cancelled
      ? row.status !== 'cancelled'
      : ![
          'awaiting_response',
          'confirmed',
        ].includes(row.status)
  ) {
    return summary;
  }

  const scheduledAt =
    new Date(row.database_now);

  const reportingAt =
    new Date(row.reporting_at);

  const expiresAt = cancelled

    ? new Date(
        scheduledAt.getTime() +
        24 * 60 * 60 * 1000
      )

    : reportingAt;

  if (
    !Number.isFinite(expiresAt.getTime()) ||
    expiresAt <= scheduledAt
  ) {
    return summary;
  }

  const recipients = [
    ...new Set(
      [
        row.owner_user_id,
        row.member_user_id,
      ].filter(validId)
    ),
  ].sort((a, b) => a - b);

  if (!recipients.length) {
    return summary;
  }

  const users = await client.query(
    `
    SELECT id
    FROM users
    WHERE id = ANY($1::integer[])
    ORDER BY id
    `,
    [recipients]
  );

  summary.recipients = users.rows.length;

  for (const user of users.rows) {

    const recipientUserId = Number(user.id);

    const queued =
      await enqueueVolunteerNotification(
        {
          eventKey: [
            'volunteer',
            event,
            reportingId,
            recipientUserId,
            row.revision,
          ].join(':'),

          eventType: event,

          opportunityId:
            Number(row.opportunity_id),

          registrationId:
            Number(row.registration_id),

          memberId:
            Number(row.member_id),

          recipientUserId,

          targetType: 'user',

          scheduledAt,
          expiresAt,

          maxAttempts: 3,

          payload: {
            reportingId,
            reportingRevision:
              Number(row.revision),
          },
        },
        client
      );

    if (queued.created) {
      summary.created++;
    } else {
      summary.duplicates++;
    }
  }

  return summary;
}

// ========================================
// VALIDATE REPORTING BEFORE DELIVERY
// ========================================

export async function validateVolunteerReportingEvent(
  job: VolunteerNotificationJob
): Promise<VolunteerDeliveryContent | null> {

  const reportingId =
    job.payload?.reportingId;

  const revision =
    job.payload?.reportingRevision;

  if (
    job.target_type !== 'user' ||
    !validId(reportingId) ||
    !validId(revision) ||
    !validId(job.recipient_user_id) ||
    !validId(job.opportunity_id) ||
    !validId(job.registration_id) ||
    !validId(job.member_id) ||
    job.assignment_id !== null
  ) {
    return null;
  }

  if (
    ![
      'reporting_sent',
      'reporting_updated',
      'reporting_cancelled',
    ].includes(job.event_type)
  ) {
    return null;
  }

  const result = await pool.query(
    `
    SELECT
      vr.status,
      sd.service_date::text AS service_date,
      TO_CHAR(
        vr.reporting_time,
        'HH12:MI AM'
      ) AS reporting_time,

      (
        (
          sd.service_date + vr.reporting_time
        ) AT TIME ZONE 'Asia/Kolkata'
      ) > clock_timestamp()
        AS is_upcoming

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

      AND vr.revision = $2

      AND sd.opportunity_id = $3

      AND r.id = $4

      AND m.id = $5

      AND (
        r.user_id = $6
        OR m.user_id = $6
      )

      AND m.status = 'approved'

      AND r.status IN (
        'approved',
        'assigned',
        'in_progress'
      )

    LIMIT 1
    `,
    [
      reportingId,
      revision,
      job.opportunity_id,
      job.registration_id,
      job.member_id,
      job.recipient_user_id,
    ]
  );

  if (!result.rows.length) {
    return null;
  }

  const reporting = result.rows[0];

  const cancelled =
    job.event_type === 'reporting_cancelled';

  if (cancelled) {

    if (reporting.status !== 'cancelled') {
      return null;
    }

  } else {

    if (
      !reporting.is_upcoming ||
      ![
        'awaiting_response',
        'confirmed',
      ].includes(reporting.status)
    ) {
      return null;
    }
  }

  const date = new Intl.DateTimeFormat(
    'en-IN',
    {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }
  ).format(
    new Date(
      reporting.service_date +
      'T00:00:00+05:30'
    )
  );

  let title: string;
  let body: string;

  switch (job.event_type) {

    case 'reporting_sent':

      title = 'Volunteer Seva Reporting';

      body =
        `Your reporting details for ${date} ` +
        `at ${reporting.reporting_time.trim()} ` +
        'are available. Visit My Sevas for details.';

      break;

    case 'reporting_updated':

      title = 'Seva Reporting Updated';

      body =
        `Your reporting details for ${date} ` +
        'have changed. Please check My Sevas.';

      break;

    case 'reporting_cancelled':

      title = 'Seva Reporting Cancelled';

      body =
        `Your reporting schedule for ${date} ` +
        'has been cancelled. Check My Sevas.';

      break;

    default:
      return null;
  }

  return {
    title,
    body,

    data: {
      type: 'volunteer_seva',
      event: job.event_type,
      screen: '/my-sevas',
      opportunityId: job.opportunity_id,
    },
  };
}