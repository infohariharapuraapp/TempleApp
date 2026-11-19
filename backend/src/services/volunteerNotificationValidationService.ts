import { pool } from '../db';

import {
  VolunteerNotificationEvent,
  VolunteerNotificationJob,
} from './volunteerNotificationQueueService';

import {
  VolunteerDeliveryContent,
} from './volunteerNotificationDeliveryService';

// ========================================
// TYPES
// ========================================

type NotificationTemplate = {
  title: string;
  body: string;
};

// ========================================
// PERSONAL NOTIFICATION TEMPLATES
// ========================================

const PERSONAL_TEMPLATES: Partial<
  Record<VolunteerNotificationEvent, NotificationTemplate>
> = {

  registration_submitted: {
    title: 'Seva Registration Submitted',
    body:
      'Your volunteer seva registration has been received. Visit My Sevas to track your registration.',
  },

  registration_approved: {
    title: 'Seva Registration Approved',
    body:
      'Your volunteer seva registration has been approved. Visit My Sevas for further updates.',
  },

  registration_rejected: {
    title: 'Seva Registration Update',
    body:
      'Your volunteer seva registration has not been approved. Visit My Sevas for details.',
  },

  duty_assigned: {
    title: 'Seva Duty Assigned',
    body:
      'A volunteer seva duty has been assigned. Check My Sevas for your schedule and reporting instructions.',
  },

  duty_reassigned: {
    title: 'Seva Duty Updated',
    body:
      'Your volunteer seva duty schedule has changed. Please check the updated details in My Sevas.',
  },

  duty_cancelled: {
    title: 'Seva Duty Cancelled',
    body:
      'An assigned volunteer seva duty has been cancelled. Visit My Sevas for updated information.',
  },

  duty_reminder_24h: {
    title: 'Upcoming Volunteer Seva',
    body:
      'Your volunteer seva duty is approaching. Please check your reporting time and instructions in My Sevas.',
  },

  duty_reminder_2h: {
    title: 'Volunteer Seva Duty Reminder',
    body:
      'Your volunteer seva duty is approaching shortly. Please check your reporting time and instructions in My Sevas.',
  },

  id_card_issued: {
    title: 'Volunteer ID Card Available',
    body:
      'Your digital volunteer ID card is now available in My Sevas.',
  },

  id_card_revoked: {
    title: 'Volunteer ID Card Update',
    body:
      'Your volunteer ID card status has changed. Please check My Sevas.',
  },

  accommodation_available: {
    title: 'Seva Accommodation Available',
    body:
      'Accommodation information has been provided. Visit My Sevas for details.',
  },

  service_completed: {
    title: 'Volunteer Seva Completed',
    body:
      'Thank you for your dedicated service. Your volunteer seva completion status has been updated.',
  },

  certificate_issued: {
    title: 'Seva Certificate Available',
    body:
      'Thank you for your divine service. Your certificate is now available in My Sevas.',
  },

  certificate_revoked: {

  title: 'Volunteer Seva Certificate Revoked',

  body:
    'A previously issued volunteer seva certificate has been revoked. Please visit My Sevas for updated information.',

},
};

// ========================================
// EVENT CATEGORIES
// ========================================

const BROADCAST_EVENTS = new Set<
  VolunteerNotificationEvent
>([
  'registration_opened',
  'registration_extended',
  'registration_closing_reminder',
]);

const REGISTRATION_EVENTS = new Set<
  VolunteerNotificationEvent
>([
  'registration_submitted',
  'registration_approved',
  'registration_rejected',
]);

const ASSIGNMENT_EVENTS = new Set<
  VolunteerNotificationEvent
>([
  'duty_assigned',
  'duty_reassigned',
  'duty_cancelled',
  'duty_reminder_24h',
  'duty_reminder_2h',
]);

// ========================================
// HELPERS
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

function formatDateTime(
  value: string | Date
): string {

  return new Intl.DateTimeFormat(
    'en-IN',
    {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short',
    }
  ).format(new Date(value));
}

// ========================================
// VALIDATE BROADCAST NOTIFICATION
// ========================================

