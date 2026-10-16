
import { pool } from '../db';
import {
  sendNotificationRecord,
} from './notificationService';

let schedulerRunning = false;

// ========================================
// PROCESS SCHEDULED NOTIFICATIONS
// ========================================

export async function processScheduledNotifications() {
  if (schedulerRunning) {
    return;
  }

  schedulerRunning = true;

  try {
    const result = await pool.query(`
      SELECT id
      FROM notifications
      WHERE status = 'scheduled'
        AND scheduled_at IS NOT NULL
        AND scheduled_at <= CURRENT_TIMESTAMP
      ORDER BY scheduled_at ASC
      LIMIT 20
    `);

    for (const notification of result.rows) {
      try {
        // Mark as pending, rather than processing,
        // because sendNotificationRecord() itself
        // changes the status to processing.
        const claimResult = await pool.query(
          `
            UPDATE notifications
            SET
              status = 'pending',
              updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
              AND status = 'scheduled'
              AND scheduled_at <= CURRENT_TIMESTAMP
            RETURNING id
          `,
          [notification.id]
        );

        // Another scheduler may have claimed it.
        if (!claimResult.rows.length) {
          continue;
        }

        const sendResult =
          await sendNotificationRecord(
            notification.id
          );

        if (!sendResult.success) {
          console.error(
            `Scheduled notification ${notification.id} was not sent:`,
            sendResult
          );
        } else {
          console.log(
            `Scheduled notification ${notification.id} processed:`,
            sendResult
          );
        }
      } catch (error) {
        console.error(
          `Scheduled notification ${notification.id} failed:`,
          error
        );

        try {
          await pool.query(
            `
              UPDATE notifications
              SET
                status = 'failed',
                updated_at = CURRENT_TIMESTAMP
              WHERE id = $1
                AND status IN (
                  'scheduled',
                  'pending',
                  'processing'
                )
            `,
            [notification.id]
          );
        } catch (updateError) {
          console.error(
            'Failed to update notification status:',
            updateError
          );
        }
      }
    }
  } catch (error) {
    console.error(
      'Scheduled notification processor error:',
      error
    );
  } finally {
    schedulerRunning = false;
  }
}
