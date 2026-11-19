import { pool } from '../db';

import {
  VolunteerNotificationJob,
  linkVolunteerNotificationRecord,
} from './volunteerNotificationQueueService';

// ========================================
// TYPES
// ========================================

export interface VolunteerDeliveryContent {
  title: string;
  body: string;

  data: {
    type: 'volunteer_seva';
    event: string;
    screen: string;

    [key: string]: unknown;
  };
}

export interface PreparedVolunteerNotification {
  notificationId: number;
  status: string;
  created: boolean;
}

// ========================================
// PREPARE PERSISTENT NOTIFICATION RECORD
// ========================================

export async function prepareVolunteerNotification(
  job: VolunteerNotificationJob,
  content: VolunteerDeliveryContent
): Promise<PreparedVolunteerNotification> {

  if (!job.lock_token) {
    throw new Error(
      'Notification job has no active worker lock'
    );
  }

  if (
    typeof content.title !== 'string' ||
    !content.title.trim() ||
    content.title.length > 255
  ) {
    throw new Error(
      'Invalid notification title'
    );
  }

  if (
    typeof content.body !== 'string' ||
    !content.body.trim()
  ) {
    throw new Error(
      'Invalid notification body'
    );
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Lock the queue record and confirm that
    // the current worker still owns the job.

    const jobResult = await client.query(
      `
      SELECT *
      FROM volunteer_notification_jobs

      WHERE id = $1
        AND lock_token = $2
        AND status = 'processing'

        AND (
          expires_at IS NULL
          OR expires_at > NOW()
        )

      FOR UPDATE
      `,
      [
        job.id,
        job.lock_token,
      ]
    );

    if (!jobResult.rows.length) {
      throw new Error(
        'Notification job is no longer available'
      );
    }

    const currentJob =
      jobResult.rows[0] as VolunteerNotificationJob;

    // ========================================
    // REUSE EXISTING NOTIFICATION
    // ========================================

    if (currentJob.notification_id !== null) {
      const existing = await client.query(
        `
        SELECT
          id,
          status

        FROM notifications

        WHERE id = $1
          AND notification_type = 'volunteer_seva'
        `,
        [
          currentJob.notification_id,
        ]
      );

      if (!existing.rows.length) {
        throw new Error(
          'Linked notification record not found'
        );
      }

      await client.query('COMMIT');

      return {
        notificationId:
          Number(existing.rows[0].id),

        status:
          String(existing.rows[0].status),

        created: false,
      };
    }

    // ========================================
    // VALIDATE TARGET
    // ========================================

    if (
      currentJob.target_type !== 'all' &&
      currentJob.target_type !== 'user'
    ) {
      throw new Error(
        'Invalid notification target'
      );
    }

    if (
      currentJob.target_type === 'user'
    ) {
      if (
        currentJob.recipient_user_id === null
      ) {
        throw new Error(
          'Missing notification recipient'
        );
      }

      const userResult = await client.query(
        `
        SELECT id
        FROM users
        WHERE id = $1
        `,
        [
          currentJob.recipient_user_id,
        ]
      );

      if (!userResult.rows.length) {
        throw new Error(
          'Notification recipient not found'
        );
      }
    }

    // ========================================
    // CREATE NOTIFICATION
    // ========================================

    const notificationResult =
      await client.query(
        `
        INSERT INTO notifications (
          title,
          body,
          notification_type,
          data,
          target_type,
          status
        )

        VALUES (
          $1,
          $2,
          'volunteer_seva',
          $3::jsonb,
          $4,
          'pending'
        )

        RETURNING
          id,
          status
        `,
        [
          content.title.trim(),
          content.body.trim(),

          JSON.stringify({
            ...content.data,

            type: 'volunteer_seva',

            event: currentJob.event_type,
          }),

          currentJob.target_type,
        ]
      );

    const notification =
      notificationResult.rows[0];

    const notificationId =
      Number(notification.id);

    // ========================================
    // CREATE RECIPIENT DELIVERY RECORDS
    // ========================================

    if (currentJob.target_type === 'user') {
      await client.query(
        `
        INSERT INTO notification_deliveries (
          notification_id,
          user_id,
          status
        )

        VALUES (
          $1,
          $2,
          'pending'
        )

        ON CONFLICT (
          notification_id,
          user_id
        )

        DO NOTHING
        `,
        [
          notificationId,
          currentJob.recipient_user_id,
        ]
      );
    } else {
      await client.query(
        `
        INSERT INTO notification_deliveries (
          notification_id,
          user_id,
          status
        )

        SELECT
          $1,
          id,
          'pending'

        FROM users

        ON CONFLICT (
          notification_id,
          user_id
        )

        DO NOTHING
        `,
        [
          notificationId,
        ]
      );
    }

    // ========================================
    // LINK NOTIFICATION TO QUEUE JOB
    // ========================================

    const linked =
      await linkVolunteerNotificationRecord(
        currentJob.id,
        currentJob.lock_token!,
        notificationId,
        client
      );

    if (!linked) {
      throw new Error(
        'Failed to link notification to queue job'
      );
    }

    await client.query('COMMIT');

    return {
      notificationId,
      status: String(notification.status),
      created: true,
    };

  } catch (error) {

    await client.query('ROLLBACK');

    throw error;

  } finally {

    client.release();

  }
}