async function validateBroadcastEvent(
  job: VolunteerNotificationJob
): Promise<VolunteerDeliveryContent | null> {

  if (
    job.target_type !== 'all' ||
    job.recipient_user_id !== null ||
    !isValidId(job.opportunity_id)
  ) {
    return null;
  }

  if (
    job.registration_id !== null ||
    job.member_id !== null ||
    job.assignment_id !== null
  ) {
    return null;
  }

  const result = await pool.query(
    `
    SELECT

      id,
      title,
      registration_start_at,
      registration_end_at,

      registration_end_at <=
        NOW() + INTERVAL '24 hours'
        AS closing_soon

    FROM volunteer_opportunities

    WHERE id = $1

      AND is_published = TRUE

      AND registration_enabled = TRUE

      AND registration_start_at <= NOW()

      AND registration_end_at > NOW()
    `,
    [
      job.opportunity_id,
    ]
  );

  if (!result.rows.length) {
    return null;
  }

  const opportunity = result.rows[0];

  // Extended deadline and closing reminder
  // must belong to the current deadline.

  if (
    job.event_type === 'registration_extended' ||
    job.event_type === 'registration_closing_reminder'
  ) {

    const expectedDeadline =
      job.payload.registrationEndAt;

    if (typeof expectedDeadline !== 'string') {
      return null;
    }

    const expectedTime =
      new Date(expectedDeadline).getTime();

    const currentTime =
      new Date(
        opportunity.registration_end_at
      ).getTime();

    if (
      !Number.isFinite(expectedTime) ||
      expectedTime !== currentTime
    ) {
      return null;
    }
  }

  const deadline = formatDateTime(
    opportunity.registration_end_at
  );

  let title: string;

  let body: string;

  switch (job.event_type) {

    case 'registration_opened':

      title =
        'Volunteer Seva Registrations Open';

      body =
        `Registrations for ${opportunity.title} ` +
        `are now open until ${deadline} IST. ` +
        'Register through the temple app.';

      break;

    case 'registration_extended':

      title =
        'Seva Registration Deadline Extended';

      body =
        `The registration deadline for ` +
        `${opportunity.title} has been extended ` +
        `until ${deadline} IST.`;

      break;

    case 'registration_closing_reminder':

      if (!opportunity.closing_soon) {
        return null;
      }

      title =
        'Volunteer Seva Registrations Closing Soon';

      body =
        `Registrations for ${opportunity.title} ` +
        `will close on ${deadline} IST. ` +
        'Complete your registration before the deadline.';

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

      screen: '/seva-registration',

      opportunityId: opportunity.id,
    },
  };
}

// ========================================
// VALIDATE REGISTRATION EVENT
// ========================================

// ========================================
// VALIDATE REGISTRATION EVENT
// ========================================

async function validateRegistrationEvent(
  job: VolunteerNotificationJob
): Promise<boolean> {


  // ========================================
  // VALIDATE ENTITY REFERENCES
  // ========================================

  if (
    !isValidId(job.registration_id) ||
    !isValidId(job.recipient_user_id) ||
    !isValidId(job.opportunity_id) ||
    job.member_id !== null ||
    job.assignment_id !== null
  ) {
    return false;
  }

  // ========================================
  // VALIDATE QUEUED EVENT REVISION
  // ========================================

  const expectedRevision =
    job.payload?.registrationRevision;

  if (
    typeof expectedRevision !== 'string' ||
    !/^[1-9]\d{0,18}$/.test(expectedRevision)
  ) {
    return false;
  }

  // ========================================
  // VALIDATE EVENT STATUS
  // ========================================

  let allowedStatuses: string[];

  switch (job.event_type) {

    case 'registration_submitted':

      allowedStatuses = [
        'pending',
      ];

      break;

    case 'registration_approved':

      allowedStatuses = [
        'approved',
        'assigned',
        'in_progress',
        'completed',
      ];

      break;

    case 'registration_rejected':

      allowedStatuses = [
        'rejected',
      ];

      break;

    default:

      return false;
  }

  // ========================================
  // VALIDATE CURRENT REGISTRATION STATE
  // ========================================

  const result = await pool.query(
    `
    SELECT

      r.id,

      CASE

        WHEN $5::text =
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

      AND r.status = ANY($3::varchar[])

      AND r.opportunity_id = $4

      AND (

        r.user_id = $2

        OR EXISTS (

          SELECT 1

          FROM volunteer_members m

          WHERE m.registration_id = r.id

            AND m.opportunity_id =
              r.opportunity_id

            AND m.user_id = $2

            AND m.status <> 'cancelled'

        )
      )

    LIMIT 1
    `,
    [

      job.registration_id,

      job.recipient_user_id,

      allowedStatuses,

      job.opportunity_id,

      job.event_type,
    ]
  );

  if (!result.rows.length) {

    return false;
  }

  // ========================================
  // COMPARE CURRENT EVENT REVISION
  // ========================================

  const currentRevision =
    result.rows[0].event_revision;

  if (
    typeof currentRevision !== 'string' ||

    currentRevision !== expectedRevision
  ) {

    return false;
  }

  return true;
}


// ========================================
// VALIDATE GROUPED DUTY ASSIGNMENT EVENT
// ========================================

