import { createHash } from 'crypto';
import { PoolClient } from 'pg';

import {
  enqueueVolunteerNotification,
} from './volunteerNotificationQueueService';

import {
  reserveVolunteerEventEntities,
  linkVolunteerEventEntities,
} from './volunteerNotificationEntityService';

// ========================================
// TYPES
// ========================================

export type PersonalCompletionEvent =
  | 'service_completed'
  | 'certificate_issued'
  | 'certificate_revoked';

type GroupedCompletionEvent =
  | 'service_completed'
  | 'certificate_issued';

interface CompletionEventSummary {
  eligible: boolean;
  recipients: number;
  created: number;
  duplicates: number;
}

interface GroupedCompletionEventSummary
  extends CompletionEventSummary {
  entities: number;
}

interface CompletionReference {
  entityId: number;
  revision: string;
}

interface GroupedRecipient {
  registrationIds: Set<number>;
  references: CompletionReference[];
}

// ========================================
// CONFIGURATION
// ========================================

const NOTIFICATION_EXPIRY_HOURS = 24;

const MAX_COMPLETION_MEMBERS = 500;

const MAX_CERTIFICATE_ISSUANCE = 200;

// ========================================
// VALIDATE ID
// ========================================

function isValidId(
  value: unknown
): value is number {

  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value > 0 &&
    value <= 2147483647
  );
}

// ========================================
// VALIDATE REVISION
// ========================================

function isValidRevision(
  value: unknown
): value is string {

  return (
    typeof value === 'string' &&
    /^[1-9]\d{0,18}$/.test(value)
  );
}

// ========================================
// VALIDATE TRANSACTION CLIENT
// ========================================

function validateClient(
  client: PoolClient
): void {

  if (
    !client ||
    typeof client.query !== 'function'
  ) {

    throw new Error(
      'Database transaction client is required'
    );
  }
}

// ========================================
// PREPARE NOTIFICATION TIMING
// ========================================

function getNotificationTiming(
  databaseNow: string | Date
) {

  const scheduledAt =
    new Date(databaseNow);

  if (
    !Number.isFinite(
      scheduledAt.getTime()
    )
  ) {

    throw new Error(
      'Invalid volunteer completion event timestamp'
    );
  }

  const expiresAt = new Date(

    scheduledAt.getTime() +

    NOTIFICATION_EXPIRY_HOURS *
      60 * 60 * 1000
  );

  return {
    scheduledAt,
    expiresAt,
  };
}

// ========================================
// COLLECT RECIPIENT CANDIDATES
// ========================================

function getRecipientCandidates(

  ownerId: number | null,

  memberUserId: number | null

): number[] {

  return [

    ...new Set([

      Number(ownerId),

      Number(memberUserId),

    ]),

  ].filter(isValidId);
}

// ========================================
// VERIFY RECIPIENT USERS
// ========================================

async function getExistingUserIds(

  candidateIds: number[],

  client: PoolClient

): Promise<Set<number>> {

  if (!candidateIds.length) {

    return new Set<number>();
  }

  const result = await client.query(
    `
    SELECT id

    FROM users

    WHERE id = ANY($1::integer[])
    `,
    [
      [...new Set(candidateIds)],
    ]
  );

  return new Set<number>(

    result.rows

      .map(row => Number(row.id))

      .filter(isValidId)
  );
}

// ========================================
// QUEUE GROUPED COMPLETION EVENT
// ========================================

