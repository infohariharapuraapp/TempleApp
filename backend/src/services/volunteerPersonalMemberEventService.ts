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

export type PersonalMemberEvent =
  | 'id_card_issued'
  | 'id_card_revoked'
  | 'accommodation_available';

interface MemberEventSummary {
  eligible: boolean;
  recipients: number;
  created: number;
  duplicates: number;
}

interface GroupedIdCardEventSummary
  extends MemberEventSummary {

  cards: number;
}

interface GroupedIdCardReference {
  cardId: number;
  revision: string;
}

interface GroupedIdCardRecipient {
  registrationIds: Set<number>;
  cards: GroupedIdCardReference[];
}

// ========================================
// CONFIGURATION
// ========================================

const NOTIFICATION_EXPIRY_HOURS = 24;

const MAX_GROUPED_ID_CARDS = 500;

const SUPPORTED_EVENTS =
  new Set<PersonalMemberEvent>([
    'id_card_issued',
    'id_card_revoked',
    'accommodation_available',
  ]);

const ELIGIBLE_MEMBER_STATUSES = [
  'approved',
  'completed',
];

const ELIGIBLE_REGISTRATION_STATUSES = [
  'approved',
  'assigned',
  'in_progress',
  'completed',
];

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
      'Invalid member notification timestamp'
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
// FIND AUTHORIZED RECIPIENTS
// ========================================

async function getAuthorizedRecipients(

  ownerId: number | null,

  memberUserId: number | null,

  client: PoolClient

): Promise<number[]> {

  const candidates = [

    ...new Set([
      Number(ownerId),
      Number(memberUserId),
    ]),

  ].filter(isValidId);

  if (!candidates.length) {

    return [];
  }

  const result = await client.query(
    `
    SELECT id

    FROM users

    WHERE id = ANY($1::integer[])

    ORDER BY id ASC
    `,
    [
      candidates,
    ]
  );

  const recipients = result.rows

    .map(row => Number(row.id))

    .filter(isValidId);

  return recipients;
}

// ========================================
// QUEUE INDIVIDUAL MEMBER EVENT
// ========================================