async function validateGroupedAssignmentEvent(

  job: VolunteerNotificationJob

): Promise<boolean> {

  // ========================================
  // VALIDATE EVENT AND ENTITY REFERENCES
  // ========================================

  if (

    job.event_type !== 'duty_assigned' ||

    job.target_type !== 'user' ||

    !isValidId(job.recipient_user_id) ||

    !isValidId(job.opportunity_id) ||

    job.assignment_id !== null ||

    job.member_id !== null ||

    (
      job.registration_id !== null &&
      !isValidId(job.registration_id)
    )

  ) {

    return false;
  }

  // ========================================
  // VALIDATE GROUPED PAYLOAD
  // ========================================

  if (job.payload?.bulkAssignment !== true) {

    return false;
  }

  const assignments =
    job.payload.assignments;

  if (

    !Array.isArray(assignments) ||

    assignments.length === 0 ||

    assignments.length > 500

  ) {

    return false;
  }

  // ========================================
  // VALIDATE ASSIGNMENT REFERENCES
  // ========================================

  const assignmentIds: number[] = [];

  const assignmentRevisions: string[] = [];

  const seenAssignmentIds =
    new Set<number>();

  for (const reference of assignments) {

    if (

      !reference ||

      typeof reference !== 'object' ||

      Array.isArray(reference)

    ) {

      return false;
    }

    const assignmentId =
      reference.assignmentId;

    const revision =
      reference.revision;

    if (

      !isValidId(assignmentId) ||

      typeof revision !== 'string' ||

      !/^[1-9]\d{0,18}$/.test(revision) ||

      seenAssignmentIds.has(assignmentId)

    ) {

      return false;
    }

    seenAssignmentIds.add(
      assignmentId
    );

    assignmentIds.push(
      assignmentId
    );

    assignmentRevisions.push(
      revision
    );
  }

  // ========================================
  // VALIDATE CURRENT ASSIGNMENT STATE
  // ========================================

  const result = await pool.query(
    `
    WITH expected_assignments AS (

      SELECT

        reference.assignment_id,

        reference.event_revision

      FROM UNNEST(

        $1::integer[],

        $2::text[]

      ) AS reference(

        assignment_id,

        event_revision
      )
    )

    SELECT a.id

    FROM expected_assignments expected

    JOIN volunteer_assignments a

      ON a.id =
        expected.assignment_id

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

    WHERE a.opportunity_id = $3

      AND (

        r.user_id = $4

        OR m.user_id = $4
      )

      AND (

        $5::integer IS NULL

        OR r.id = $5
      )

      AND a.status IN (

        'assigned',

        'in_progress'
      )

      AND m.status = 'approved'

      AND r.status IN (

        'approved',

        'assigned',

        'in_progress'
      )

      AND s.is_active = TRUE

      AND FLOOR(

        EXTRACT(
          EPOCH FROM a.assigned_at
        ) * 1000000

      )::bigint::text =
        expected.event_revision

    LIMIT 1
    `,
    [

      assignmentIds,

      assignmentRevisions,

      job.opportunity_id,

      job.recipient_user_id,

      job.registration_id,
    ]
  );

  // At least one assignment must remain
  // authorized, current and eligible.

  return result.rows.length > 0;
}



// ========================================
// VALIDATE ASSIGNMENT EVENT
// ========================================