async function queueGroupedCompletionEvent(

  entityIds: number[],

  event: GroupedCompletionEvent,

  client: PoolClient

): Promise<GroupedCompletionEventSummary> {

  validateClient(client);

  const summary: GroupedCompletionEventSummary = {

    eligible: false,

    entities: 0,

    recipients: 0,

    created: 0,

    duplicates: 0,
  };

  // ========================================
  // VALIDATE EVENT
  // ========================================

  if (

    event !== 'service_completed' &&

    event !== 'certificate_issued'

  ) {

    throw new Error(
      'Invalid grouped completion event'
    );
  }

  const maximumEntities =

    event === 'service_completed'

      ? MAX_COMPLETION_MEMBERS

      : MAX_CERTIFICATE_ISSUANCE;

  // ========================================
  // VALIDATE ENTITY IDS
  // ========================================

  if (

    !Array.isArray(entityIds) ||

    !entityIds.length ||

    entityIds.length > maximumEntities ||

    !entityIds.every(isValidId)

  ) {

    throw new Error(
      'Invalid grouped completion event entity IDs'
    );
  }

  const uniqueEntityIds = [

    ...new Set(entityIds),

  ].sort((a, b) => a - b);

  // ========================================
  // LOAD CURRENT EVENT ENTITIES
  // ========================================

  let result;

  if (event === 'service_completed') {

    result = await client.query(
      `
      SELECT

        m.id AS entity_id,

        m.id AS member_id,

        m.opportunity_id,

        m.registration_id,

        m.user_id AS member_user_id,

        r.user_id AS registration_owner_id,

        clock_timestamp() AS database_now,

        FLOOR(

          EXTRACT(
            EPOCH FROM m.completed_at
          ) * 1000000

        )::bigint::text AS event_revision

      FROM volunteer_members m

      JOIN volunteer_registrations r

        ON r.id = m.registration_id

        AND r.opportunity_id =
          m.opportunity_id

      WHERE m.id = ANY($1::integer[])

        AND m.status = 'completed'

        AND m.completed_at IS NOT NULL

        AND r.status IN (

          'approved',

          'assigned',

          'in_progress',

          'completed'
        )

      ORDER BY m.id ASC

      FOR UPDATE OF m
      `,
      [
        uniqueEntityIds,
      ]
    );

  } else {

    result = await client.query(
      `
      SELECT

        c.id AS entity_id,

        c.member_id,

        c.opportunity_id,

        m.registration_id,

        m.user_id AS member_user_id,

        r.user_id AS registration_owner_id,

        clock_timestamp() AS database_now,

        FLOOR(

          EXTRACT(
            EPOCH FROM c.issued_at
          ) * 1000000

        )::bigint::text AS event_revision

      FROM volunteer_certificates c

      JOIN volunteer_members m

        ON m.id = c.member_id

        AND m.opportunity_id =
          c.opportunity_id

      JOIN volunteer_registrations r

        ON r.id = m.registration_id

        AND r.opportunity_id =
          m.opportunity_id

      WHERE c.id = ANY($1::integer[])

        AND c.status = 'issued'

        AND c.issued_at IS NOT NULL

        AND m.status = 'completed'

        AND r.status IN (

          'approved',

          'assigned',

          'in_progress',

          'completed'
        )

      ORDER BY c.id ASC

      FOR UPDATE OF c
      `,
      [
        uniqueEntityIds,
      ]
    );
  }

  // ========================================
  // VERIFY ALL REQUESTED ENTITIES
  // ========================================

  if (

    result.rows.length !==
      uniqueEntityIds.length

  ) {

    throw new Error(
      'One or more completion event entities are not eligible'
    );
  }

  // ========================================
  // VALIDATE OPPORTUNITY
  // ========================================

  const opportunityIds = new Set<number>(

    result.rows.map(

      row => Number(row.opportunity_id)
    )
  );

  if (opportunityIds.size !== 1) {

    throw new Error(
      'Grouped completion events must belong to the same opportunity'
    );
  }

  const opportunityId =
    [...opportunityIds][0];

  if (!isValidId(opportunityId)) {

    throw new Error(
      'Invalid completion event opportunity ID'
    );
  }

  // ========================================
  // COLLECT POTENTIAL RECIPIENTS
  // ========================================

  const candidateUserIds =
    new Set<number>();

  for (const row of result.rows) {

    const candidates =
      getRecipientCandidates(

        row.registration_owner_id,

        row.member_user_id
      );

    for (const userId of candidates) {

      candidateUserIds.add(userId);
    }
  }

  const existingUserIds =
    await getExistingUserIds(

      [...candidateUserIds],

      client
    );

  // ========================================
  // GROUP ENTITIES BY RECIPIENT
  // ========================================

  const recipients = new Map<

    number,

    GroupedRecipient

  >();

  for (const row of result.rows) {

    const entityId =
      Number(row.entity_id);

    const registrationId =
      Number(row.registration_id);

    const memberId =
      Number(row.member_id);

    const revision =
      row.event_revision;

    if (

      !isValidId(entityId) ||

      !isValidId(registrationId) ||

      !isValidId(memberId) ||

      !isValidRevision(revision)

    ) {

      throw new Error(
        'Invalid grouped completion event reference'
      );
    }

    const authorizedRecipients =

      getRecipientCandidates(

        row.registration_owner_id,

        row.member_user_id

      ).filter(

        userId =>
          existingUserIds.has(userId)
      );

   // Continue processing eligible completion events
// even when an entity has no authorized recipients.

if (!authorizedRecipients.length) {

  continue;
}

    for (

      const userId of authorizedRecipients

    ) {

      if (!recipients.has(userId)) {

        recipients.set(userId, {

          registrationIds:
            new Set<number>(),

          references: [],
        });
      }

      const recipient =
        recipients.get(userId)!;

      recipient.registrationIds.add(
        registrationId
      );

      recipient.references.push({

        entityId,

        revision,
      });
    }
  }

  // ========================================
  // PREPARE NOTIFICATION TIMING
  // ========================================

  const {

    scheduledAt,

    expiresAt,

  } = getNotificationTiming(

    result.rows[0].database_now
  );

  summary.eligible = true;

  summary.entities =
    uniqueEntityIds.length;

  summary.recipients =
    recipients.size;

  // ========================================
  // CREATE ONE JOB PER RECIPIENT
  // ========================================

  const sortedRecipients = [

    ...recipients.entries(),

  ].sort(

    (a, b) => a[0] - b[0]
  );

  for (

    const [recipientUserId, recipient]

    of sortedRecipients

  ) {

   // ========================================
// RESERVE UNIQUE COMPLETION EVENT REVISIONS
// ========================================

const reservation =
  await reserveVolunteerEventEntities(

    event,

    recipientUserId,

    recipient.references,

    client
  );

// All requested entity revisions have
// already been included in notifications.

if (!reservation.reserved.length) {

  summary.duplicates++;

  continue;
}

// ========================================
// BUILD FILTERED ENTITY REFERENCES
// ========================================

const references: CompletionReference[] =
  reservation.reserved

    .map(reference => ({

      entityId:
        reference.entityId,

      revision:
        reference.revision,
    }))

    .sort(

      (a, b) =>
        a.entityId - b.entityId
    );

// ========================================
// RECALCULATE REGISTRATION REFERENCES
// ========================================

const reservedEntityIds =
  new Set<number>(

    references.map(

      reference =>
        reference.entityId
    )
  );

const registrationIds = [

  ...new Set<number>(

    result.rows

      .filter(row =>

        reservedEntityIds.has(

          Number(row.entity_id)
        )
      )

      .map(row =>

        Number(row.registration_id)
      )
  ),

].sort((a, b) => a - b);

// ========================================
// COLLECT RESERVED ENTITY RECORD IDS
// ========================================

const reservationIds =
  reservation.reserved.map(

    reference =>
      reference.reservationId
  );
    // ========================================
    // PREPARE EVENT-SPECIFIC PAYLOAD
    // ========================================

    const payload: Record<string, unknown> =

      event === 'service_completed'

        ? {

            bulkServiceCompletion: true,

            members: references.map(

              reference => ({

                memberId:
                  reference.entityId,

                revision:
                  reference.revision,
              })
            ),
          }

        : {

            bulkCertificate: true,

            certificates: references.map(

              reference => ({

                certificateId:
                  reference.entityId,

                revision:
                  reference.revision,
              })
            ),
          };

    // ========================================
    // GENERATE DETERMINISTIC EVENT KEY
    // ========================================

    const eventHash = createHash(
      'sha256'
    )

      .update(
        JSON.stringify(references)
      )

      .digest('hex');

    const eventKey = [

      'volunteer',

      event,

      'bulk',

      opportunityId,

      recipientUserId,

      eventHash,

    ].join(':');

    // ========================================
    // INSERT GROUPED NOTIFICATION JOB
    // ========================================

    const queued =
      await enqueueVolunteerNotification(

        {

          eventKey,

          eventType: event,

          opportunityId,

          registrationId:

            registrationIds.length === 1

              ? registrationIds[0]

              : null,

          memberId: null,

          assignmentId: null,

          recipientUserId,

          targetType: 'user',

          scheduledAt,

          expiresAt,

          maxAttempts: 3,

          payload,
        },

        client
      );

   // ========================================
// VERIFY GROUPED NOTIFICATION JOB
// ========================================

if (!queued.created || !queued.job) {

  throw new Error(

    `Failed to create reserved grouped ${event} notification job`
  );
}

// ========================================
// LINK RESERVED COMPLETION EVENT REFERENCES
// ========================================

await linkVolunteerEventEntities(

  queued.job.id,

  event,

  recipientUserId,

  reservationIds,

  client
);

summary.created++;
  }

  return summary;
}

