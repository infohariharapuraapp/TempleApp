import { PoolClient } from 'pg';

import {
  enqueueVolunteerNotification,
} from './volunteerNotificationQueueService';

// ========================================
// TYPES
// ========================================

export type PersonalRegistrationEvent =
  | 'registration_submitted'
  | 'registration_approved'
  | 'registration_rejected';

interface RegistrationEventSummary {
  eligible: boolean;
  recipients: number;
  created: number;
  duplicates: number;
}

// ========================================
// CONFIGURATION
// ========================================

const EVENT_REQUIRED_STATUS: Record<
  PersonalRegistrationEvent,
  string
> = {

  registration_submitted: 'pending',

  registration_approved: 'approved',

  registration_rejected: 'rejected',
};

// ========================================
// VALIDATE ID
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
// CREATE UNIQUE EVENT KEY
// ========================================

function createEventKey(

  event: PersonalRegistrationEvent,

  registrationId: number,

  recipientUserId: number,

  revision: string

): string {

  return [

    'volunteer',

    event,

    registrationId,

    recipientUserId,

    revision,

  ].join(':');
}

// ========================================
// QUEUE PERSONAL REGISTRATION EVENT
// ========================================

export async function queueVolunteerPersonalRegistrationEvent(

  registrationId: number,

  event: PersonalRegistrationEvent,

  client: PoolClient

): Promise<RegistrationEventSummary> {

  const summary: RegistrationEventSummary = {

    eligible: false,

    recipients: 0,

    created: 0,

    duplicates: 0,
  };

  // ========================================
  // VALIDATE PARAMETERS
  // ========================================

  if (!isValidId(registrationId)) {

    throw new Error(
      'Invalid volunteer registration ID'
    );
  }

  if (
    !Object.prototype.hasOwnProperty.call(
      EVENT_REQUIRED_STATUS,
      event
    )
  ) {

    throw new Error(
      'Invalid personal registration event'
    );
  }

  if (!client) {

    throw new Error(
      'Registration notification requires a database client'
    );
  }

  const requiredStatus =
    EVENT_REQUIRED_STATUS[event];

  // ========================================
  // READ CURRENT REGISTRATION STATE
  // ========================================

  const registrationResult =
    await client.query(
      `
      SELECT

        r.id,

        r.opportunity_id,

        r.user_id,

        r.status,

        clock_timestamp() AS database_now,

        CASE

          WHEN $2::text =
            'registration_submitted'

          THEN FLOOR(

            EXTRACT(
              EPOCH FROM r.created_at
            ) * 1000000

          )::bigint::text

          ELSE FLOOR(

            EXTRACT(
              EPOCH FROM r.reviewed_at
            ) * 1000000

          )::bigint::text

        END AS event_revision

      FROM volunteer_registrations r

      WHERE r.id = $1

      FOR UPDATE
      `,
      [
        registrationId,

        event,
      ]
    );

  if (!registrationResult.rows.length) {

    throw new Error(
      'Volunteer registration not found'
    );
  }

  const registration =
    registrationResult.rows[0];

  if (
    registration.status !== requiredStatus
  ) {

    return summary;
  }

  if (!registration.event_revision) {

    throw new Error(
      'Registration event revision is unavailable'
    );
  }

  summary.eligible = true;

  // ========================================
  // FIND ELIGIBLE RECIPIENTS
  // ========================================

  const recipientResult =
    await client.query(
      `
      SELECT DISTINCT recipient.user_id

      FROM (

        SELECT r.user_id

        FROM volunteer_registrations r

        WHERE r.id = $1

        UNION

        SELECT m.user_id

        FROM volunteer_members m

        WHERE m.registration_id = $1

          AND m.opportunity_id = $2

          AND m.user_id IS NOT NULL

          AND m.status <> 'cancelled'

      ) AS recipient

      JOIN users u
        ON u.id = recipient.user_id

      WHERE recipient.user_id IS NOT NULL

      ORDER BY recipient.user_id ASC
      `,
      [
        registrationId,

        registration.opportunity_id,
      ]
    );

  summary.recipients =
    recipientResult.rows.length;

 // A detached registration may have no remaining
// recipients with an active account.
//
// The registration event is still eligible,
// but no personal notification jobs are required.

if (summary.recipients === 0) {

  return summary;
}

  // ========================================
  // SET NOTIFICATION VALIDITY
  // ========================================

  const scheduledAt =
    new Date(
      registration.database_now
    );

  if (
    !Number.isFinite(
      scheduledAt.getTime()
    )
  ) {

    throw new Error(
      'Invalid notification timestamp'
    );
  }

  // Personal registration notifications
  // remain eligible for up to 24 hours.

  const expiresAt = new Date(

    scheduledAt.getTime() +

    24 * 60 * 60 * 1000
  );

  // ========================================
  // CREATE ONE JOB PER UNIQUE RECIPIENT
  // ========================================

  for (const recipient of recipientResult.rows) {

    const recipientUserId =
      Number(recipient.user_id);

    if (!isValidId(recipientUserId)) {

      throw new Error(
        'Invalid registration notification recipient'
      );
    }

    const eventKey =
      createEventKey(

        event,

        registrationId,

        recipientUserId,

        String(registration.event_revision)
      );

    const queued =
      await enqueueVolunteerNotification(

        {

          eventKey,

          eventType: event,

          opportunityId:
            Number(
              registration.opportunity_id
            ),

          registrationId,

          recipientUserId,

          targetType: 'user',

          scheduledAt,

          expiresAt,

          maxAttempts: 3,

          payload: {

            registrationRevision:
              String(
                registration.event_revision
              ),
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