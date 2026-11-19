import { PoolClient } from 'pg';

import {
  pool,
} from '../db';

import {
  enqueueVolunteerNotification,
} from './volunteerNotificationQueueService';

// ========================================
// TYPES
// ========================================

export type RegistrationBroadcastEvent =
  | 'registration_opened'
  | 'registration_extended';

interface RegistrationEventResult {
  created: boolean;
  eligible: boolean;
  eventKey: string | null;
}

// ========================================
// VALIDATE OPPORTUNITY ID
// ========================================

function isValidId(
  value: number
): boolean {

  return (
    Number.isInteger(value) &&
    value > 0 &&
    value <= 2147483647
  );
}

// ========================================
// CREATE REGISTRATION EVENT KEY
// ========================================

function createRegistrationEventKey(
  event: RegistrationBroadcastEvent,
  opportunityId: number,
  timestamp: Date
): string {

  return [
    'volunteer',
    event,
    opportunityId,
    timestamp.getTime(),
  ].join(':');
}

// ========================================
// QUEUE REGISTRATION BROADCAST
// ========================================

export async function queueVolunteerRegistrationEvent(
  opportunityId: number,

  event: RegistrationBroadcastEvent,

  client?: PoolClient

): Promise<RegistrationEventResult> {

  const notEligible: RegistrationEventResult = {
    created: false,
    eligible: false,
    eventKey: null,
  };

  if (!isValidId(opportunityId)) {

    throw new Error(
      'Invalid volunteer opportunity ID'
    );
  }

  if (
    event !== 'registration_opened' &&
    event !== 'registration_extended'
  ) {

    throw new Error(
      'Invalid registration broadcast event'
    );
  }

  const db = client ?? pool;

  // ========================================
  // READ CURRENT REGISTRATION STATE
  // ========================================

  const result = await db.query(
    `
    SELECT

      o.id,

      o.registration_start_at,

      o.registration_end_at,

      NOW() AS database_now

    FROM volunteer_opportunities o

    WHERE o.id = $1

      AND o.is_published = TRUE

      AND o.registration_enabled = TRUE

      AND o.registration_start_at <= NOW()

      AND o.registration_end_at > NOW()

      AND o.service_end_date >=
        (NOW() AT TIME ZONE 'Asia/Kolkata')::date

    LIMIT 1
    `,
    [
      opportunityId,
    ]
  );

  if (!result.rows.length) {

    return notEligible;
  }

  const opportunity = result.rows[0];

  const registrationStartAt =
    new Date(
      opportunity.registration_start_at
    );

  const registrationEndAt =
    new Date(
      opportunity.registration_end_at
    );

  const scheduledAt =
    new Date(
      opportunity.database_now
    );

  if (
    !Number.isFinite(
      registrationStartAt.getTime()
    ) ||

    !Number.isFinite(
      registrationEndAt.getTime()
    ) ||

    !Number.isFinite(
      scheduledAt.getTime()
    )
  ) {

    throw new Error(
      'Invalid registration timestamps'
    );
  }

  if (
    registrationStartAt.getTime() >
      scheduledAt.getTime() ||

    registrationEndAt.getTime() <=
      scheduledAt.getTime()
  ) {

    return notEligible;
  }

  // ========================================
  // DETERMINE UNIQUE EVENT KEY
  // ========================================

  const eventTimestamp =
    event === 'registration_opened'

      ? registrationStartAt

      : registrationEndAt;

  const eventKey =
    createRegistrationEventKey(
      event,

      opportunityId,

      eventTimestamp
    );

  // ========================================
  // CREATE PERSISTENT NOTIFICATION JOB
  // ========================================

  const queued =
    await enqueueVolunteerNotification(

      {

        eventKey,

        eventType: event,

        opportunityId,

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
      },

      client
    );

  return {

    created: queued.created,

    eligible: true,

    eventKey,
  };
}