export async function queueVolunteerPersonalMemberEvent(

  entityId: number,

  event: PersonalMemberEvent,

  client: PoolClient

): Promise<MemberEventSummary> {

  const summary: MemberEventSummary = {

    eligible: false,

    recipients: 0,

    created: 0,

    duplicates: 0,
  };

  // ========================================
  // VALIDATE INPUT
  // ========================================

  if (!isValidId(entityId)) {

    throw new Error(
      'Invalid volunteer member event entity ID'
    );
  }

  if (!SUPPORTED_EVENTS.has(event)) {

    throw new Error(
      'Invalid personal volunteer member event'
    );
  }

  if (!client) {

    throw new Error(
      'Database transaction client is required'
    );
  }

  // ========================================
  // LOAD EVENT ENTITY
  // ========================================

  let result;

  if (event === 'accommodation_available') {

    result = await client.query(
      `
      SELECT

        ac.id AS entity_id,

        ac.opportunity_id,

        ac.member_id,

        m.registration_id,

        m.user_id AS member_user_id,

        m.status AS member_status,

        r.user_id AS registration_owner_id,

        r.status AS registration_status,

        ac.is_visible,

        (
          ac.check_out_at IS NULL

          OR ac.check_out_at >
            clock_timestamp()

        ) AS accommodation_available,

        clock_timestamp() AS database_now,

        FLOOR(

          EXTRACT(
            EPOCH FROM ac.published_at
          ) * 1000000

        )::bigint::text AS event_revision

      FROM volunteer_accommodation ac

      JOIN volunteer_members m

        ON m.id = ac.member_id

        AND m.opportunity_id =
          ac.opportunity_id

      JOIN volunteer_registrations r

        ON r.id = m.registration_id

        AND r.opportunity_id =
          m.opportunity_id

      WHERE ac.id = $1

      FOR UPDATE OF ac
      `,
      [
        entityId,
      ]
    );

  } else {

    result = await client.query(
      `
      SELECT

        c.id AS entity_id,

        c.opportunity_id,

        c.member_id,

        c.status AS card_status,

        m.registration_id,

        m.user_id AS member_user_id,

        m.status AS member_status,

        r.user_id AS registration_owner_id,

        r.status AS registration_status,

        (
          c.valid_until >=
          (
            clock_timestamp()
              AT TIME ZONE 'Asia/Kolkata'
          )::date

        ) AS card_not_expired,

        clock_timestamp() AS database_now,

        CASE

          WHEN $2::text = 'id_card_revoked'

          THEN FLOOR(

            EXTRACT(
              EPOCH FROM c.revoked_at
            ) * 1000000

          )::bigint::text

          ELSE FLOOR(

            EXTRACT(
              EPOCH FROM c.issued_at
            ) * 1000000

          )::bigint::text

        END AS event_revision

      FROM volunteer_id_cards c

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

        entityId,

        event,
      ]
    );
  }

  if (!result.rows.length) {

    throw new Error(
      'Volunteer member event entity not found'
    );
  }

  const entity = result.rows[0];

  // ========================================
  // VALIDATE ENTITY REFERENCES
  // ========================================

  const opportunityId =
    Number(entity.opportunity_id);

  const registrationId =
    Number(entity.registration_id);

  const memberId =
    Number(entity.member_id);

  if (

    !isValidId(opportunityId) ||

    !isValidId(registrationId) ||

    !isValidId(memberId)

  ) {

    throw new Error(
      'Invalid volunteer member event references'
    );
  }

  // ========================================
  // VALIDATE MEMBER ELIGIBILITY
  // ========================================

  // Revocation events are important status
  // changes and preserve existing eligibility.

  if (event !== 'id_card_revoked') {

    if (

      !ELIGIBLE_MEMBER_STATUSES.includes(
        entity.member_status
      ) ||

      !ELIGIBLE_REGISTRATION_STATUSES.includes(
        entity.registration_status
      )

    ) {

      return summary;
    }
  }

  // ========================================
  // VALIDATE EVENT STATUS
  // ========================================

  switch (event) {

    case 'id_card_issued':

      if (

        entity.card_status !== 'active' ||

        entity.card_not_expired !== true

      ) {

        return summary;
      }

      break;

    case 'id_card_revoked':

      if (
        entity.card_status !== 'revoked'
      ) {

        return summary;
      }

      break;

    case 'accommodation_available':

      if (

        entity.is_visible !== true ||

        entity.accommodation_available
          !== true

      ) {

        return summary;
      }

      break;

    default:

      return summary;
  }

  // ========================================
  // VALIDATE EVENT REVISION
  // ========================================

  const revision =
    entity.event_revision;

  if (!isValidRevision(revision)) {

    throw new Error(
      'Invalid volunteer member event revision'
    );
  }

  // ========================================
  // FIND AUTHORIZED RECIPIENTS
  // ========================================

 const recipients =
  await getAuthorizedRecipients(

    entity.registration_owner_id,

    entity.member_user_id,

    client
  );

// ========================================
// HANDLE MISSING AUTHORIZED RECIPIENTS
// ========================================

// A valid member event may have no remaining
// authorized notification recipients.

if (!recipients.length) {

  summary.eligible = true;

  summary.recipients = 0;

  return summary;
}

  // ========================================
  // PREPARE NOTIFICATION TIMING
  // ========================================

  const {
    scheduledAt,
    expiresAt,
  } = getNotificationTiming(
    entity.database_now
  );

  summary.eligible = true;

  summary.recipients =
    recipients.length;

  // ========================================
  // PREPARE EVENT PAYLOAD
  // ========================================

  const payload: Record<string, unknown> =

    event === 'accommodation_available'

      ? {

          accommodationId: entityId,

          accommodationRevision: revision,
        }

      : {

          cardId: entityId,

          cardRevision: revision,
        };

  // ========================================
  // QUEUE ONE JOB PER RECIPIENT
  // ========================================

  for (const recipientUserId of recipients) {

  // ========================================
  // RESERVE INDIVIDUAL ID CARD ISSUANCE
  // ========================================

  let reservationIds: string[] = [];

  if (event === 'id_card_issued') {

    const reservation =
      await reserveVolunteerEventEntities(

        'id_card_issued',

        recipientUserId,

        [
          {
            entityId,
            revision,
          },
        ],

        client
      );

    if (!reservation.reserved.length) {

      summary.duplicates++;

      continue;
    }

    reservationIds =
      reservation.reserved.map(

        reference =>
          reference.reservationId
      );
  }

  const eventKey = [

      'volunteer',

      event,

      entityId,

      recipientUserId,

      revision,

    ].join(':');

    const queued =
      await enqueueVolunteerNotification(

        {

          eventKey,

          eventType: event,

          opportunityId,

          registrationId,

          memberId,

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

   if (queued.created) {

  if (reservationIds.length) {

    if (!queued.job) {

      throw new Error(
        'Volunteer ID card notification job was not returned'
      );
    }

    await linkVolunteerEventEntities(

      queued.job.id,

      'id_card_issued',

      recipientUserId,

      reservationIds,

      client
    );
  }

  summary.created++;

} else {

  // Newly reserved references must not
  // remain unlinked after transaction commit.

  if (reservationIds.length) {

    throw new Error(
      'Reserved ID card notification job already exists'
    );
  }

  summary.duplicates++;
}
  }

  return summary;
}

// ========================================
// QUEUE GROUPED ID CARD ISSUANCE
// ========================================

export async function queueVolunteerPersonalIdCardEvents(

  cardIds: number[],

  client: PoolClient

): Promise<GroupedIdCardEventSummary> {

  const summary: GroupedIdCardEventSummary = {

    eligible: false,

    cards: 0,

    recipients: 0,

    created: 0,

    duplicates: 0,
  };

  // ========================================
  // VALIDATE INPUT
  // ========================================

  if (!client) {

    throw new Error(
      'Database transaction client is required'
    );
  }

  if (

    !Array.isArray(cardIds) ||

    !cardIds.length ||

    cardIds.length > MAX_GROUPED_ID_CARDS ||

    !cardIds.every(isValidId)

  ) {

    throw new Error(
      'Invalid grouped volunteer ID card IDs'
    );
  }

  const uniqueCardIds = [

    ...new Set(cardIds),

  ].sort((a, b) => a - b);

  // ========================================
  // LOAD CURRENT ID CARD RECORDS
  // ========================================

  const result = await client.query(
    `
    SELECT

      c.id AS card_id,

      c.opportunity_id,

      c.member_id,

      m.registration_id,

      m.user_id AS member_user_id,

      r.user_id AS registration_owner_id,

      clock_timestamp() AS database_now,

      FLOOR(

        EXTRACT(
          EPOCH FROM c.issued_at
        ) * 1000000

      )::bigint::text AS event_revision

    FROM volunteer_id_cards c

    JOIN volunteer_members m

      ON m.id = c.member_id

      AND m.opportunity_id =
        c.opportunity_id

    JOIN volunteer_registrations r

      ON r.id = m.registration_id

      AND r.opportunity_id =
        m.opportunity_id

    WHERE c.id = ANY($1::integer[])

      AND c.status = 'active'

      AND c.valid_until >=
        (
          clock_timestamp()
            AT TIME ZONE 'Asia/Kolkata'
        )::date

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

    ORDER BY c.id ASC

    FOR UPDATE OF c
    `,
    [
      uniqueCardIds,
    ]
  );

  if (

    result.rows.length !==
      uniqueCardIds.length

  ) {

    throw new Error(
      'One or more volunteer ID cards are not eligible'
    );
  }

  // ========================================
  // VALIDATE OPPORTUNITY
  // ========================================

  const opportunityIds = new Set<number>(

    result.rows.map(

      row => Number(
        row.opportunity_id
      )
    )
  );

  if (opportunityIds.size !== 1) {

    throw new Error(
      'Grouped ID cards must belong to the same opportunity'
    );
  }

  const opportunityId =
    [...opportunityIds][0];

  if (!isValidId(opportunityId)) {

    throw new Error(
      'Invalid volunteer opportunity ID'
    );
  }

  // ========================================
  // COLLECT POTENTIAL RECIPIENTS
  // ========================================

  const candidateUserIds =
    new Set<number>();

  for (const row of result.rows) {

    const ownerId =
      Number(row.registration_owner_id);

    const memberUserId =
      Number(row.member_user_id);

    if (isValidId(ownerId)) {

      candidateUserIds.add(ownerId);
    }

    if (isValidId(memberUserId)) {

      candidateUserIds.add(memberUserId);
    }
  }



  // ========================================
  // VERIFY RECIPIENT USERS
  // ========================================

  const userResult = await client.query(
    `
    SELECT id

    FROM users

    WHERE id = ANY($1::integer[])
    `,
    [
      [...candidateUserIds],
    ]
  );

  const validUserIds = new Set<number>(

    userResult.rows

      .map(row => Number(row.id))

      .filter(isValidId)
  );

  // ========================================
  // GROUP ID CARDS BY RECIPIENT
  // ========================================

  const recipients = new Map<

    number,

    GroupedIdCardRecipient

  >();

  for (const row of result.rows) {

    const cardId =
      Number(row.card_id);

    const registrationId =
      Number(row.registration_id);

    const memberId =
      Number(row.member_id);

    const revision =
      row.event_revision;

    if (

      !isValidId(cardId) ||

      !isValidId(registrationId) ||

      !isValidId(memberId) ||

      !isValidRevision(revision)

    ) {

      throw new Error(
        'Invalid grouped ID card reference'
      );
    }

    const cardRecipients = [

      ...new Set([

        Number(
          row.registration_owner_id
        ),

        Number(
          row.member_user_id
        ),
      ]),

    ].filter(

      userId =>

        isValidId(userId) &&

        validUserIds.has(userId)
    );

   // Skip notification creation for this card
// when no authorized recipient account exists.

if (!cardRecipients.length) {

  continue;
}

    for (const userId of cardRecipients) {

      if (!recipients.has(userId)) {

        recipients.set(userId, {

          registrationIds:
            new Set<number>(),

          cards: [],
        });
      }

      const recipient =
        recipients.get(userId)!;

      recipient.registrationIds.add(
        registrationId
      );

      recipient.cards.push({

        cardId,

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

  summary.cards =
    uniqueCardIds.length;

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

    // Deterministic ID card ordering.

   // ========================================
// RESERVE UNIQUE ID CARD REVISIONS
// ========================================

const reservation =
  await reserveVolunteerEventEntities(

    'id_card_issued',

    recipientUserId,

    recipient.cards.map(

      reference => ({

        entityId:
          reference.cardId,

        revision:
          reference.revision,
      })
    ),

    client
  );

// All card revisions have already been
// included in previous notifications.

if (!reservation.reserved.length) {

  summary.duplicates++;

  continue;
}

// ========================================
// BUILD FILTERED ID CARD PAYLOAD
// ========================================

const cards =
  reservation.reserved

    .map(reference => ({

      cardId:
        reference.entityId,

      revision:
        reference.revision,
    }))

    .sort(

      (a, b) =>
        a.cardId - b.cardId
    );

// ========================================
// RECALCULATE REGISTRATION REFERENCES
// ========================================

const reservedCardIds =
  new Set<number>(

    cards.map(

      reference =>
        reference.cardId
    )
  );

const registrationIds = [

  ...new Set<number>(

    result.rows

      .filter(row =>

        reservedCardIds.has(

          Number(row.card_id)
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
    // GENERATE DETERMINISTIC EVENT HASH
    // ========================================

    const eventHash = createHash(
      'sha256'
    )

      .update(
        JSON.stringify(cards)
      )

      .digest('hex');

    const eventKey = [

      'volunteer',

      'id_card_issued',

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

          eventType: 'id_card_issued',

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

          payload: {

            bulkIdCard: true,

            cards,
          },
        },

        client
      );

   if (!queued.created || !queued.job) {

  throw new Error(
    'Failed to create reserved grouped ID card notification job'
  );
}

// ========================================
// LINK RESERVED ID CARD REFERENCES
// ========================================

await linkVolunteerEventEntities(

  queued.job.id,

  'id_card_issued',

  recipientUserId,

  reservationIds,

  client
);

summary.created++;
  }

  return summary;
}
