import { randomUUID } from 'crypto';
import { PoolClient } from 'pg';
import { pool } from '../db';

// ========================================
// TYPES
// ========================================

export type VolunteerNotificationEvent =
  | 'registration_opened'
  | 'registration_extended'
  | 'registration_closing_reminder'
  | 'registration_submitted'
  | 'registration_approved'
  | 'registration_rejected'
  | 'duty_assigned'
  | 'duty_reassigned'
  | 'duty_cancelled'
  | 'duty_reminder_24h'
  | 'duty_reminder_2h'
  | 'id_card_issued'
  | 'id_card_revoked'
  | 'accommodation_available'
  | 'service_completed'
  | 'certificate_issued'
  | 'certificate_revoked';

export type NotificationTarget =
  | 'all'
  | 'user';

export interface CreateVolunteerNotificationJob {
  eventKey: string;
  eventType: VolunteerNotificationEvent;

  opportunityId?: number | null;
  registrationId?: number | null;
  memberId?: number | null;
  assignmentId?: number | null;

  recipientUserId?: number | null;
  targetType: NotificationTarget;

  payload?: Record<string, unknown>;

  scheduledAt?: Date;
  expiresAt?: Date | null;

  maxAttempts?: number;
}

export interface VolunteerNotificationJob {
  id: string;
  event_key: string;
  event_type: VolunteerNotificationEvent;

  opportunity_id: number | null;
  registration_id: number | null;
  member_id: number | null;
  assignment_id: number | null;

  recipient_user_id: number | null;
  target_type: NotificationTarget;

  notification_id: number | null;
  payload: Record<string, unknown>;

  scheduled_at: Date;
  next_attempt_at: Date;
  expires_at: Date | null;

  status: string;
  attempts: number;
  max_attempts: number;

  locked_at: Date | null;
  lock_token: string | null;
}

// ========================================
// CONFIGURATION
// ========================================

const DEFAULT_MAX_ATTEMPTS = 3;

const RETRY_DELAYS_SECONDS = [
  60,
  300,
];

const STALE_LOCK_MINUTES = 10;

// ========================================
// VALIDATION
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

function validateJob(
  options: CreateVolunteerNotificationJob
) {

  if (
    typeof options.eventKey !== 'string' ||
    !options.eventKey.trim() ||
    options.eventKey.length > 255
  ) {

    throw new Error(
      'Invalid notification event key'
    );
  }

  if (
    !['all', 'user'].includes(
      options.targetType
    )
  ) {

    throw new Error(
      'Invalid notification target type'
    );
  }

  if (
    options.targetType === 'user' &&
    !isValidId(options.recipientUserId)
  ) {

    throw new Error(
      'Invalid notification recipient'
    );
  }

  if (
    options.targetType === 'all' &&
    options.recipientUserId != null
  ) {

    throw new Error(
      'Broadcast cannot have an individual recipient'
    );
  }

  const ids = [
    options.opportunityId,
    options.registrationId,
    options.memberId,
    options.assignmentId,
  ];

  for (const id of ids) {

    if (id != null && !isValidId(id)) {

      throw new Error(
        'Invalid volunteer notification reference'
      );
    }
  }

  const maxAttempts =
    options.maxAttempts ??
    DEFAULT_MAX_ATTEMPTS;

  if (
    !Number.isInteger(maxAttempts) ||
    maxAttempts < 1 ||
    maxAttempts > 5
  ) {

    throw new Error(
      'Invalid maximum notification attempts'
    );
  }
}

// ========================================
// 1. CREATE NOTIFICATION JOB
// ========================================

