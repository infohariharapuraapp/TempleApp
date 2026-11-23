import { Expo } from 'expo-server-sdk';
import { pool } from '../db';

import {
  VolunteerNotificationJob,
} from './volunteerNotificationQueueService';

const expo = new Expo();

// ========================================
// TYPES
// ========================================

interface VolunteerPushDevice {
  id: string;
  device_token_id: number;
  user_id: number;
  expo_push_token: string;
  attempts: number;
}

interface DeviceDeliveryOutcome {
  status:
    | 'accepted'
    | 'retry'
    | 'failed'
    | 'skipped'
    | 'unknown';

  ticketId?: string;
  error?: string;
}

// ========================================
// INITIALIZE DEVICE DELIVERY RECORDS
// ========================================

export async function initializeVolunteerPushDevices(
  job: VolunteerNotificationJob,
  notificationId: number
): Promise<number> {

  const result = await pool.query(
    `
    INSERT INTO volunteer_notification_devices (
      job_id,
      device_token_id,
      user_id
    )

    SELECT
      j.id,
      dt.id,
      dt.user_id

    FROM volunteer_notification_jobs j

    JOIN notification_deliveries nd
      ON nd.notification_id = j.notification_id

    JOIN device_tokens dt
      ON dt.user_id = nd.user_id

    WHERE j.id = $1
      AND j.lock_token = $2
      AND j.status = 'processing'
      AND j.notification_id = $3
      AND dt.is_active = TRUE
      AND dt.user_id IS NOT NULL

      AND (
        j.target_type = 'all'
        OR (
          j.target_type = 'user'
          AND dt.user_id = j.recipient_user_id
        )
      )

      AND (
        j.expires_at IS NULL
        OR j.expires_at > NOW()
      )

    ON CONFLICT (job_id, device_token_id)
    DO NOTHING
    `,
    [
      job.id,
      job.lock_token,
      notificationId,
    ]
  );

  return result.rowCount ?? 0;
}

// ========================================
// SKIP INACTIVE OR REASSIGNED DEVICES
// ========================================

export async function skipUnavailableVolunteerDevices(
  job: VolunteerNotificationJob
): Promise<number> {

  const result = await pool.query(
    `
    UPDATE volunteer_notification_devices vd

    SET
      status = 'skipped',
      last_error = 'Device inactive or owner changed',
      updated_at = NOW()

    FROM
      device_tokens dt,
      volunteer_notification_jobs j

    WHERE vd.job_id = j.id
      AND vd.device_token_id = dt.id

      AND j.id = $1
      AND j.lock_token = $2
      AND j.status = 'processing'

      AND vd.status IN (
        'pending',
        'retry'
      )

      AND (
  dt.is_active IS NOT TRUE
  OR dt.user_id IS DISTINCT FROM vd.user_id
)
    `,
    [
      job.id,
      job.lock_token,
    ]
  );

  return result.rowCount ?? 0;
}

// ========================================
// RECOVER AMBIGUOUS DEVICE SUBMISSIONS
// ========================================

export async function recoverInterruptedVolunteerDevices(
  job: VolunteerNotificationJob
): Promise<number> {

  const result = await pool.query(
    `
    UPDATE volunteer_notification_devices vd

    SET
      status = 'unknown',
      last_error =
        'Previous submission interrupted; delivery uncertain',
      updated_at = NOW()

    FROM volunteer_notification_jobs j

    WHERE vd.job_id = j.id
      AND j.id = $1
      AND j.lock_token = $2
      AND j.status = 'processing'
      AND vd.status = 'processing'
    `,
    [
      job.id,
      job.lock_token,
    ]
  );

  return result.rowCount ?? 0;
}

// ========================================
// CLAIM ONE AVAILABLE DEVICE
// ========================================