async function validateAssignmentEvent(
  job: VolunteerNotificationJob
): Promise<boolean> {

  // ========================================
  // GROUPED DUTY ASSIGNMENT EVENTS
  // ========================================

  if (job.payload?.bulkAssignment !== undefined) {

    return validateGroupedAssignmentEvent(
      job
    );
  }

  // ========================================
  // VALIDATE INDIVIDUAL ENTITY REFERENCES
  // ========================================

  if (

    !isValidId(job.assignment_id) ||

    !isValidId(job.recipient_user_id) ||

    job.target_type !== 'user'

  ) {

    return false;
  }

  // ========================================
  // IDENTIFY PERSONAL DUTY EVENTS
  // ========================================

  const isPersonalDutyEvent =

    job.event_type === 'duty_assigned' ||

    job.event_type === 'duty_reassigned' ||

    job.event_type === 'duty_cancelled';

  // ========================================
  // VALIDATE PERSONAL EVENT REVISION
  // ========================================

  const expectedRevision =
    job.payload?.assignmentRevision;

  if (isPersonalDutyEvent) {

    if (

      !isValidId(job.opportunity_id) ||

      !isValidId(job.registration_id) ||

      !isValidId(job.member_id)

    ) {

      return false;
    }

    if (

      typeof expectedRevision !== 'string' ||

      !/^[1-9]\d{0,18}$/.test(expectedRevision)

    ) {

      return false;
    }
  }

  // ========================================
  // LOAD CURRENT ASSIGNMENT STATE
  // ========================================

  const result = await pool.query(
    `
    SELECT

      a.id,

      a.status AS assignment_status,

      r.status AS registration_status,

      m.status AS member_status,

      s.is_active AS shift_active,

      (
        s.service_date +

        COALESCE(

          a.reporting_time,

          s.start_time
        )

      ) AT TIME ZONE 'Asia/Kolkata'
        AS reporting_at,

      clock_timestamp() AS current_time,

      CASE

        WHEN $6::text = 'duty_cancelled'

        THEN FLOOR(

          EXTRACT(

            EPOCH FROM a.updated_at

          ) * 1000000

        )::bigint::text

        WHEN $6::text IN (

          'duty_assigned',

          'duty_reassigned'
        )

        THEN FLOOR(

          EXTRACT(

            EPOCH FROM a.assigned_at

          ) * 1000000

        )::bigint::text

        ELSE NULL

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

      AND (

        r.user_id = $2

        OR m.user_id = $2
      )

      AND (

        $3::integer IS NULL

        OR r.id = $3
      )

      AND (

        $4::integer IS NULL

        OR m.id = $4
      )

      AND (

        $5::integer IS NULL

        OR a.opportunity_id = $5
      )

      AND m.status <> 'cancelled'

      AND r.status <> 'cancelled'

    LIMIT 1
    `,
    [

      job.assignment_id,

      job.recipient_user_id,

      job.registration_id,

      job.member_id,

      job.opportunity_id,

      job.event_type,
    ]
  );

  if (!result.rows.length) {

    return false;
  }

  const assignment =
    result.rows[0];

  // ========================================
  // COMPARE CURRENT PERSONAL EVENT REVISION
  // ========================================

  if (isPersonalDutyEvent) {

    const currentRevision =
      assignment.event_revision;

    if (

      typeof currentRevision !== 'string' ||

      currentRevision !== expectedRevision

    ) {

      return false;
    }
  }

  // ========================================
  // VALIDATE CANCELLATION EVENT
  // ========================================

  if (job.event_type === 'duty_cancelled') {

    return (

      assignment.assignment_status ===
        'cancelled'
    );
  }

  // ========================================
  // VALIDATE MEMBER AND REGISTRATION
  // ========================================

  // Other assignment events require
  // an eligible registration and member.

  if (

    ![
      'approved',
      'assigned',
      'in_progress',
    ].includes(
      assignment.registration_status
    ) ||

    assignment.member_status !== 'approved' ||

    assignment.shift_active !== true

  ) {

    return false;
  }

  // ========================================
  // VALIDATE EVENT-SPECIFIC CONDITIONS
  // ========================================

  switch (job.event_type) {

    // ========================================
    // DUTY ASSIGNMENT AND REASSIGNMENT
    // ========================================

    case 'duty_assigned':

    case 'duty_reassigned':

      return [

        'assigned',

        'in_progress',

      ].includes(

        assignment.assignment_status
      );

    // ========================================
    // AUTOMATIC DUTY REMINDERS
    // ========================================

    case 'duty_reminder_24h':

    case 'duty_reminder_2h': {

      if (

        assignment.assignment_status
          !== 'assigned'

      ) {

        return false;
      }

      const reportingTime =
        new Date(

          assignment.reporting_at

        ).getTime();

      const currentTime =
        new Date(

          assignment.current_time

        ).getTime();

      const expectedReportingAt =
        job.payload?.reportingAt;

      if (

        typeof expectedReportingAt
          !== 'string'

      ) {

        return false;
      }

      const expectedTime =
        new Date(
          expectedReportingAt
        ).getTime();

      // ========================================
      // VALIDATE REPORTING TIME REVISION
      // ========================================

      if (

        !Number.isFinite(reportingTime) ||

        !Number.isFinite(currentTime) ||

        !Number.isFinite(expectedTime) ||

        expectedTime !== reportingTime ||

        reportingTime <= currentTime

      ) {

        return false;
      }

      const hoursRemaining =

        (reportingTime - currentTime) /

        (60 * 60 * 1000);

      // ========================================
      // 24-HOUR REMINDER WINDOW
      // ========================================

      if (

        job.event_type ===
          'duty_reminder_24h'

      ) {

        return (

          hoursRemaining <= 24 &&

          hoursRemaining > 2
        );
      }

      // ========================================
      // 2-HOUR REMINDER WINDOW
      // ========================================

      return (

        hoursRemaining <= 2 &&

        hoursRemaining > 0
      );
    }

    default:

      return false;
  }
}


// ========================================
// VALIDATE GROUPED ID CARD ISSUANCE EVENT
// ========================================

