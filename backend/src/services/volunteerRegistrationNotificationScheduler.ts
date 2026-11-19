import { pool } from '../db';

import {
  enqueueVolunteerNotification,
} from './volunteerNotificationQueueService';

// ========================================
// CONFIGURATION
// ========================================

const BATCH_LIMIT = 100;

let registrationSchedulerRunning = false;

// ========================================
// TYPES
// ========================================

interface RegistrationSchedulerSummary {
  openingCreated: number;
  closingCreated: number;
  duplicates: number;
  errors: number;
}

// ========================================
// SCHEDULE REGISTRATION OPENING
// ========================================

async function scheduleRegistrationOpening(
  summary: RegistrationSchedulerSummary
): Promise<void> {

  const result = await pool.query(
    `
    SELECT
      o.id,

      o.registration_start_at,

      o.registration_end_at,

      CONCAT(
        'volunteer:registration_opened:',
        o.id,
        ':',
        FLOOR(
          EXTRACT(EPOCH FROM o.registration_start_at)
          * 1000
        )::bigint
      ) AS event_key

    FROM volunteer_opportunities o

    WHERE o.is_published = TRUE

      AND o.registration_enabled = TRUE

      AND o.registration_start_at <= NOW()

      AND o.registration_end_at > NOW()

      AND NOT EXISTS (

        SELECT 1

        FROM volunteer_notification_jobs j

        WHERE j.event_key = CONCAT(
          'volunteer:registration_opened:',
          o.id,
          ':',
          FLOOR(
            EXTRACT(EPOCH FROM o.registration_start_at)
            * 1000
          )::bigint
        )
      )

    ORDER BY

      o.registration_start_at ASC,

      o.id ASC

    LIMIT $1
    `,
    [
      BATCH_LIMIT,
    ]
  );

  for (const opportunity of result.rows) {

    try {

      const registrationStartAt =
        new Date(
          opportunity.registration_start_at
        );

      const registrationEndAt =
        new Date(
          opportunity.registration_end_at
        );

      const scheduledAt = new Date();

      if (
        registrationEndAt.getTime() <=
        scheduledAt.getTime()
      ) {
        continue;
      }

      const queued =
        await enqueueVolunteerNotification({

          eventKey:
            opportunity.event_key,

          eventType:
            'registration_opened',

          opportunityId:
            Number(opportunity.id),

          targetType: 'all',

          scheduledAt,

          expiresAt:
            registrationEndAt,

          maxAttempts: 3,

          payload: {

            registrationStartAt:
              registrationStartAt.toISOString(),

            registrationEndAt:
              registrationEndAt.toISOString(),
          },
        });

      if (queued.created) {

        summary.openingCreated++;

      } else {

        summary.duplicates++;
      }

    } catch (error) {

      summary.errors++;

      console.error(
        '[Volunteer Registration Scheduler] Opening job failed:',
        opportunity.id,
        error
      );
    }
  }
}

// ========================================
// SCHEDULE REGISTRATION CLOSING REMINDER
// ========================================

async function scheduleRegistrationClosing(
  summary: RegistrationSchedulerSummary
): Promise<void> {

  const result = await pool.query(
    `
    SELECT
      o.id,

      o.registration_start_at,

      o.registration_end_at,

      CONCAT(
        'volunteer:registration_closing_reminder:',
        o.id,
        ':',
        FLOOR(
          EXTRACT(EPOCH FROM o.registration_end_at)
          * 1000
        )::bigint
      ) AS event_key

    FROM volunteer_opportunities o

    WHERE o.is_published = TRUE

      AND o.registration_enabled = TRUE

      AND o.registration_start_at <= NOW()

      AND o.registration_end_at > NOW()

      AND o.registration_end_at <=
        NOW() + INTERVAL '24 hours'

      AND NOT EXISTS (

        SELECT 1

        FROM volunteer_notification_jobs j

        WHERE j.event_key = CONCAT(
          'volunteer:registration_closing_reminder:',
          o.id,
          ':',
          FLOOR(
            EXTRACT(EPOCH FROM o.registration_end_at)
            * 1000
          )::bigint
        )
      )

    ORDER BY

      o.registration_end_at ASC,

      o.id ASC

    LIMIT $1
    `,
    [
      BATCH_LIMIT,
    ]
  );

  for (const opportunity of result.rows) {

    try {

      const registrationEndAt =
        new Date(
          opportunity.registration_end_at
        );

      const registrationStartAt =
        new Date(
          opportunity.registration_start_at
        );

      const scheduledAt = new Date();

      if (
        registrationEndAt.getTime() <=
        scheduledAt.getTime()
      ) {
        continue;
      }

      const queued =
        await enqueueVolunteerNotification({

          eventKey:
            opportunity.event_key,

          eventType:
            'registration_closing_reminder',

          opportunityId:
            Number(opportunity.id),

          targetType: 'all',

          scheduledAt,

          expiresAt:
            registrationEndAt,

          maxAttempts: 3,

          payload: {

            registrationStartAt:
              registrationStartAt.toISOString(),

            registrationEndAt:
              registrationEndAt.toISOString(),

            reminderHours: 24,
          },
        });

      if (queued.created) {

        summary.closingCreated++;

      } else {

        summary.duplicates++;
      }

    } catch (error) {

      summary.errors++;

      console.error(
        '[Volunteer Registration Scheduler] Closing reminder failed:',
        opportunity.id,
        error
      );
    }
  }
}

// ========================================
// MAIN REGISTRATION SCHEDULER
// ========================================

export async function processVolunteerRegistrationNotifications():
  Promise<RegistrationSchedulerSummary> {

  const summary: RegistrationSchedulerSummary = {

    openingCreated: 0,

    closingCreated: 0,

    duplicates: 0,

    errors: 0,
  };

  if (registrationSchedulerRunning) {
    return summary;
  }

  registrationSchedulerRunning = true;

  try {

    await scheduleRegistrationOpening(
      summary
    );

    await scheduleRegistrationClosing(
      summary
    );

    return summary;

  } finally {

    registrationSchedulerRunning = false;
  }
}