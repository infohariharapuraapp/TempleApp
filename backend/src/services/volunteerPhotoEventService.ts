import { PoolClient } from 'pg';
import { pool } from '../db';
import {
  enqueueVolunteerNotification,
  VolunteerNotificationJob,
} from './volunteerNotificationQueueService';
import {
  VolunteerDeliveryContent,
} from './volunteerNotificationDeliveryService';
export type VolunteerPhotoEvent =
  | 'photo_correction_required'
  | 'photo_verified'
  | 'photo_resubmitted';
const CONTENT: Record<
  VolunteerPhotoEvent,
  {
    title: string;
    body: string;
    statuses: string[];
  }
> = {
  photo_correction_required: {
    title: 'Volunteer Photograph Correction Required',
    body:
      'A volunteer photograph requires correction. Open My Sevas to review the instructions and upload a new photograph.',
    statuses: ['correction_required'],
  },
  photo_verified: {
    title: 'Volunteer Photograph Verified',
    body:
      'A volunteer photograph has been successfully verified. Visit My Sevas for further updates.',
    statuses: ['verified'],
  },
  photo_resubmitted: {
    title: 'Volunteer Photograph Submitted',
    body:
      'A volunteer photograph has been submitted for administrator verification. Track its status in My Sevas.',
    statuses: ['pending', 'resubmitted'],
  },
};
export function isVolunteerPhotoEvent(
  event: string
): event is VolunteerPhotoEvent {
  return Object.prototype.hasOwnProperty.call(
    CONTENT,
    event
  );
}
function validId(
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
// QUEUE PHOTOGRAPH EVENT
// ========================================
export async function queueVolunteerPhotoEvent(
  client: PoolClient,
  memberId: number,
  event: VolunteerPhotoEvent
): Promise<void> {
  if (!validId(memberId)) {
    throw new Error('Invalid photograph event member');
  }
  const template = CONTENT[event];
  const result = await client.query(
    `
    SELECT DISTINCT
      m.id AS member_id,
      m.registration_id,
      m.opportunity_id,
      m.photo_revision,
      recipient.user_id
    FROM volunteer_members m
    JOIN volunteer_registrations r
      ON r.id = m.registration_id
      AND r.opportunity_id = m.opportunity_id
    CROSS JOIN LATERAL (
      VALUES
        (r.user_id),
        (m.user_id)
    ) AS recipient(user_id)
    WHERE m.id = $1
      AND m.photo_revision > 0
      AND m.photo_status = ANY($2::varchar[])
      AND m.status IN ('pending', 'approved')
      AND r.status IN (
        'pending',
        'approved',
        'assigned',
        'in_progress'
      )
      AND recipient.user_id IS NOT NULL
    `,
    [memberId, template.statuses]
  );
  const scheduledAt = new Date();
  const expiresAt = new Date(
    scheduledAt.getTime() + 24 * 60 * 60 * 1000
  );
  for (const row of result.rows) {
    const userId = Number(row.user_id);
    const revision = Number(row.photo_revision);
    if (!validId(userId) || !validId(revision)) {
      throw new Error(
        'Invalid photograph notification reference'
      );
    }
    await enqueueVolunteerNotification(
      {
        eventKey:
          `volunteer:photo:${memberId}:${revision}:${event}:${userId}`,
        eventType: event,
        opportunityId: Number(row.opportunity_id),
        registrationId: Number(row.registration_id),
        memberId,
        recipientUserId: userId,
        targetType: 'user',
        payload: {
          photoRevision: revision,
        },
        scheduledAt,
        expiresAt,
        maxAttempts: 3,
      },
      client
    );
  }
}
// ========================================
// VALIDATE BEFORE NOTIFICATION DELIVERY
// ========================================
export async function validateVolunteerPhotoEvent(
  job: VolunteerNotificationJob
): Promise<VolunteerDeliveryContent | null> {
  if (!isVolunteerPhotoEvent(job.event_type)) {
    return null;
  }
  const revision = job.payload?.photoRevision;
  if (
    job.target_type !== 'user' ||
    !validId(job.recipient_user_id) ||
    !validId(job.registration_id) ||
    !validId(job.member_id) ||
    !validId(job.opportunity_id) ||
    !validId(revision) ||
    job.assignment_id !== null
  ) {
    return null;
  }
  const template = CONTENT[job.event_type];
  const result = await pool.query(
    `
    SELECT m.id
    FROM volunteer_members m
    JOIN volunteer_registrations r
      ON r.id = m.registration_id
      AND r.opportunity_id = m.opportunity_id
    WHERE m.id = $1
      AND m.registration_id = $2
      AND m.opportunity_id = $3
      AND m.photo_revision = $4
      AND m.photo_status = ANY($5::varchar[])
      AND (
        r.user_id = $6
        OR m.user_id = $6
      )
      AND m.status IN (
        'pending',
        'approved'
      )
      AND r.status IN (
        'pending',
        'approved',
        'assigned',
        'in_progress'
      )
    LIMIT 1
    `,
    [
      job.member_id,
      job.registration_id,
      job.opportunity_id,
      revision,
      template.statuses,
      job.recipient_user_id,
    ]
  );
  if (!result.rows.length) {
    return null;
  }
  return {
    title: template.title,
    body: template.body,
    data: {
      type: 'volunteer_seva',
      event: job.event_type,
      screen: '/volunteer/registration-details',
      registrationId: job.registration_id,
      opportunityId: job.opportunity_id,
    },
  };
}