async function validateGroupedIdCardEvent(

  job: VolunteerNotificationJob

): Promise<boolean> {

  // ========================================
  // VALIDATE EVENT AND ENTITY REFERENCES
  // ========================================

  if (

    job.event_type !== 'id_card_issued' ||

    job.target_type !== 'user' ||

    !isValidId(job.recipient_user_id) ||

    !isValidId(job.opportunity_id) ||

    job.member_id !== null ||

    job.assignment_id !== null ||

    (
      job.registration_id !== null &&

      !isValidId(job.registration_id)
    )

  ) {

    return false;
  }

  // ========================================
  // VALIDATE GROUPED PAYLOAD
  // ========================================

  if (job.payload?.bulkIdCard !== true) {

    return false;
  }

  const cards = job.payload.cards;

  if (

    !Array.isArray(cards) ||

    cards.length === 0 ||

    cards.length > 500

  ) {

    return false;
  }

  // ========================================
  // VALIDATE CARD REFERENCES
  // ========================================

  const cardIds: number[] = [];

  const cardRevisions: string[] = [];

  const seenCardIds =
    new Set<number>();

  for (const reference of cards) {

    if (

      !reference ||

      typeof reference !== 'object' ||

      Array.isArray(reference)

    ) {

      return false;
    }

    const cardId =
      reference.cardId;

    const revision =
      reference.revision;

    if (

      !isValidId(cardId) ||

      typeof revision !== 'string' ||

      !/^[1-9]\d{0,18}$/.test(revision) ||

      seenCardIds.has(cardId)

    ) {

      return false;
    }

    seenCardIds.add(cardId);

    cardIds.push(cardId);

    cardRevisions.push(revision);
  }

  // ========================================
  // VALIDATE CURRENT ID CARD STATE
  // ========================================

  const result = await pool.query(
    `
    WITH expected_cards AS (

      SELECT

        reference.card_id,

        reference.event_revision

      FROM UNNEST(

        $1::integer[],

        $2::text[]

      ) AS reference(

        card_id,

        event_revision
      )
    )

    SELECT c.id

    FROM expected_cards expected

    JOIN volunteer_id_cards c

      ON c.id = expected.card_id

    JOIN volunteer_members m

      ON m.id = c.member_id

      AND m.opportunity_id =
        c.opportunity_id

    JOIN volunteer_registrations r

      ON r.id = m.registration_id

      AND r.opportunity_id =
        m.opportunity_id

    WHERE c.opportunity_id = $3

      AND (

        r.user_id = $4

        OR m.user_id = $4
      )

      AND (

        $5::integer IS NULL

        OR r.id = $5
      )

      AND c.status = 'active'

      AND c.valid_until >= (

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

      AND FLOOR(

        EXTRACT(

          EPOCH FROM c.issued_at

        ) * 1000000

      )::bigint::text =
        expected.event_revision

    LIMIT 1
    `,
    [

      cardIds,

      cardRevisions,

      job.opportunity_id,

      job.recipient_user_id,

      job.registration_id,
    ]
  );

  // At least one ID card must remain
  // authorized, current and eligible.

  return result.rows.length > 0;
}

// ========================================
// VALIDATE INDIVIDUAL MEMBER EVENT REVISION
// ========================================

async function validateIndividualMemberEvent(

  job: VolunteerNotificationJob

): Promise<boolean> {

  // ========================================
  // VALIDATE REQUIRED ENTITY REFERENCES
  // ========================================

  if (

    job.target_type !== 'user' ||

    !isValidId(job.opportunity_id) ||

    !isValidId(job.registration_id) ||

    !isValidId(job.member_id) ||

    !isValidId(job.recipient_user_id) ||

    job.assignment_id !== null

  ) {

    return false;
  }

  // ========================================
  // IDENTIFY EVENT TYPE
  // ========================================

  const isAccommodationEvent =

    job.event_type ===
      'accommodation_available';

  const isCardIssuedEvent =

    job.event_type ===
      'id_card_issued';

  const isCardRevokedEvent =

    job.event_type ===
      'id_card_revoked';

  if (

    !isAccommodationEvent &&

    !isCardIssuedEvent &&

    !isCardRevokedEvent

  ) {

    return false;
  }

  // ========================================
  // VALIDATE ENTITY ID AND REVISION
  // ========================================

  const entityId =

    isAccommodationEvent

      ? job.payload?.accommodationId

      : job.payload?.cardId;

  const expectedRevision =

    isAccommodationEvent

      ? job.payload?.accommodationRevision

      : job.payload?.cardRevision;

  if (

    !isValidId(entityId) ||

    typeof expectedRevision !== 'string' ||

    !/^[1-9]\d{0,18}$/.test(expectedRevision)

  ) {

    return false;
  }

  // ========================================
  // VALIDATE ACCOMMODATION PUBLICATION
  // ========================================

  if (isAccommodationEvent) {

    const result = await pool.query(
      `
      SELECT ac.id

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

        AND ac.opportunity_id = $2

        AND m.registration_id = $3

        AND m.id = $4

        AND (

          r.user_id = $5

          OR m.user_id = $5
        )

        AND ac.is_visible = TRUE

        AND ac.published_at IS NOT NULL

        AND (

          ac.check_out_at IS NULL

          OR ac.check_out_at >
            clock_timestamp()
        )

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

        AND FLOOR(

          EXTRACT(

            EPOCH FROM ac.published_at

          ) * 1000000

        )::bigint::text = $6::text

      LIMIT 1
      `,
      [

        entityId,

        job.opportunity_id,

        job.registration_id,

        job.member_id,

        job.recipient_user_id,

        expectedRevision,
      ]
    );

    return result.rows.length > 0;
  }

  // ========================================
  // VALIDATE ID CARD CURRENT STATE
  // ========================================

  const result = await pool.query(
    `
    SELECT

      c.id,

      c.status AS card_status,

      m.status AS member_status,

      r.status AS registration_status,

      (
        c.valid_until >= (

          clock_timestamp()
            AT TIME ZONE 'Asia/Kolkata'

        )::date

      ) AS card_not_expired,

      CASE

        WHEN $6::text = 'id_card_revoked'

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

      AND c.opportunity_id = $2

      AND m.registration_id = $3

      AND m.id = $4

      AND (

        r.user_id = $5

        OR m.user_id = $5
      )

    LIMIT 1
    `,
    [

      entityId,

      job.opportunity_id,

      job.registration_id,

      job.member_id,

      job.recipient_user_id,

      job.event_type,
    ]
  );

  if (!result.rows.length) {

    return false;
  }

  const card = result.rows[0];

  // ========================================
  // COMPARE EXACT CARD REVISION
  // ========================================

  if (

    typeof card.event_revision !== 'string' ||

    card.event_revision !== expectedRevision

  ) {

    return false;
  }

  // ========================================
  // VALIDATE REVOCATION EVENT
  // ========================================

  // Revocation notifications are allowed
  // even if the member or registration
  // is no longer approved.

  if (isCardRevokedEvent) {

    return card.card_status === 'revoked';
  }

  // ========================================
  // VALIDATE ID CARD ISSUANCE EVENT
  // ========================================

  if (

    ![
      'approved',
      'completed',
    ].includes(card.member_status) ||

    ![
      'approved',
      'assigned',
      'in_progress',
      'completed',
    ].includes(card.registration_status)

  ) {

    return false;
  }

  return (

    card.card_status === 'active' &&

    card.card_not_expired === true
  );
}





