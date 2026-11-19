import { pool } from '../db';

import {
  syncVolunteerNotificationSummaries,
} from './volunteerNotificationSummaryService';

// ========================================
// CONFIGURATION
// ========================================

const CLEANUP_BATCH_LIMIT = 100;

// ========================================
// TYPES
// ========================================

interface CleanupSummary {
  jobs: number;
  skippedDevices: number;
  unknownDevices: number;
  updatedDeliveries: number;
  updatedNotifications: number;
  errors: number;
}

let cleanupRunning = false;

// ========================================
// CLEANUP TERMINAL NOTIFICATION JOBS
// ========================================

export async function cleanupTerminalVolunteerNotificationJobs(
  limit: number = CLEANUP_BATCH_LIMIT
): Promise<CleanupSummary> {

  const summary: CleanupSummary = {
    jobs: 0,
    skippedDevices: 0,
    unknownDevices: 0,
    updatedDeliveries: 0,
    updatedNotifications: 0,
    errors: 0,
  };

  if (cleanupRunning) {
    return summary;
  }

  cleanupRunning = true;

  try {

    const batchLimit =
      Number.isInteger(limit) && limit > 0
        ? Math.min(limit, 500)
        : CLEANUP_BATCH_LIMIT;

    // ========================================
    // FIND TERMINAL JOBS REQUIRING CLEANUP
    // ========================================

    const result = await pool.query(
      `
      SELECT j.id

      FROM volunteer_notification_jobs j

      WHERE j.status IN (
        'cancelled',
        'expired',
        'failed'
      )

      AND (

        EXISTS (

          SELECT 1

          FROM volunteer_notification_devices vd

          WHERE vd.job_id = j.id

            AND vd.status IN (
              'pending',
              'retry',
              'processing'
            )
        )

        OR EXISTS (

          SELECT 1

          FROM notification_deliveries nd

          WHERE nd.notification_id =
            j.notification_id

            AND nd.status = 'pending'
        )

        OR EXISTS (

          SELECT 1

          FROM notifications n

          WHERE n.id = j.notification_id

            AND n.notification_type =
              'volunteer_seva'

            AND n.status IN (
              'pending',
              'processing'
            )
        )
      )

      ORDER BY j.id ASC

      LIMIT $1
      `,
      [
        batchLimit,
      ]
    );

    // ========================================
    // PROCESS EACH TERMINAL JOB
    // ========================================

    for (const row of result.rows) {

      const jobId = String(row.id);

      const client = await pool.connect();

      let skippedDevices = 0;

      let unknownDevices = 0;

      let updatedDeliveries = 0;

      let updatedNotifications = 0;

      try {

        await client.query('BEGIN');

        // Lock the terminal job to prevent
        // simultaneous cleanup operations.

        const lockedJob = await client.query(
          `
          SELECT

            id,

            status,

            notification_id,

            last_error

          FROM volunteer_notification_jobs

          WHERE id = $1

            AND status IN (
              'cancelled',
              'expired',
              'failed'
            )

          FOR UPDATE SKIP LOCKED
          `,
          [
            jobId,
          ]
        );

        if (!lockedJob.rows.length) {

          await client.query('ROLLBACK');

          continue;
        }

        const job = lockedJob.rows[0];

        const reason =
          job.status === 'cancelled'

            ? 'Notification event cancelled'

            : job.status === 'expired'

              ? 'Notification validity period ended'

              : 'Notification processing permanently failed';

        // ========================================
        // 1. SKIP UNSENT DEVICES
        // ========================================

        const skippedResult =
          await client.query(
            `
            UPDATE volunteer_notification_devices

            SET

              status = 'skipped',

              last_error = $2,

              updated_at = NOW()

            WHERE job_id = $1

              AND status IN (
                'pending',
                'retry'
              )
            `,
            [
              jobId,
              reason,
            ]
          );

        skippedDevices =
          skippedResult.rowCount ?? 0;

        // ========================================
        // 2. HANDLE INTERRUPTED DEVICE SUBMISSIONS
        // ========================================

        const unknownResult =
          await client.query(
            `
            UPDATE volunteer_notification_devices

            SET

              status = 'unknown',

              last_error =
                'Push submission interrupted before outcome was recorded',

              updated_at = NOW()

            WHERE job_id = $1

              AND status = 'processing'
            `,
            [
              jobId,
            ]
          );

        unknownDevices =
          unknownResult.rowCount ?? 0;

        // ========================================
        // 3. UPDATE USER-LEVEL DELIVERY RECORDS
        // ========================================

        if (job.notification_id !== null) {

          const deliveryResult =
            await client.query(
              `
              UPDATE notification_deliveries nd

              SET

                status = CASE

                  WHEN EXISTS (

                    SELECT 1

                    FROM volunteer_notification_devices vd

                    WHERE vd.job_id = $1

                      AND vd.user_id = nd.user_id

                      AND vd.status = 'delivered'

                  ) THEN 'delivered'

                  WHEN EXISTS (

                    SELECT 1

                    FROM volunteer_notification_devices vd

                    WHERE vd.job_id = $1

                      AND vd.user_id = nd.user_id

                      AND vd.status = 'accepted'

                  ) THEN 'sent'

                  WHEN EXISTS (

                    SELECT 1

                    FROM volunteer_notification_devices vd

                    WHERE vd.job_id = $1

                      AND vd.user_id = nd.user_id

                      AND vd.status = 'unknown'

                  ) THEN 'unknown'

                  WHEN EXISTS (

                    SELECT 1

                    FROM volunteer_notification_devices vd

                    WHERE vd.job_id = $1

                      AND vd.user_id = nd.user_id

                      AND vd.status = 'failed'

                  ) THEN 'failed'

                  ELSE $3::varchar

                END,

                error_message = CASE

                  WHEN EXISTS (

                    SELECT 1

                    FROM volunteer_notification_devices vd

                    WHERE vd.job_id = $1

                      AND vd.user_id = nd.user_id

                      AND vd.status IN (
                        'accepted',
                        'delivered'
                      )

                  ) THEN NULL

                  ELSE $4

                END

              WHERE nd.notification_id = $2

                AND nd.status = 'pending'
              `,
              [
                jobId,
                job.notification_id,
                job.status,
                reason,
              ]
            );

          updatedDeliveries =
            deliveryResult.rowCount ?? 0;

          // ========================================
          // 4. UPDATE PARENT NOTIFICATION STATUS
          // ========================================

          const notificationResult =
            await client.query(
              `
              UPDATE notifications n

              SET

                status = CASE

                  WHEN EXISTS (

                    SELECT 1

                    FROM volunteer_notification_devices vd

                    WHERE vd.job_id = $1

                      AND vd.status IN (
                        'accepted',
                        'delivered'
                      )

                  ) THEN 'sent'

                  WHEN EXISTS (

                    SELECT 1

                    FROM volunteer_notification_devices vd

                    WHERE vd.job_id = $1

                      AND vd.status = 'unknown'

                  ) THEN 'unknown'

                  ELSE $3::varchar

                END,

                sent_at = CASE

                  WHEN EXISTS (

                    SELECT 1

                    FROM volunteer_notification_devices vd

                    WHERE vd.job_id = $1

                      AND vd.accepted_at IS NOT NULL

                  ) THEN COALESCE(

                    n.sent_at,

                    (
                      SELECT MIN(vd.accepted_at)

                      FROM volunteer_notification_devices vd

                      WHERE vd.job_id = $1
                    )
                  )

                  ELSE n.sent_at

                END,

                updated_at = NOW()

              WHERE n.id = $2

                AND n.notification_type =
                  'volunteer_seva'

                AND n.status IN (
                  'pending',
                  'processing'
                )
              `,
              [
                jobId,
                job.notification_id,
                job.status,
              ]
            );

          updatedNotifications =
            notificationResult.rowCount ?? 0;
        }

        await client.query('COMMIT');

        // Record only committed changes.

        summary.jobs++;

        summary.skippedDevices +=
          skippedDevices;

        summary.unknownDevices +=
          unknownDevices;

        summary.updatedDeliveries +=
          updatedDeliveries;

        summary.updatedNotifications +=
          updatedNotifications;

      } catch (error) {

        await client.query('ROLLBACK');

        summary.errors++;

        console.error(
          '[Volunteer Cleanup] Job cleanup failed:',
          jobId,
          error
        );

      } finally {

        client.release();
      }
    }

    return summary;

  } finally {

    cleanupRunning = false;
  }
}