export async function enqueueVolunteerNotification(
  options: CreateVolunteerNotificationJob,
  client?: PoolClient
) {

  validateJob(options);

  const db = client ?? pool;

  const scheduledAt =
    options.scheduledAt ?? new Date();

  if (
    !Number.isFinite(scheduledAt.getTime())
  ) {

    throw new Error(
      'Invalid notification schedule'
    );
  }

  if (
    options.expiresAt &&
    (
      !Number.isFinite(
        options.expiresAt.getTime()
      ) ||
      options.expiresAt.getTime() <=
        scheduledAt.getTime()
    )
  ) {

    throw new Error(
      'Invalid notification expiry'
    );
  }

  const result = await db.query(
    `
    INSERT INTO volunteer_notification_jobs (
      event_key,
      event_type,
      opportunity_id,
      registration_id,
      member_id,
      assignment_id,
      recipient_user_id,
      target_type,
      payload,
      scheduled_at,
      next_attempt_at,
      expires_at,
      max_attempts
    )

    VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9::jsonb,
      $10, $10, $11, $12
    )

    ON CONFLICT (event_key)
    DO NOTHING

    RETURNING *
    `,
    [
      options.eventKey,
      options.eventType,
      options.opportunityId ?? null,
      options.registrationId ?? null,
      options.memberId ?? null,
      options.assignmentId ?? null,
      options.recipientUserId ?? null,
      options.targetType,

      JSON.stringify(
        options.payload ?? {}
      ),

      scheduledAt,
      options.expiresAt ?? null,

      options.maxAttempts ??
        DEFAULT_MAX_ATTEMPTS,
    ]
  );

  return {

    created: result.rows.length > 0,

    job: result.rows.length
      ? result.rows[0] as VolunteerNotificationJob
      : null,
  };
}

// ========================================
// 2. EXPIRE OUTDATED PENDING JOBS
// ========================================

export async function expireVolunteerNotificationJobs() {

  const result = await pool.query(`
    UPDATE volunteer_notification_jobs

    SET

      status = 'expired',

      processed_at = NOW(),

      updated_at = NOW(),

      locked_at = NULL,

      lock_token = NULL

    WHERE status = 'pending'

      AND expires_at IS NOT NULL

      AND expires_at <= NOW()
  `);

  return result.rowCount ?? 0;
}

// ========================================
// 3. CLAIM NEXT AVAILABLE JOB
// ========================================

export async function claimVolunteerNotificationJob():
  Promise<VolunteerNotificationJob | null> {

  const lockToken = randomUUID();

  const result = await pool.query(
    `
    WITH next_job AS (

      SELECT id

      FROM volunteer_notification_jobs

      WHERE status = 'pending'

        AND scheduled_at <= NOW()

        AND next_attempt_at <= NOW()

        AND attempts < max_attempts

        AND (
          expires_at IS NULL
          OR expires_at > NOW()
        )

      ORDER BY

        next_attempt_at ASC,

        scheduled_at ASC,

        id ASC

      LIMIT 1

      FOR UPDATE SKIP LOCKED
    )

    UPDATE volunteer_notification_jobs j

    SET

      status = 'processing',

      attempts = j.attempts + 1,

      locked_at = NOW(),

      lock_token = $1,

      updated_at = NOW()

    FROM next_job

    WHERE j.id = next_job.id

    RETURNING j.*
    `,
    [
      lockToken,
    ]
  );

  return result.rows.length
    ? result.rows[0] as VolunteerNotificationJob
    : null;
}

// ========================================
// 4. CHECK WORKER OWNERSHIP / RENEW LOCK
// ========================================

export async function renewVolunteerNotificationLock(
  jobId: string,
  lockToken: string
): Promise<boolean> {

  const result = await pool.query(
    `
    UPDATE volunteer_notification_jobs

    SET

      locked_at = NOW(),

      updated_at = NOW()

    WHERE id = $1

      AND lock_token = $2

      AND status = 'processing'

      AND locked_at IS NOT NULL

      AND locked_at >
        NOW() -
        ($3::integer * INTERVAL '1 minute')

      AND (
        expires_at IS NULL
        OR expires_at > NOW()
      )
    `,
    [
      jobId,
      lockToken,
      STALE_LOCK_MINUTES,
    ]
  );

  return result.rowCount === 1;
}

// ========================================
// 5. LINK EXISTING NOTIFICATION RECORD
// ========================================

