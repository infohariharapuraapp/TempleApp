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

export type PersonalDutyEvent =
  | 'duty_assigned'
  | 'duty_reassigned'
  | 'duty_cancelled';

interface DutyEventSummary {
  eligible: boolean;
  recipients: number;
  created: number;
  duplicates: number;
}

// ========================================
// CONFIGURATION
// ========================================

const EVENT_REQUIRED_STATUS:
  Record<PersonalDutyEvent, string> = {

    duty_assigned: 'assigned',

    duty_reassigned: 'assigned',

    duty_cancelled: 'cancelled',
  };

const NOTIFICATION_EXPIRY_HOURS = 24;

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
// QUEUE PERSONAL DUTY EVENT
// ========================================

export async function queueVolunteerPersonalDutyEvent(

  assignmentId: number,

  event: PersonalDutyEvent,

  client: PoolClient

): Promise<DutyEventSummary> {

  const summary: DutyEventSummary = {

    eligible: false,

    recipients: 0,

    created: 0,

    duplicates: 0,
  };

  // ========================================
  // VALIDATE INPUT
  // ========================================

  if (!isValidId(assignmentId)) {

    throw new Error(
      'Invalid volunteer assignment ID'
    );
  }

  if (
    !Object.prototype.hasOwnProperty.call(
      EVENT_REQUIRED_STATUS,
      event
    )
  ) {

    throw new Error(
      'Invalid personal duty event'
    );
  }

  if (!client) {

    throw new Error(
      'Database transaction client is required'
    );
  }

  // ========================================
  // LOAD CURRENT ASSIGNMENT
  // ========================================

  const result = await client.query(
    `
    SELECT

      a.id AS assignment_id,

      a.opportunity_id,

      a.member_id,

      a.status AS assignment_status,

      m.registration_id,

      m.user_id AS member_user_id,

      m.status AS member_status,

      r.user_id AS registration_owner_id,

      r.status AS registration_status,

      s.is_active AS shift_active,

      clock_timestamp() AS database_now,

      CASE

        WHEN $2::text = 'duty_cancelled'

        THEN FLOOR(

          EXTRACT(
            EPOCH FROM a.updated_at
          ) * 1000000

        )::bigint::text

        ELSE FLOOR(

          EXTRACT(
            EPOCH FROM a.assigned_at
          ) * 1000000

        )::bigint::text

      END AS event_revision

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

    WHERE a.id = $1

    FOR UPDATE OF a
    `,
    [
      assignmentId,

      event,
    ]
  );

  if (!result.rows.length) {

    throw new Error(
      'Volunteer assignment not found'
    );
  }

  const assignment = result.rows[0];

  // ========================================
  // VALIDATE ASSIGNMENT STATUS
  // ========================================

  if (
    assignment.assignment_status !==
      EVENT_REQUIRED_STATUS[event]
  ) {

    return summary;
  }

  // ========================================
  // VALIDATE MEMBER AND REGISTRATION
  // ========================================

  if (

    assignment.member_status ===
      'cancelled' ||

    assignment.registration_status ===
      'cancelled'

  ) {

    return summary;
  }

  // Assignment and reassignment events require
  // an approved member and eligible registration.

  if (event !== 'duty_cancelled') {

    if (

      assignment.member_status !==
        'approved' ||

      ![
        'approved',
        'assigned',
        'in_progress',
      ].includes(
        assignment.registration_status
      ) ||

      assignment.shift_active !== true

    ) {

      return summary;
    }
  }

  // ========================================
  // VALIDATE EVENT REVISION
  // ========================================

  const revision =
    assignment.event_revision;

  if (

    typeof revision !== 'string' ||

    !/^[1-9]\d{0,18}$/.test(revision)

  ) {

    throw new Error(
      'Invalid volunteer assignment revision'
    );
  }

  // ========================================
  // FIND AUTHORIZED RECIPIENTS
  // ========================================

  const recipientResult =
    await client.query(
      `
      SELECT DISTINCT u.id AS user_id

      FROM users u

      WHERE u.id IN (
        $1::integer,
        $2::integer
      )

      ORDER BY u.id ASC
      `,
      [

        assignment.registration_owner_id,

        assignment.member_user_id,
      ]
    );

  const recipients = recipientResult.rows
    .map(row => Number(row.user_id))
    .filter(isValidId);

// A valid duty event may have no remaining
// recipients with an existing user account.

if (!recipients.length) {

  summary.eligible = true;

  summary.recipients = 0;

  return summary;
}

  // ========================================
  // PREPARE NOTIFICATION TIMING
  // ========================================

  const scheduledAt = new Date(
    assignment.database_now
  );

  if (
    !Number.isFinite(
      scheduledAt.getTime()
    )
  ) {

    throw new Error(
      'Invalid database notification timestamp'
    );
  }

  const expiresAt = new Date(

    scheduledAt.getTime() +

    NOTIFICATION_EXPIRY_HOURS *
      60 * 60 * 1000

  );

  summary.eligible = true;

  summary.recipients =
    recipients.length;

  // ========================================
  // QUEUE RECIPIENT NOTIFICATIONS
  // ========================================

  for (const recipientUserId of recipients) {

  // ========================================
  // RESERVE INDIVIDUAL DUTY ASSIGNMENT EVENT
  // ========================================

  let reservationIds: string[] = [];

  if (event === 'duty_assigned') {

    const reservation =
      await reserveVolunteerEventEntities(

        'duty_assigned',

        recipientUserId,

        [
          {
            entityId: assignmentId,
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

      assignmentId,

      recipientUserId,

      revision,

    ].join(':');

    const queued =
      await enqueueVolunteerNotification(

        {

          eventKey,

          eventType: event,

          opportunityId:
            Number(
              assignment.opportunity_id
            ),

          registrationId:
            Number(
              assignment.registration_id
            ),

          memberId:
            Number(
              assignment.member_id
            ),

          assignmentId,

          recipientUserId,

          targetType: 'user',

          scheduledAt,

          expiresAt,

          maxAttempts: 3,

          payload: {

            assignmentRevision:
              revision,
          },
        },

        client

      );

    if (queued.created) {

  if (reservationIds.length) {

    if (!queued.job) {

      throw new Error(
        'Volunteer duty notification job was not returned'
      );
    }

    await linkVolunteerEventEntities(

      queued.job.id,

      'duty_assigned',

      recipientUserId,

      reservationIds,

      client
    );
  }

  summary.created++;

} else {

  // Newly reserved references must never
  // be committed without an associated job.

  if (reservationIds.length) {

    throw new Error(
      'Reserved duty assignment notification job already exists'
    );
  }

  summary.duplicates++;
}
  }

  return summary;
}

// ========================================
// GROUPED DUTY ASSIGNMENT TYPES
// ========================================

interface GroupedAssignmentReference {

  assignmentId: number;

  revision: string;
}

interface GroupedDutyRecipient {

  registrationIds: Set<number>;

  assignments: GroupedAssignmentReference[];
}

interface GroupedDutyEventSummary {

  eligible: boolean;

  assignments: number;

  recipients: number;

  created: number;

  duplicates: number;
}

// ========================================
// CONFIGURATION
// ========================================

const MAX_GROUPED_ASSIGNMENTS = 500;

// ========================================
// QUEUE GROUPED DUTY ASSIGNMENTS
// ========================================

export async function queueVolunteerPersonalDutyEvents(

  assignmentIds: number[],

  client: PoolClient

): Promise<GroupedDutyEventSummary> {

  const summary: GroupedDutyEventSummary = {

    eligible: false,

    assignments: 0,

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

    !Array.isArray(assignmentIds) ||

    !assignmentIds.length ||

    assignmentIds.length >
      MAX_GROUPED_ASSIGNMENTS ||

    !assignmentIds.every(isValidId)

  ) {

    throw new Error(
      'Invalid grouped volunteer assignment IDs'
    );
  }

  const uniqueAssignmentIds = [

    ...new Set(assignmentIds),

  ].sort((a, b) => a - b);

  // ========================================
  // LOAD ELIGIBLE ASSIGNMENTS
  // ========================================

  const result = await client.query(
    `
    SELECT

      a.id AS assignment_id,

      a.opportunity_id,

      m.registration_id,

      m.user_id AS member_user_id,

      r.user_id AS registration_owner_id,

      clock_timestamp() AS database_now,

      FLOOR(

        EXTRACT(
          EPOCH FROM a.assigned_at
        ) * 1000000

      )::bigint::text AS event_revision

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

    WHERE a.id = ANY($1::integer[])

      AND a.status = 'assigned'

      AND m.status = 'approved'

      AND r.status IN (

        'approved',

        'assigned',

        'in_progress'
      )

      AND s.is_active = TRUE

    ORDER BY a.id ASC

    FOR UPDATE OF a
    `,
    [
      uniqueAssignmentIds,
    ]
  );

  // Every requested assignment must exist
  // and must remain eligible.

  if (

    result.rows.length !==
      uniqueAssignmentIds.length

  ) {

    throw new Error(
      'One or more volunteer assignments are not eligible'
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
      'Grouped assignments must belong to the same opportunity'
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
  // GROUP ASSIGNMENTS BY RECIPIENT
  // ========================================

  const recipients = new Map<

    number,

    GroupedDutyRecipient

  >();

  for (const row of result.rows) {

    const assignmentId =
      Number(row.assignment_id);

    const registrationId =
      Number(row.registration_id);

    const revision =
      row.event_revision;

    // Validate assignment reference.

    if (

      !isValidId(assignmentId) ||

      !isValidId(registrationId) ||

      typeof revision !== 'string' ||

      !/^[1-9]\d{0,18}$/.test(revision)

    ) {

      throw new Error(
        'Invalid grouped assignment reference'
      );
    }

    // Deduplicate owner and member.

    const assignmentRecipients = [

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

 // This assignment has no authorized recipients.
// Continue processing other eligible assignments
// without rolling back the entire bulk operation.

if (!assignmentRecipients.length) {

  continue;
}

    for (

      const userId of assignmentRecipients

    ) {

      if (!recipients.has(userId)) {

        recipients.set(userId, {

          registrationIds:
            new Set<number>(),

          assignments: [],
        });
      }

      const recipient =
        recipients.get(userId)!;

      recipient.registrationIds.add(
        registrationId
      );

      recipient.assignments.push({

        assignmentId,

        revision,
      });
    }
  }

  // ========================================
  // PREPARE NOTIFICATION TIMING
  // ========================================

  const scheduledAt = new Date(

    result.rows[0].database_now
  );

  if (

    !Number.isFinite(
      scheduledAt.getTime()
    )

  ) {

    throw new Error(
      'Invalid grouped notification timestamp'
    );
  }

  const expiresAt = new Date(

    scheduledAt.getTime() +

    NOTIFICATION_EXPIRY_HOURS *
      60 * 60 * 1000
  );

  summary.eligible = true;

  summary.assignments =
    uniqueAssignmentIds.length;

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

    // Deterministic assignment ordering.

   // ========================================
// RESERVE UNIQUE ASSIGNMENT REVISIONS
// ========================================

const reservation =
  await reserveVolunteerEventEntities(

    'duty_assigned',

    recipientUserId,

    recipient.assignments.map(

      reference => ({

        entityId:
          reference.assignmentId,

        revision:
          reference.revision,
      })
    ),

    client
  );

// All assignment revisions have already
// been included in previous notifications.

if (!reservation.reserved.length) {

  summary.duplicates++;

  continue;
}

// ========================================
// BUILD FILTERED ASSIGNMENT PAYLOAD
// ========================================

const assignments =
  reservation.reserved

    .map(reference => ({

      assignmentId:
        reference.entityId,

      revision:
        reference.revision,
    }))

    .sort(

      (a, b) =>
        a.assignmentId - b.assignmentId
    );

// ========================================
// RECALCULATE REGISTRATION REFERENCES
// ========================================

const reservedAssignmentIds =
  new Set<number>(

    assignments.map(

      reference =>
        reference.assignmentId
    )
  );

const registrationIds = [

  ...new Set<number>(

    result.rows

      .filter(row =>

        reservedAssignmentIds.has(

          Number(row.assignment_id)
        )
      )

      .map(row =>

        Number(row.registration_id)
      )
  ),

].sort((a, b) => a - b);

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

        JSON.stringify(assignments)
      )

      .digest('hex');

    const eventKey = [

      'volunteer',

      'duty_assigned',

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

          eventType:
            'duty_assigned',

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

            bulkAssignment: true,

            assignments,
          },
        },

        client
      );
if (!queued.created || !queued.job) {

  throw new Error(
    'Failed to create reserved grouped duty notification job'
  );
}

// ========================================
// LINK RESERVED ASSIGNMENT REFERENCES
// ========================================

await linkVolunteerEventEntities(

  queued.job.id,

  'duty_assigned',

  recipientUserId,

  reservationIds,

  client
);

summary.created++;
  }

  return summary;
}