// ========================================
// VALIDATE GROUPED SERVICE COMPLETION EVENT
// ========================================

async function validateGroupedServiceCompletionEvent(

  job: VolunteerNotificationJob

): Promise<boolean> {

  // ========================================
  // VALIDATE EVENT AND ENTITY REFERENCES
  // ========================================

  if (

    job.event_type !== 'service_completed' ||

    job.target_type !== 'user' ||

    !isValidId(job.recipient_user_id) ||

    !isValidId(job.opportunity_id) ||

    job.member_id !== null ||

    job.assignment_id !== null ||

    (
      job.registration_id !== null &&

      !isValidId(job.registration_id)
    )

  ) {

    return false;
  }

  // ========================================
  // VALIDATE GROUPED PAYLOAD
  // ========================================

  if (

    job.payload?.bulkServiceCompletion !== true

  ) {

    return false;
  }

  const members = job.payload.members;

  if (

    !Array.isArray(members) ||

    members.length === 0 ||

    members.length > 500

  ) {

    return false;
  }

  // ========================================
  // VALIDATE MEMBER REFERENCES
  // ========================================

  const memberIds: number[] = [];

  const memberRevisions: string[] = [];

  const seenMemberIds =
    new Set<number>();

  for (const reference of members) {

    if (

      !reference ||

      typeof reference !== 'object' ||

      Array.isArray(reference)

    ) {

      return false;
    }

    const memberId =
      reference.memberId;

    const revision =
      reference.revision;

    if (

      !isValidId(memberId) ||

      typeof revision !== 'string' ||

      !/^[1-9]\d{0,18}$/.test(revision) ||

      seenMemberIds.has(memberId)

    ) {

      return false;
    }

    seenMemberIds.add(memberId);

    memberIds.push(memberId);

    memberRevisions.push(revision);
  }

  // ========================================
  // VALIDATE CURRENT SERVICE COMPLETION
  // ========================================

  const result = await pool.query(
    `
    WITH expected_members AS (

      SELECT

        reference.member_id,

        reference.event_revision

      FROM UNNEST(

        $1::integer[],

        $2::text[]

      ) AS reference(

        member_id,

        event_revision
      )
    )

    SELECT m.id

    FROM expected_members expected

    JOIN volunteer_members m

      ON m.id = expected.member_id

    JOIN volunteer_registrations r

      ON r.id = m.registration_id

      AND r.opportunity_id =
        m.opportunity_id

    WHERE m.opportunity_id = $3

      AND (

        r.user_id = $4

        OR m.user_id = $4
      )

      AND (

        $5::integer IS NULL

        OR r.id = $5
      )

      AND m.status = 'completed'

      AND m.completed_at IS NOT NULL

      AND r.status IN (

        'approved',

        'assigned',

        'in_progress',

        'completed'
      )

      AND FLOOR(

        EXTRACT(

          EPOCH FROM m.completed_at

        ) * 1000000

      )::bigint::text =
        expected.event_revision

    LIMIT 1
    `,
    [

      memberIds,

      memberRevisions,

      job.opportunity_id,

      job.recipient_user_id,

      job.registration_id,
    ]
  );

  // At least one member must remain
  // authorized, completed and current.

  return result.rows.length > 0;
}



// ========================================
// VALIDATE GROUPED CERTIFICATE ISSUANCE
// ========================================

