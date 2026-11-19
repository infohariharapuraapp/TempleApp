import { pool } from '../db';

import {
  sendNotificationToAllUsers,
  sendPushNotificationToUser,
} from './notificationService';

// ========================================
// VOLUNTEER NOTIFICATION EVENTS
// ========================================

export type VolunteerBroadcastEvent =
  | 'registration_opened'
  | 'registration_extended';

export type VolunteerPersonalEvent =
  | 'registration_submitted'
  | 'registration_approved'
  | 'registration_rejected'
  | 'duty_assigned'
  | 'duty_reassigned'
  | 'duty_cancelled'
  | 'id_card_issued'
  | 'id_card_revoked'
  | 'accommodation_available'
  | 'service_reminder'
  | 'service_completed'
  | 'certificate_issued'
  | 'certificate_revoked';

type NotificationContent = {
  title: string;
  body: string;
};

// ========================================
// PERSONAL NOTIFICATION TEMPLATES
// ========================================

const PERSONAL_TEMPLATES: Record<
  VolunteerPersonalEvent,
  NotificationContent
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

  service_reminder: {
    title: 'Upcoming Volunteer Seva',
    body:
      'Your volunteer seva duty is approaching. Please check your reporting time and instructions in My Sevas.',
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
    title: 'Seva Certificate Update',
    body:
      'Your volunteer seva certificate status has changed. Visit My Sevas for details.',
  },
};

// ========================================
// HELPERS
// ========================================

function isValidId(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value > 0 &&
    value <= 2147483647
  );
}

function formatDateTime(
  value: string | Date
): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

// ========================================
// BROADCAST VOLUNTEER NOTIFICATIONS
// ========================================

export async function notifyVolunteerOpportunity(
  opportunityId: number,
  event: VolunteerBroadcastEvent
): Promise<void> {
  try {
    if (!isValidId(opportunityId)) {
      return;
    }

    const result = await pool.query(
      `
      SELECT
        id,
        title,
        registration_start_at,
        registration_end_at,
        is_published,
        registration_enabled

      FROM volunteer_opportunities

      WHERE id = $1
        AND is_published = TRUE
        AND registration_enabled = TRUE
        AND registration_start_at <= NOW()
        AND registration_end_at > NOW()
      `,
      [opportunityId]
    );

    if (!result.rows.length) {
      return;
    }

    const opportunity = result.rows[0];

    let title: string;
    let body: string;

    const deadline = formatDateTime(
      opportunity.registration_end_at
    );

    switch (event) {
      case 'registration_opened':
        title = 'Volunteer Seva Registrations Open';

        body =
          `Registrations for ${opportunity.title} ` +
          `are now open until ${deadline} IST. ` +
          'Register through the temple app.';

        break;

      case 'registration_extended':
        title = 'Seva Registration Deadline Extended';

        body =
          `The registration deadline for ` +
          `${opportunity.title} has been extended ` +
          `until ${deadline} IST.`;

        break;

      default:
        return;
    }

    const sendResult =
      await sendNotificationToAllUsers(
        title,
        body,
        {
          type: 'volunteer_seva',
          event,
          screen: '/seva-registration',
          opportunityId,
        }
      );

    if (!sendResult.success) {
      console.warn(
        'Volunteer broadcast notification failed:',
        {
          opportunityId,
          event,
          notificationId:
            sendResult.notificationId,
        }
      );
    }
  } catch (error) {
    console.error(
      'Volunteer opportunity notification error:',
      error
    );
  }
}

// ========================================
// PRIVATE NOTIFICATION DELIVERY
// ========================================

async function notifyUsers(
  userIds: number[],
  event: VolunteerPersonalEvent,
  registrationId: number,
  opportunityId: number,
  memberId?: number
): Promise<void> {
  const template = PERSONAL_TEMPLATES[event];

  if (!template) {
    return;
  }

  const recipients = [
    ...new Set(
      userIds.filter(isValidId)
    ),
  ];

  for (const userId of recipients) {
    try {
      const result =
        await sendPushNotificationToUser(
          userId,
          template.title,
          template.body,
          {
            type: 'volunteer_seva',
            event,
            screen: '/my-sevas',
            registrationId,
            opportunityId,

            ...(memberId !== undefined
              ? { memberId }
              : {}),
          }
        );

      if (!result.success) {
        console.warn(
          'Volunteer notification delivery failed:',
          {
            userId,
            event,
            registrationId,
            notificationId:
              result.notificationId,
          }
        );
      }
    } catch (error) {
      console.error(
        'Volunteer user notification error:',
        error
      );
    }
  }
}