export async function linkVolunteerNotificationRecord(
  jobId: string,
  lockToken: string,
  notificationId: number,
  client?: PoolClient
): Promise<boolean> {

  if (!isValidId(notificationId)) {

    throw new Error(
      'Invalid notification ID'
    );
  }

  const db = client ?? pool;

  const result = await db.query(
    `
    UPDATE volunteer_notification_jobs

    SET

      notification_id = $3,

      updated_at = NOW()

    WHERE id = $1

      AND lock_token = $2

      AND status = 'processing'

      AND (
        notification_id IS NULL
        OR notification_id = $3
      )
    `,
    [
      jobId,
      lockToken,
      notificationId,
    ]
  );

  return result.rowCount === 1;
}

// ========================================
// 6. MARK JOB AS PROCESSED
// ========================================

export async function completeVolunteerNotificationJob(
  jobId: string,
  lockToken: string
): Promise<boolean> {

  const result = await pool.query(
    `
    UPDATE volunteer_notification_jobs

    SET

      status = 'sent',

      processed_at = NOW(),

      updated_at = NOW(),

      locked_at = NULL,

      lock_token = NULL,

      last_error = NULL

    WHERE id = $1

      AND lock_token = $2

      AND status = 'processing'

      AND notification_id IS NOT NULL
    `,
    [
      jobId,
      lockToken,
    ]
  );

  return result.rowCount === 1;
}

// ========================================
// 7. RETRY OR MARK PERMANENTLY FAILED
// ========================================

export async function failVolunteerNotificationJob(
  job: VolunteerNotificationJob,
  errorMessage: string,
  retryable: boolean = true
): Promise<boolean> {

  if (!job.lock_token) {
    return false;
  }

  const delayIndex = Math.min(

    Math.max(job.attempts - 1, 0),

    RETRY_DELAYS_SECONDS.length - 1
  );

  const retryDelay =
    RETRY_DELAYS_SECONDS[delayIndex];

  const result = await pool.query(
    `
    UPDATE volunteer_notification_jobs

    SET

      status = CASE

        WHEN expires_at IS NOT NULL
          AND expires_at <= NOW()
        THEN 'expired'

        WHEN $5::boolean = FALSE
          OR attempts >= max_attempts
        THEN 'failed'

        WHEN expires_at IS NOT NULL
          AND expires_at <=
            NOW() + ($4::integer * INTERVAL '1 second')
        THEN 'expired'

        ELSE 'pending'

      END,

      next_attempt_at =
        NOW() + ($4::integer * INTERVAL '1 second'),

      processed_at = CASE

        WHEN $5::boolean = FALSE

          OR attempts >= max_attempts

          OR (
            expires_at IS NOT NULL
            AND expires_at <=
              NOW() + ($4::integer * INTERVAL '1 second')
          )

        THEN NOW()

        ELSE NULL

      END,

      last_error = $3,

      locked_at = NULL,

      lock_token = NULL,

      updated_at = NOW()

    WHERE id = $1

      AND lock_token = $2

      AND status = 'processing'
    `,
    [
      job.id,

      job.lock_token,

      errorMessage.slice(0, 2000),

      retryDelay,

      retryable,
    ]
  );

  return result.rowCount === 1;
}

// ========================================
// 8. CANCEL A CLAIMED JOB
// ========================================

export async function cancelVolunteerNotificationJob(
  jobId: string,
  lockToken: string,
  reason: string
): Promise<boolean> {

  const result = await pool.query(
    `
    UPDATE volunteer_notification_jobs

    SET

      status = 'cancelled',

      last_error = $3,

      processed_at = NOW(),

      updated_at = NOW(),

      locked_at = NULL,

      lock_token = NULL

    WHERE id = $1

      AND lock_token = $2

      AND status = 'processing'
    `,
    [
      jobId,

      lockToken,

      reason.slice(0, 2000),
    ]
  );

  return result.rowCount === 1;
}

// ========================================
// 9. RECOVER INTERRUPTED PROCESSING
// ========================================