// ========================================
// 1. QUEUE SERVICE COMPLETION EVENTS
// ========================================

export async function queueVolunteerServiceCompletedEvents(

  memberIds: number[],

  client: PoolClient

): Promise<GroupedCompletionEventSummary> {

  return queueGroupedCompletionEvent(

    memberIds,

    'service_completed',

    client
  );
}

// ========================================
// 2. QUEUE CERTIFICATE ISSUANCE EVENTS
// ========================================

export async function queueVolunteerCertificateIssuedEvents(

  certificateIds: number[],

  client: PoolClient

): Promise<GroupedCompletionEventSummary> {

  return queueGroupedCompletionEvent(

    certificateIds,

    'certificate_issued',

    client
  );
}

// ========================================
// 3. QUEUE CERTIFICATE REVOCATION EVENT
// ========================================

export async function queueVolunteerCertificateRevokedEvent(

  certificateId: number,

  client: PoolClient

): Promise<CompletionEventSummary> {

  validateClient(client);

  const summary: CompletionEventSummary = {

    eligible: false,

    recipients: 0,

    created: 0,

    duplicates: 0,
  };

  // ========================================
  // VALIDATE CERTIFICATE ID
  // ========================================

  if (!isValidId(certificateId)) {

    throw new Error(
      'Invalid volunteer certificate ID'
    );
  }

  // ========================================
  // LOAD CURRENT CERTIFICATE
  // ========================================

  const result = await client.query(
    `
    SELECT

      c.id AS certificate_id,

      c.opportunity_id,

      c.member_id,

      c.status AS certificate_status,

      c.issued_at,

      m.registration_id,

      m.user_id AS member_user_id,

      r.user_id AS registration_owner_id,

      clock_timestamp() AS database_now,

      FLOOR(

        EXTRACT(
          EPOCH FROM c.revoked_at
        ) * 1000000

      )::bigint::text AS event_revision

    FROM volunteer_certificates c

    JOIN volunteer_members m

      ON m.id = c.member_id

      AND m.opportunity_id =
        c.opportunity_id

    JOIN volunteer_registrations r

      ON r.id = m.registration_id

      AND r.opportunity_id =
        m.opportunity_id

    WHERE c.id = $1

    FOR UPDATE OF c
    `,
    [
      certificateId,
    ]
  );

  if (!result.rows.length) {

    throw new Error(
      'Volunteer certificate not found'
    );
  }

  const certificate =
    result.rows[0];

  // ========================================
  // VERIFY REVOCATION STATUS
  // ========================================

  if (

    certificate.certificate_status
      !== 'revoked'

  ) {

    return summary;
  }

  // ========================================
  // DO NOT NOTIFY UNPUBLISHED DRAFTS
  // ========================================

  if (!certificate.issued_at) {

    return summary;
  }

  // ========================================
  // VALIDATE REFERENCES
  // ========================================

  const opportunityId =
    Number(certificate.opportunity_id);

  const registrationId =
    Number(certificate.registration_id);

  const memberId =
    Number(certificate.member_id);

  const revision =
    certificate.event_revision;

  if (

    !isValidId(opportunityId) ||

    !isValidId(registrationId) ||

    !isValidId(memberId) ||

    !isValidRevision(revision)

  ) {

    throw new Error(
      'Invalid certificate revocation event references'
    );
  }

  // ========================================
  // FIND AUTHORIZED RECIPIENTS
  // ========================================

  const candidates =
    getRecipientCandidates(

      certificate.registration_owner_id,

      certificate.member_user_id
    );

  const existingUserIds =
    await getExistingUserIds(

      candidates,

      client
    );

  const recipients = [

    ...existingUserIds,

  ].sort((a, b) => a - b);

  // ========================================
  // ALLOW REVOCATION WITHOUT RECIPIENTS
  // ========================================

  summary.eligible = true;

  summary.recipients =
    recipients.length;

  if (!recipients.length) {

    return summary;
  }

  // ========================================
  // PREPARE NOTIFICATION TIMING
  // ========================================

  const {

    scheduledAt,

    expiresAt,

  } = getNotificationTiming(

    certificate.database_now
  );

  // ========================================
  // CREATE ONE JOB PER RECIPIENT
  // ========================================

  for (const recipientUserId of recipients) {

    const eventKey = [

      'volunteer',

      'certificate_revoked',

      certificateId,

      recipientUserId,

      revision,

    ].join(':');

    const queued =
      await enqueueVolunteerNotification(

        {

          eventKey,

          eventType: 'certificate_revoked',

          opportunityId,

          registrationId,

          memberId,

          assignmentId: null,

          recipientUserId,

          targetType: 'user',

          scheduledAt,

          expiresAt,

          maxAttempts: 3,

          payload: {

            certificateId,

            certificateRevision: revision,
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