// ========================================
// REGISTRATION-LEVEL NOTIFICATIONS
// ========================================

export async function notifyVolunteerRegistration(
  registrationId: number,
  event: VolunteerPersonalEvent
): Promise<void> {
  try {
    if (!isValidId(registrationId)) {
      return;
    }

    const result = await pool.query(
      `
      SELECT
        r.id,
        r.opportunity_id,
        r.user_id

      FROM volunteer_registrations r

      WHERE r.id = $1
      `,
      [registrationId]
    );

    if (!result.rows.length) {
      return;
    }

    const registration = result.rows[0];

    const recipients = await pool.query(
      `
      SELECT user_id

      FROM volunteer_registrations

      WHERE id = $1

      UNION

      SELECT user_id

      FROM volunteer_members

      WHERE registration_id = $1
        AND user_id IS NOT NULL
        AND status <> 'cancelled'
      `,
      [registrationId]
    );

    const userIds = recipients.rows.map(
      row => Number(row.user_id)
    );

    await notifyUsers(
      userIds,
      event,
      registration.id,
      registration.opportunity_id
    );
  } catch (error) {
    console.error(
      'Volunteer registration notification error:',
      error
    );
  }
}

// ========================================
// MEMBER-LEVEL NOTIFICATIONS
// ========================================

export async function notifyVolunteerMember(
  memberId: number,
  event: VolunteerPersonalEvent
): Promise<void> {
  try {
    if (!isValidId(memberId)) {
      return;
    }

    const result = await pool.query(
      `
      SELECT
        m.id,
        m.registration_id,
        m.opportunity_id,

        m.user_id AS member_user_id,

        r.user_id AS registration_owner_id

      FROM volunteer_members m

      JOIN volunteer_registrations r
        ON r.id = m.registration_id

      WHERE m.id = $1
      `,
      [memberId]
    );

    if (!result.rows.length) {
      return;
    }

    const member = result.rows[0];

    const userIds = [
      Number(member.registration_owner_id),
      Number(member.member_user_id),
    ];

    await notifyUsers(
      userIds,
      event,
      member.registration_id,
      member.opportunity_id,
      member.id
    );
  } catch (error) {
    console.error(
      'Volunteer member notification error:',
      error
    );
  }
}

// ========================================
// ASSIGNMENT-LEVEL NOTIFICATIONS
// ========================================

export async function notifyVolunteerAssignment(
  assignmentId: number,
  event:
    | 'duty_assigned'
    | 'duty_reassigned'
    | 'duty_cancelled'
    | 'service_reminder'
): Promise<void> {
  try {
    if (!isValidId(assignmentId)) {
      return;
    }

    const result = await pool.query(
      `
      SELECT member_id

      FROM volunteer_assignments

      WHERE id = $1
      `,
      [assignmentId]
    );

    if (!result.rows.length) {
      return;
    }

    await notifyVolunteerMember(
      Number(result.rows[0].member_id),
      event
    );
  } catch (error) {
    console.error(
      'Volunteer assignment notification error:',
      error
    );
  }
}

// ========================================
// BULK ASSIGNMENT NOTIFICATIONS
// ========================================