export async function recoverVolunteerNotificationJobs() {

  const result = await pool.query(
    `
    UPDATE volunteer_notification_jobs

    SET

      status = CASE

        WHEN expires_at IS NOT NULL
          AND expires_at <= NOW()
        THEN 'expired'

        WHEN attempts >= max_attempts
        THEN 'failed'

        ELSE 'pending'

      END,

      next_attempt_at = NOW(),

      processed_at = CASE

        WHEN attempts >= max_attempts

          OR (
            expires_at IS NOT NULL
            AND expires_at <= NOW()
          )

        THEN NOW()

        ELSE NULL

      END,

      last_error =
        'Recovered interrupted notification processing',

      locked_at = NULL,

      lock_token = NULL,

      updated_at = NOW()

    WHERE status = 'processing'

      AND (

        locked_at IS NULL

        OR locked_at <
          NOW() - ($1::integer * INTERVAL '1 minute')
      )
    `,
    [
      STALE_LOCK_MINUTES,
    ]
  );

  return result.rowCount ?? 0;
}

// ========================================
// 10. CONTINUE UNFINISHED NOTIFICATION JOB
// ========================================

export async function continueVolunteerNotificationJob(
  jobId: string,
  lockToken: string,
  nextAttemptAt: Date = new Date()
): Promise<boolean> {

  if (
    !Number.isFinite(
      nextAttemptAt.getTime()
    )
  ) {

    throw new Error(
      'Invalid continuation time'
    );
  }

  const result = await pool.query(
    `
    UPDATE volunteer_notification_jobs

    SET

      status = CASE

        WHEN expires_at IS NOT NULL
          AND expires_at <=
            GREATEST(NOW(), $3::timestamptz)
        THEN 'expired'

        ELSE 'pending'

      END,

      next_attempt_at =
        GREATEST(NOW(), $3::timestamptz),

      attempts =
        GREATEST(attempts - 1, 0),

      processed_at = CASE

        WHEN expires_at IS NOT NULL
          AND expires_at <=
            GREATEST(NOW(), $3::timestamptz)
        THEN NOW()

        ELSE NULL

      END,

      locked_at = NULL,

      lock_token = NULL,

      updated_at = NOW()

    WHERE id = $1

      AND lock_token = $2

      AND status = 'processing'
    `,
    [
      jobId,

      lockToken,

      nextAttemptAt,
    ]
  );

  return result.rowCount === 1;
}

// ========================================
// 11. VERIFY CURRENT WORKER OWNERSHIP
// ========================================

export async function ownsVolunteerNotificationJob(
  jobId: string,
  lockToken: string
): Promise<boolean> {

  const result = await pool.query(
    `
    SELECT id

    FROM volunteer_notification_jobs

    WHERE id = $1

      AND lock_token = $2

      AND status = 'processing'

      AND locked_at IS NOT NULL

      AND locked_at >
        NOW() -
        ($3::integer * INTERVAL '1 minute')

      AND (
        expires_at IS NULL
        OR expires_at > NOW()
      )

    LIMIT 1
    `,
    [
      jobId,

      lockToken,

      STALE_LOCK_MINUTES,
    ]
  );

  return result.rows.length === 1;
}

// ========================================
// 12. EXPIRE A CLAIMED NOTIFICATION JOB
// ========================================

export async function expireClaimedVolunteerNotificationJob(
  jobId: string,
  lockToken: string
): Promise<boolean> {

  const result = await pool.query(
    `
    UPDATE volunteer_notification_jobs

    SET

      status = 'expired',

      processed_at = NOW(),

      last_error =
        'Notification validity period ended',

      locked_at = NULL,

      lock_token = NULL,

      updated_at = NOW()

    WHERE id = $1

      AND lock_token = $2

      AND status = 'processing'

      AND expires_at IS NOT NULL

      AND expires_at <= NOW()
    `,
    [
      jobId,

      lockToken,
    ]
  );

  return result.rowCount === 1;
}