async function validateGroupedCertificateIssuedEvent(

  job: VolunteerNotificationJob

): Promise<boolean> {

  // ========================================
  // VALIDATE EVENT AND ENTITY REFERENCES
  // ========================================

  if (

    job.event_type !== 'certificate_issued' ||

    job.target_type !== 'user' ||

    !isValidId(job.recipient_user_id) ||

    !isValidId(job.opportunity_id) ||

    job.member_id !== null ||

    job.assignment_id !== null ||

    (
      job.registration_id !== null &&

      !isValidId(job.registration_id)
    )

  ) {

    return false;
  }

  // ========================================
  // VALIDATE GROUPED PAYLOAD
  // ========================================

  if (job.payload?.bulkCertificate !== true) {

    return false;
  }

  const certificates =
    job.payload.certificates;

  if (

    !Array.isArray(certificates) ||

    certificates.length === 0 ||

    certificates.length > 200

  ) {

    return false;
  }

  // ========================================
  // VALIDATE CERTIFICATE REFERENCES
  // ========================================

  const certificateIds: number[] = [];

  const certificateRevisions: string[] = [];

  const seenCertificateIds =
    new Set<number>();

  for (const reference of certificates) {

    if (

      !reference ||

      typeof reference !== 'object' ||

      Array.isArray(reference)

    ) {

      return false;
    }

    const certificateId =
      reference.certificateId;

    const revision =
      reference.revision;

    if (

      !isValidId(certificateId) ||

      typeof revision !== 'string' ||

      !/^[1-9]\d{0,18}$/.test(revision) ||

      seenCertificateIds.has(certificateId)

    ) {

      return false;
    }

    seenCertificateIds.add(certificateId);

    certificateIds.push(certificateId);

    certificateRevisions.push(revision);
  }

  // ========================================
  // VALIDATE CURRENT CERTIFICATE STATE
  // ========================================

  const result = await pool.query(
    `
    WITH expected_certificates AS (

      SELECT

        reference.certificate_id,

        reference.event_revision

      FROM UNNEST(

        $1::integer[],

        $2::text[]

      ) AS reference(

        certificate_id,

        event_revision
      )
    )

    SELECT c.id

    FROM expected_certificates expected

    JOIN volunteer_certificates c

      ON c.id = expected.certificate_id

    JOIN volunteer_members m

      ON m.id = c.member_id

      AND m.opportunity_id =
        c.opportunity_id

    JOIN volunteer_registrations r

      ON r.id = m.registration_id

      AND r.opportunity_id =
        m.opportunity_id

    WHERE c.opportunity_id = $3

      AND (

        r.user_id = $4

        OR m.user_id = $4
      )

      AND (

        $5::integer IS NULL

        OR r.id = $5
      )

      AND c.status = 'issued'

      AND c.issued_at IS NOT NULL

      AND m.status = 'completed'

      AND r.status IN (

        'approved',

        'assigned',

        'in_progress',

        'completed'
      )

      AND FLOOR(

        EXTRACT(

          EPOCH FROM c.issued_at

        ) * 1000000

      )::bigint::text =
        expected.event_revision

    LIMIT 1
    `,
    [

      certificateIds,

      certificateRevisions,

      job.opportunity_id,

      job.recipient_user_id,

      job.registration_id,
    ]
  );

  // At least one certificate must remain
  // authorized, issued and current.

  return result.rows.length > 0;
}


// ========================================
// VALIDATE INDIVIDUAL CERTIFICATE REVOCATION
// ========================================

async function validateCertificateRevokedEvent(

  job: VolunteerNotificationJob

): Promise<boolean> {

  // ========================================
  // VALIDATE EVENT AND ENTITY REFERENCES
  // ========================================

  if (

    job.event_type !== 'certificate_revoked' ||

    job.target_type !== 'user' ||

    !isValidId(job.opportunity_id) ||

    !isValidId(job.registration_id) ||

    !isValidId(job.member_id) ||

    !isValidId(job.recipient_user_id) ||

    job.assignment_id !== null

  ) {

    return false;
  }

  // ========================================
  // VALIDATE CERTIFICATE ID AND REVISION
  // ========================================

  const certificateId =
    job.payload?.certificateId;

  const expectedRevision =
    job.payload?.certificateRevision;

  if (

    !isValidId(certificateId) ||

    typeof expectedRevision !== 'string' ||

    !/^[1-9]\d{0,18}$/.test(expectedRevision)

  ) {

    return false;
  }

  // ========================================
  // VALIDATE CURRENT CERTIFICATE STATE
  // ========================================

  const result = await pool.query(
    `
    SELECT c.id

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

      AND c.opportunity_id = $2

      AND r.id = $3

      AND m.id = $4

      AND (

        r.user_id = $5

        OR m.user_id = $5
      )

      AND c.status = 'revoked'

      AND c.issued_at IS NOT NULL

      AND c.revoked_at IS NOT NULL

      AND FLOOR(

        EXTRACT(

          EPOCH FROM c.revoked_at

        ) * 1000000

      )::bigint::text = $6::text

    LIMIT 1
    `,
    [

      certificateId,

      job.opportunity_id,

      job.registration_id,

      job.member_id,

      job.recipient_user_id,

      expectedRevision,
    ]
  );

  // Revocation remains eligible even when
  // the member's service has been reopened
  // or registration is no longer approved.

  return result.rows.length > 0;
}

// ========================================
// VALIDATE MEMBER EVENT
// ========================================

// ========================================
// VALIDATE MEMBER EVENT
// ========================================

// ========================================
// VALIDATE MEMBER EVENT
// ========================================