export async function notifyVolunteerAssignments(
  assignmentIds: number[]
): Promise<void> {
  try {
    const validIds = [
      ...new Set(
        assignmentIds.filter(isValidId)
      ),
    ];

    if (!validIds.length) {
      return;
    }

    const result = await pool.query(
      `
      SELECT DISTINCT
        r.id AS registration_id,
        r.opportunity_id,
        recipient.user_id

      FROM volunteer_assignments a

      JOIN volunteer_members m
        ON m.id = a.member_id

      JOIN volunteer_registrations r
        ON r.id = m.registration_id

      CROSS JOIN LATERAL (
        VALUES
          (r.user_id),
          (m.user_id)
      ) AS recipient(user_id)

      WHERE a.id = ANY($1::integer[])
        AND a.status = 'assigned'
        AND m.status = 'approved'
        AND r.status IN (
          'approved',
          'assigned',
          'in_progress'
        )
        AND recipient.user_id IS NOT NULL
      `,
      [validIds]
    );

    // Group notifications by recipient.

    const recipients = new Map<
      number,
      {
        registrationIds: Set<number>;
        opportunityIds: Set<number>;
      }
    >();

    for (const row of result.rows) {
      const userId = Number(row.user_id);

      if (!isValidId(userId)) {
        continue;
      }

      if (!recipients.has(userId)) {
        recipients.set(userId, {
          registrationIds: new Set<number>(),
          opportunityIds: new Set<number>(),
        });
      }

      const recipient = recipients.get(userId)!;

      recipient.registrationIds.add(
        Number(row.registration_id)
      );

      recipient.opportunityIds.add(
        Number(row.opportunity_id)
      );
    }

    // Send only one notification per recipient
    // for this bulk assignment operation.

    for (const [userId, recipient] of recipients) {
      try {
        const registrationIds = [
          ...recipient.registrationIds,
        ];

        const opportunityIds = [
          ...recipient.opportunityIds,
        ];

        const result =
          await sendPushNotificationToUser(
            userId,
            'Seva Duty Assignment Update',
            'New volunteer seva duties have been assigned. Visit My Sevas for your latest duty schedules and reporting instructions.',
            {
              type: 'volunteer_seva',
              event: 'duty_assigned',
              screen: '/my-sevas',

              ...(registrationIds.length === 1
                ? {
                    registrationId:
                      registrationIds[0],
                  }
                : {}),

              ...(opportunityIds.length === 1
                ? {
                    opportunityId:
                      opportunityIds[0],
                  }
                : {}),
            }
          );

        if (!result.success) {
          console.warn(
            'Bulk volunteer notification failed:',
            {
              userId,
              notificationId:
                result.notificationId,
            }
          );
        }
      } catch (error) {
        console.error(
          'Bulk volunteer recipient notification error:',
          error
        );
      }
    }
  } catch (error) {
    console.error(
      'Bulk volunteer assignment notification error:',
      error
    );
  }
}


// ========================================
// BULK VOLUNTEER MEMBER NOTIFICATIONS
// ========================================

export async function notifyVolunteerMembers(
  memberIds: number[],
  event: VolunteerPersonalEvent
): Promise<void> {
  try {
    const template = PERSONAL_TEMPLATES[event];

    if (!template) {
      return;
    }

    const validIds = [
      ...new Set(memberIds.filter(isValidId)),
    ];

    if (!validIds.length) {
      return;
    }

    const result = await pool.query(
      `
      SELECT DISTINCT
        r.id AS registration_id,
        r.opportunity_id,
        recipient.user_id

      FROM volunteer_members m

      JOIN volunteer_registrations r
        ON r.id = m.registration_id

      CROSS JOIN LATERAL (
        VALUES
          (r.user_id),
          (m.user_id)
      ) AS recipient(user_id)

      WHERE m.id = ANY($1::integer[])

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

        AND recipient.user_id IS NOT NULL
      `,
      [validIds]
    );

    const recipients = new Map<
      number,
      {
        registrationIds: Set<number>;
        opportunityIds: Set<number>;
      }
    >();

    for (const row of result.rows) {
      const userId = Number(row.user_id);

      if (!isValidId(userId)) {
        continue;
      }

      if (!recipients.has(userId)) {
        recipients.set(userId, {
          registrationIds: new Set<number>(),
          opportunityIds: new Set<number>(),
        });
      }

      const recipient = recipients.get(userId)!;

      recipient.registrationIds.add(
        Number(row.registration_id)
      );

      recipient.opportunityIds.add(
        Number(row.opportunity_id)
      );
    }

    for (const [userId, recipient] of recipients) {
      try {
        const registrationIds = [
          ...recipient.registrationIds,
        ];

        const opportunityIds = [
          ...recipient.opportunityIds,
        ];

        const sendResult =
          await sendPushNotificationToUser(
            userId,
            template.title,
            template.body,
            {
              type: 'volunteer_seva',
              event,
              screen: '/my-sevas',

              ...(registrationIds.length === 1
                ? {
                    registrationId:
                      registrationIds[0],
                  }
                : {}),

              ...(opportunityIds.length === 1
                ? {
                    opportunityId:
                      opportunityIds[0],
                  }
                : {}),
            }
          );

        if (!sendResult.success) {
          console.warn(
            'Bulk member notification failed:',
            {
              userId,
              event,
              notificationId:
                sendResult.notificationId,
            }
          );
        }
      } catch (error) {
        console.error(
          'Volunteer recipient notification error:',
          error
        );
      }
    }
  } catch (error) {
    console.error(
      'Bulk volunteer member notification error:',
      error
    );
  }
}
