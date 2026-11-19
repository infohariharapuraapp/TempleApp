import { pool } from '../db';

// ========================================
// SYNCHRONIZE USER DELIVERY SUMMARIES
// ========================================

export async function syncVolunteerNotificationSummaries(
  jobId: string
): Promise<number> {

  const result = await pool.query(
    `
    WITH device_summary AS (

      SELECT
        vd.user_id,

        COUNT(*)::integer AS total,

        COUNT(*) FILTER (
          WHERE vd.status IN (
            'accepted',
            'delivered'
          )
        )::integer AS successful,

        COUNT(*) FILTER (
          WHERE vd.status = 'delivered'
        )::integer AS delivered,

        COUNT(*) FILTER (
          WHERE vd.status IN (
            'pending',
            'processing',
            'retry'
          )
        )::integer AS unfinished,

        COUNT(*) FILTER (
          WHERE vd.status = 'unknown'
        )::integer AS unknown,

        COUNT(*) FILTER (
          WHERE vd.status = 'failed'
        )::integer AS failed,

        MIN(vd.accepted_at) AS sent_at,

        MIN(vd.receipt_checked_at) FILTER (
          WHERE vd.status = 'delivered'
        ) AS delivered_at,

        MAX(vd.last_error) AS last_error

      FROM volunteer_notification_devices vd

      WHERE vd.job_id = $1

      GROUP BY vd.user_id
    )

    UPDATE notification_deliveries nd

    SET

      status = CASE

        WHEN ds.delivered > 0
        THEN 'delivered'

        WHEN ds.successful > 0
        THEN 'sent'

        WHEN ds.unfinished > 0
        THEN 'pending'

        WHEN ds.unknown > 0
        THEN 'unknown'

        WHEN ds.failed > 0
        THEN 'failed'

        ELSE 'no_device'

      END,

      sent_at = COALESCE(
        nd.sent_at,
        ds.sent_at
      ),

      delivered_at = COALESCE(
        nd.delivered_at,
        ds.delivered_at
      ),

      error_message = CASE

        WHEN ds.successful > 0
        THEN NULL

        WHEN ds.unfinished > 0
        THEN NULL

        ELSE LEFT(ds.last_error, 2000)

      END

    FROM
      volunteer_notification_jobs j,
      device_summary ds

    WHERE j.id = $1

      AND j.notification_id =
        nd.notification_id

      AND nd.user_id = ds.user_id
    `,
    [
      jobId,
    ]
  );

  return result.rowCount ?? 0;
}

// ========================================
// MARK USERS WITHOUT ELIGIBLE DEVICES
// ========================================

export async function markVolunteerUsersWithoutDevices(
  jobId: string,
  lockToken: string
): Promise<number> {

  const result = await pool.query(
    `
    UPDATE notification_deliveries nd

    SET

      status = 'no_device',

      error_message =
        'No eligible registered push device'

    FROM volunteer_notification_jobs j

    WHERE j.id = $1

      AND j.lock_token = $2

      AND j.status = 'processing'

      AND j.notification_id =
        nd.notification_id

      AND nd.status = 'pending'

      AND NOT EXISTS (

        SELECT 1

        FROM volunteer_notification_devices vd

        WHERE vd.job_id = j.id

          AND vd.user_id = nd.user_id
      )
    `,
    [
      jobId,
      lockToken,
    ]
  );

  return result.rowCount ?? 0;
}

// ========================================
// SYNCHRONIZE RECENT RECEIPT RESULTS
// ========================================

export async function syncRecentVolunteerReceipts(
  limit: number = 500
): Promise<number> {

  const batchLimit =
    Number.isInteger(limit) && limit > 0
      ? Math.min(limit, 1000)
      : 500;

  const result = await pool.query(
    `
    SELECT DISTINCT vd.job_id

    FROM volunteer_notification_devices vd

    JOIN volunteer_notification_jobs j
      ON j.id = vd.job_id

    WHERE vd.receipt_checked_at IS NOT NULL

      AND vd.receipt_checked_at >=
        NOW() - INTERVAL '48 hours'

      AND j.notification_id IS NOT NULL

      AND EXISTS (

        SELECT 1

        FROM notification_deliveries nd

        WHERE nd.notification_id =
          j.notification_id

          AND nd.user_id = vd.user_id

          AND (

            (
              vd.status = 'delivered'

              AND nd.status <> 'delivered'
            )

            OR (

              vd.status IN (
                'failed',
                'unknown'
              )

              AND nd.status = 'sent'

              AND NOT EXISTS (

                SELECT 1

                FROM volunteer_notification_devices other

                WHERE other.job_id = vd.job_id

                  AND other.user_id = vd.user_id

                  AND other.status IN (
                    'accepted',
                    'delivered'
                  )
              )
            )
          )
      )

    ORDER BY vd.job_id ASC

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
        String(row.job_id)
      );
  }

  return updated;
}