async function claimVolunteerPushDevice(
  job: VolunteerNotificationJob
): Promise<VolunteerPushDevice | null> {

  const result = await pool.query(
    `
    WITH next_device AS (
      SELECT
        vd.id,
        dt.expo_push_token

      FROM volunteer_notification_devices vd

      JOIN volunteer_notification_jobs j
        ON j.id = vd.job_id

      JOIN device_tokens dt
        ON dt.id = vd.device_token_id

      WHERE j.id = $1
        AND j.lock_token = $2
        AND j.status = 'processing'

        AND vd.status IN (
          'pending',
          'retry'
        )

        AND vd.next_attempt_at <= NOW()
        AND vd.attempts < j.max_attempts

        AND dt.is_active = TRUE
        AND dt.user_id = vd.user_id

        AND (
          j.expires_at IS NULL
          OR j.expires_at > NOW()
        )

      ORDER BY vd.id ASC

      LIMIT 1

      FOR UPDATE OF vd SKIP LOCKED
    )

    UPDATE volunteer_notification_devices vd

    SET
      status = 'processing',
      attempts = vd.attempts + 1,
      last_attempt_at = NOW(),
      updated_at = NOW()

    FROM next_device

    WHERE vd.id = next_device.id

    RETURNING
      vd.id,
      vd.device_token_id,
      vd.user_id,
      vd.attempts,
      next_device.expo_push_token
    `,
    [
      job.id,
      job.lock_token,
    ]
  );

  return result.rows.length
    ? result.rows[0] as VolunteerPushDevice
    : null;
}

// ========================================
// SAVE DEVICE DELIVERY RESULT
// ========================================

async function saveVolunteerDeviceOutcome(
  job: VolunteerNotificationJob,
  device: VolunteerPushDevice,
  outcome: DeviceDeliveryOutcome
): Promise<boolean> {

  const retryDelay =
    device.attempts <= 1
      ? 60
      : 300;

  const result = await pool.query(
    `
    UPDATE volunteer_notification_devices vd

    SET
      status = CASE

        WHEN $4 = 'retry'
          AND vd.attempts >= j.max_attempts
        THEN 'failed'

        WHEN $4 = 'retry'
          AND j.expires_at IS NOT NULL
          AND j.expires_at <=
            NOW() + ($7::integer * INTERVAL '1 second')
        THEN 'skipped'

        ELSE $4

      END,

      expo_ticket_id = $5,
      last_error = $6,

      accepted_at = CASE
        WHEN $4 = 'accepted'
        THEN NOW()
        ELSE accepted_at
      END,

      next_attempt_at = CASE
        WHEN $4 = 'retry'
        THEN NOW() +
          ($7::integer * INTERVAL '1 second')
        ELSE vd.next_attempt_at
      END,

      updated_at = NOW()

    FROM volunteer_notification_jobs j

    WHERE vd.job_id = j.id
      AND vd.id = $3
      AND j.id = $1
      AND j.lock_token = $2
      AND j.status = 'processing'
      AND vd.status = 'processing'

    RETURNING vd.id
    `,
    [
      job.id,
      job.lock_token,
      device.id,
      outcome.status,
      outcome.ticketId ?? null,
      outcome.error?.slice(0, 2000) ?? null,
      retryDelay,
    ]
  );

  return result.rowCount === 1;
}

// ========================================
// DEACTIVATE INVALID DEVICE TOKEN
// ========================================

async function deactivateVolunteerPushDevice(
  device: VolunteerPushDevice
): Promise<void> {

  await pool.query(
    `
    UPDATE device_tokens

    SET
      is_active = FALSE,
      updated_at = NOW()

    WHERE id = $1
      AND user_id = $2
      AND expo_push_token = $3
    `,
    [
      device.device_token_id,
      device.user_id,
      device.expo_push_token,
    ]
  );
}

// ========================================
// SEND NEXT DEVICE NOTIFICATION
// ========================================