// ========================================
// RECONCILE COMPLETED NOTIFICATION SUMMARIES
// ========================================

export async function reconcileTerminalVolunteerNotificationSummaries(
  limit: number = CLEANUP_BATCH_LIMIT
): Promise<number> {

  const batchLimit =
    Number.isInteger(limit) && limit > 0
      ? Math.min(limit, 500)
      : CLEANUP_BATCH_LIMIT;

  const result = await pool.query(
    `
    SELECT DISTINCT j.id

    FROM volunteer_notification_jobs j

    JOIN volunteer_notification_devices vd
      ON vd.job_id = j.id

    JOIN notification_deliveries nd
      ON nd.notification_id = j.notification_id

      AND nd.user_id = vd.user_id

    WHERE j.status IN (
      'sent',
      'failed',
      'cancelled',
      'expired'
    )

    AND (

      nd.status = 'pending'

      OR (

        vd.status = 'delivered'

        AND nd.status <> 'delivered'
      )

      OR (

        vd.status = 'accepted'

        AND nd.status NOT IN (
          'sent',
          'delivered'
        )
      )

      OR (

        nd.status = 'sent'

        AND NOT EXISTS (

          SELECT 1

          FROM volunteer_notification_devices other

          WHERE other.job_id = j.id

            AND other.user_id = nd.user_id

            AND other.status IN (
              'accepted',
              'delivered'
            )
        )
      )
    )

    AND NOT EXISTS (

      SELECT 1

      FROM volunteer_notification_devices unfinished

      WHERE unfinished.job_id = j.id

        AND unfinished.status IN (
          'pending',
          'retry',
          'processing'
        )
    )

    ORDER BY j.id ASC

    LIMIT $1
    `,
    [
      batchLimit,
    ]
  );

  let updated = 0;

  for (const row of result.rows) {

    updated +=
      await syncVolunteerNotificationSummaries(
        String(row.id)
      );
  }

  return updated;
}