async function validateMemberEvent(

  job: VolunteerNotificationJob

): Promise<boolean> {

  // ========================================
  // GROUPED SERVICE COMPLETION EVENT
  // ========================================

  if (

    job.event_type === 'service_completed' ||

    job.payload?.bulkServiceCompletion !== undefined

  ) {

    return validateGroupedServiceCompletionEvent(
      job
    );
  }

  // ========================================
  // GROUPED CERTIFICATE ISSUANCE EVENT
  // ========================================

  if (

    job.event_type === 'certificate_issued' ||

    job.payload?.bulkCertificate !== undefined

  ) {

    return validateGroupedCertificateIssuedEvent(
      job
    );
  }

  // ========================================
  // GROUPED ID CARD ISSUANCE EVENT
  // ========================================

  if (job.payload?.bulkIdCard !== undefined) {

    return validateGroupedIdCardEvent(
      job
    );
  }

  // ========================================
  // INDIVIDUAL REVISION-TRACKED MEMBER EVENTS
  // ========================================

  if (

    job.event_type === 'id_card_issued' ||

    job.event_type === 'id_card_revoked' ||

    job.event_type === 'accommodation_available'

  ) {

    return validateIndividualMemberEvent(
      job
    );
  }

  // ========================================
  // INDIVIDUAL CERTIFICATE REVOCATION
  // ========================================

  if (job.event_type === 'certificate_revoked') {

    return validateCertificateRevokedEvent(
      job
    );
  }

  // ========================================
  // REJECT UNSUPPORTED MEMBER EVENTS
  // ========================================

  return false;
}
// ========================================
// MAIN EVENT VALIDATOR
// ========================================

export async function validateVolunteerNotificationEvent(
  job: VolunteerNotificationJob
): Promise<VolunteerDeliveryContent | null> {

  // Broadcast events.

  if (BROADCAST_EVENTS.has(job.event_type)) {

    return validateBroadcastEvent(job);
  }

  // All remaining events must have
  // an individual authorized recipient.

  if (
    job.target_type !== 'user' ||
    !isValidId(job.recipient_user_id)
  ) {
    return null;
  }

  const template =
    PERSONAL_TEMPLATES[job.event_type];

  if (!template) {
    return null;
  }

  let eligible = false;

  if (
    REGISTRATION_EVENTS.has(job.event_type)
  ) {

    eligible =
      await validateRegistrationEvent(job);

  } else if (
    ASSIGNMENT_EVENTS.has(job.event_type)
  ) {

    eligible =
      await validateAssignmentEvent(job);

  } else {

    eligible =
      await validateMemberEvent(job);
  }

  if (!eligible) {
    return null;
  }

  // ========================================
// GROUPED SERVICE COMPLETION CONTENT
// ========================================

if (

  job.event_type === 'service_completed' &&

  job.payload?.bulkServiceCompletion === true

) {

  return {

    title:
      'Volunteer Seva Completed',

    body:
      'Thank you for your dedicated seva. Volunteer service completion details have been updated. Visit My Sevas for more information.',

    data: {

      type: 'volunteer_seva',

      event: job.event_type,

      screen: '/my-sevas',

      opportunityId: job.opportunity_id,
    },
  };
}

// ========================================
// GROUPED CERTIFICATE ISSUANCE CONTENT
// ========================================

if (

  job.event_type === 'certificate_issued' &&

  job.payload?.bulkCertificate === true

) {

  return {

    title:
      'Volunteer Seva Certificate Available',

    body:
      'Thank you for your divine service. Volunteer seva certificates are now available. Visit My Sevas to view and download your available certificates.',

    data: {

      type: 'volunteer_seva',

      event: job.event_type,

      screen: '/my-sevas',

      opportunityId: job.opportunity_id,
    },
  };
}


  // ========================================
// GROUPED ID CARD ISSUANCE CONTENT
// ========================================

if (

  job.event_type === 'id_card_issued' &&

  job.payload?.bulkIdCard === true

) {

  return {

    title:
      'Volunteer ID Card Available',

    body:
      'Volunteer ID cards have been issued. Visit My Sevas to view your available digital ID cards.',

    data: {

      type: 'volunteer_seva',

      event: job.event_type,

      screen: '/my-sevas',

      opportunityId: job.opportunity_id,
    },
  };
}


  // ========================================
// GROUPED DUTY ASSIGNMENT CONTENT
// ========================================

if (

  job.event_type === 'duty_assigned' &&

  job.payload?.bulkAssignment === true

) {

  return {

    title:
      'Seva Duty Assignment Update',

    body:
      'New volunteer seva duties have been assigned. Visit My Sevas for your latest duty schedules and reporting instructions.',

    data: {

      type: 'volunteer_seva',

      event: job.event_type,

      screen: '/my-sevas',

      opportunityId: job.opportunity_id,
    },
  };
}
  // Only trusted navigation information.
  // Do not forward arbitrary queue payload
  // or personal devotee information.

  return {

    title: template.title,

    body: template.body,

    data: {

      type: 'volunteer_seva',

      event: job.event_type,

      screen: '/my-sevas',

      ...(isValidId(job.opportunity_id)
        ? {
            opportunityId: job.opportunity_id,
          }
        : {}),

      // Personal entity authorization is
      // checked above. Open the authenticated
      // My Sevas screen without embedding
      // member or assignment details.

    },
  };
}