export async function sendNextVolunteerPushDevice(
  job: VolunteerNotificationJob,
  notificationId: number
): Promise<boolean> {

  if (!job.lock_token) {
    throw new Error(
      'Missing notification worker lock'
    );
  }

  const notificationResult = await pool.query(
    `
    SELECT
      n.title,
      n.body,
      n.data

    FROM notifications n

    JOIN volunteer_notification_jobs j
      ON j.notification_id = n.id

    WHERE n.id = $1
      AND n.notification_type = 'volunteer_seva'
      AND j.id = $2
      AND j.lock_token = $3
      AND j.status = 'processing'
      AND n.status <> 'cancelled'
    `,
    [
      notificationId,
      job.id,
      job.lock_token,
    ]
  );

  if (!notificationResult.rows.length) {
    throw new Error(
      'Notification not available for delivery'
    );
  }

  const notification =
    notificationResult.rows[0];

  const device =
    await claimVolunteerPushDevice(job);

  if (!device) {
    return false;
  }

  // Validate token format.

  if (
    !Expo.isExpoPushToken(
      device.expo_push_token
    )
  ) {

    await saveVolunteerDeviceOutcome(
      job,
      device,
      {
        status: 'failed',
        error: 'Invalid Expo push token',
      }
    );

    await deactivateVolunteerPushDevice(
      device
    );

    return true;
  }

  // Revalidate current ownership and
  // worker lock immediately before sending.

  const currentDevice = await pool.query(
    `
    SELECT dt.id

    FROM device_tokens dt

    JOIN volunteer_notification_devices vd
      ON vd.device_token_id = dt.id

    JOIN volunteer_notification_jobs j
      ON j.id = vd.job_id

    JOIN notifications n
      ON n.id = j.notification_id

    WHERE vd.id = $1
      AND dt.user_id = vd.user_id
      AND dt.expo_push_token = $2
      AND dt.is_active = TRUE

      AND j.id = $3
      AND j.lock_token = $4
      AND j.status = 'processing'
      AND vd.status = 'processing'
      AND n.status <> 'cancelled'

      AND (
        j.expires_at IS NULL
        OR j.expires_at > NOW()
      )
    `,
    [
      device.id,
      device.expo_push_token,
      job.id,
      job.lock_token,
    ]
  );

  if (!currentDevice.rows.length) {

    await saveVolunteerDeviceOutcome(
      job,
      device,
      {
        status: 'skipped',
        error: 'Device or job no longer eligible',
      }
    );

    return true;
  }

  let outcome: DeviceDeliveryOutcome;

  let deactivateToken = false;

  try {

    const data =
      typeof notification.data === 'string'
        ? JSON.parse(notification.data)
        : notification.data;

    const tickets =
      await expo.sendPushNotificationsAsync([
        {
          to: device.expo_push_token,

          title: notification.title,

          body: notification.body,

          sound: 'default',

          channelId: 'default',

          data: {
            ...data,
            type: 'volunteer_seva',
            notificationId,
          },
        },
      ]);

    const ticket = tickets[0];

    if (!ticket) {

      outcome = {
        status: 'unknown',

        error:
          'Expo returned no ticket; submission uncertain',
      };

    } else if (ticket.status === 'ok') {

      outcome = {
        status: 'accepted',

        ticketId: ticket.id,
      };

    } else {

      const errorCode =
        ticket.details?.error;

      if (
        errorCode === 'DeviceNotRegistered'
      ) {

        deactivateToken = true;

        outcome = {
          status: 'failed',

          error: JSON.stringify(ticket),
        };

      } else if (
        errorCode === 'MessageRateExceeded'
      ) {

        outcome = {
          status: 'retry',

          error: JSON.stringify(ticket),
        };

      } else {

        outcome = {
          status: 'failed',

          error: JSON.stringify(ticket),
        };

      }
    }

  } catch (error) {

    // A network interruption does not prove
    // that Expo rejected the notification.
    // Avoid blindly resending it.

    outcome = {
      status: 'unknown',

      error: String(error),
    };

  }

  const saved =
    await saveVolunteerDeviceOutcome(
      job,
      device,
      outcome
    );

  if (!saved) {
    throw new Error(
      'Worker lock lost while saving push result'
    );
  }

  if (deactivateToken) {
    await deactivateVolunteerPushDevice(
      device
    );
  }

  return true;
}

// ========================================
// GET DEVICE DELIVERY SUMMARY
// ========================================

export async function getVolunteerPushSummary(
  jobId: string
) {

  const result = await pool.query(
    `
    SELECT
      COUNT(*)::integer AS total,

      COUNT(*) FILTER (
        WHERE status = 'pending'
      )::integer AS pending,

      COUNT(*) FILTER (
        WHERE status = 'processing'
      )::integer AS processing,

      COUNT(*) FILTER (
        WHERE status = 'retry'
      )::integer AS retry,

      COUNT(*) FILTER (
        WHERE status = 'accepted'
      )::integer AS accepted,

      COUNT(*) FILTER (
        WHERE status = 'delivered'
      )::integer AS delivered,

      COUNT(*) FILTER (
        WHERE status = 'failed'
      )::integer AS failed,

      COUNT(*) FILTER (
        WHERE status = 'skipped'
      )::integer AS skipped,

      COUNT(*) FILTER (
        WHERE status = 'unknown'
      )::integer AS unknown,

      MIN(next_attempt_at) FILTER (
        WHERE status IN (
          'pending',
          'retry'
        )
      ) AS next_attempt_at

    FROM volunteer_notification_devices

    WHERE job_id = $1
    `,
    [
      jobId,
    ]
  );

  return result.rows[0];
}