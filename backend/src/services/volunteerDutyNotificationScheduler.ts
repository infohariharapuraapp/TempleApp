import { pool } from '../db';

import {
  enqueueVolunteerNotification,
  VolunteerNotificationEvent,
} from './volunteerNotificationQueueService';

// ========================================
// CONFIGURATION
// ========================================

const BATCH_LIMIT = 200;

let dutySchedulerRunning = false;

// ========================================
// TYPES
// ========================================

type DutyReminderHours = 24 | 2;

interface DutySchedulerSummary {
  reminder24hCreated: number;
  reminder2hCreated: number;
  duplicates: number;
  errors: number;
}

interface DutyReminderCandidate {
  assignment_id: number;
  opportunity_id: number;
  registration_id: number;
  member_id: number;
  recipient_user_id: number;
  reporting_at: Date | string;
  expires_at: Date | string;
  event_key: string;
}

// ========================================
// GET REMINDER EVENT TYPE
// ========================================

function getReminderEvent(
  hours: DutyReminderHours
): VolunteerNotificationEvent {

  return hours === 24
    ? 'duty_reminder_24h'
    : 'duty_reminder_2h';
}

// ========================================
// FIND ELIGIBLE DUTY REMINDERS
// ========================================

async function getDutyReminderCandidates(
  hours: DutyReminderHours
): Promise<DutyReminderCandidate[]> {

  const eventType =
    getReminderEvent(hours);

  const result = await pool.query(
    `
    WITH eligible_assignments AS (

      SELECT

        a.id AS assignment_id,

        a.opportunity_id,

        m.id AS member_id,

        r.id AS registration_id,

        r.user_id AS registration_owner_id,

        m.user_id AS member_user_id,

        (
          s.service_date +

          COALESCE(
            a.reporting_time,
            s.start_time
          )
        ) AT TIME ZONE 'Asia/Kolkata'
          AS reporting_at

      FROM volunteer_assignments a

      JOIN volunteer_members m
        ON m.id = a.member_id

        AND m.opportunity_id =
          a.opportunity_id

      JOIN volunteer_registrations r
        ON r.id = m.registration_id

        AND r.opportunity_id =
          m.opportunity_id

      JOIN volunteer_shifts s
        ON s.id = a.shift_id

        AND s.opportunity_id =
          a.opportunity_id

      WHERE a.status = 'assigned'

        AND m.status = 'approved'

        AND r.status IN (
          'approved',
          'assigned',
          'in_progress'
        )

        AND s.is_active = TRUE
    ),

    eligible_recipients AS (

      SELECT DISTINCT

        ea.assignment_id,

        ea.opportunity_id,

        ea.registration_id,

        ea.member_id,

        ea.reporting_at,

        recipient.user_id
          AS recipient_user_id

      FROM eligible_assignments ea

      CROSS JOIN LATERAL (

        VALUES

          (ea.registration_owner_id),

          (ea.member_user_id)

      ) AS recipient(user_id)

      WHERE recipient.user_id IS NOT NULL

        AND ea.reporting_at > NOW()

        AND ea.reporting_at <=

          NOW() +
          ($1::integer * INTERVAL '1 hour')

        AND (

          $1::integer = 2

          OR ea.reporting_at >
            NOW() + INTERVAL '2 hours'
        )
    ),

    reminder_candidates AS (

      SELECT

        er.*,

        CASE

          WHEN $1::integer = 24

          THEN er.reporting_at -
            INTERVAL '2 hours'

          ELSE er.reporting_at

        END AS expires_at,

        CONCAT(

          'volunteer:',

          $2::text,

          ':',

          er.assignment_id,

          ':',

          er.recipient_user_id,

          ':',

          FLOOR(

            EXTRACT(
              EPOCH FROM er.reporting_at
            ) * 1000

          )::bigint

        ) AS event_key

      FROM eligible_recipients er
    )

    SELECT rc.*

    FROM reminder_candidates rc

    WHERE rc.expires_at > NOW()

      AND NOT EXISTS (

        SELECT 1

        FROM volunteer_notification_jobs j

        WHERE j.event_key = rc.event_key
      )

    ORDER BY

      rc.reporting_at ASC,

      rc.assignment_id ASC,

      rc.recipient_user_id ASC

    LIMIT $3
    `,
    [
      hours,

      eventType,

      BATCH_LIMIT,
    ]
  );

  return result.rows as DutyReminderCandidate[];
}

// ========================================
// SCHEDULE DUTY REMINDERS
// ========================================

async function scheduleDutyReminders(
  hours: DutyReminderHours,

  summary: DutySchedulerSummary

): Promise<void> {

  const eventType =
    getReminderEvent(hours);

  const candidates =
    await getDutyReminderCandidates(
      hours
    );

  for (const candidate of candidates) {

    try {

      const reportingAt =
        new Date(
          candidate.reporting_at
        );

      const expiresAt =
        new Date(
          candidate.expires_at
        );

      const scheduledAt =
        new Date();

      if (

        !Number.isFinite(
          reportingAt.getTime()
        ) ||

        !Number.isFinite(
          expiresAt.getTime()
        ) ||

        reportingAt.getTime() <=
          scheduledAt.getTime() ||

        expiresAt.getTime() <=
          scheduledAt.getTime()

      ) {

        continue;
      }

      const queued =
        await enqueueVolunteerNotification({

          eventKey:
            candidate.event_key,

          eventType,

          opportunityId:
            Number(
              candidate.opportunity_id
            ),

          registrationId:
            Number(
              candidate.registration_id
            ),

          memberId:
            Number(
              candidate.member_id
            ),

          assignmentId:
            Number(
              candidate.assignment_id
            ),

          recipientUserId:
            Number(
              candidate.recipient_user_id
            ),

          targetType: 'user',

          scheduledAt,

          expiresAt,

          maxAttempts: 3,

          payload: {

            reportingAt:
              reportingAt.toISOString(),

            reminderHours:
              hours,
          },
        });

      if (queued.created) {

        if (hours === 24) {

          summary.reminder24hCreated++;

        } else {

          summary.reminder2hCreated++;
        }

      } else {

        summary.duplicates++;
      }

    } catch (error) {

      summary.errors++;

      console.error(
        '[Volunteer Duty Scheduler] Reminder job failed:',

        {
          assignmentId:
            candidate.assignment_id,

          reminderHours:
            hours,
        },

        error
      );
    }
  }
}

// ========================================
// MAIN DUTY NOTIFICATION SCHEDULER
// ========================================

export async function processVolunteerDutyNotifications():
  Promise<DutySchedulerSummary> {

  const summary: DutySchedulerSummary = {

    reminder24hCreated: 0,

    reminder2hCreated: 0,

    duplicates: 0,

    errors: 0,
  };

  if (dutySchedulerRunning) {

    return summary;
  }

  dutySchedulerRunning = true;

  try {

    // Process urgent reminders first.

    await scheduleDutyReminders(
      2,
      summary
    );

    // Process 24-hour reminders.

    await scheduleDutyReminders(
      24,
      summary
    );

    return summary;

  } finally {

    dutySchedulerRunning = false;
  }
}