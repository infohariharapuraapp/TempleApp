import { pool } from '../db';
import {
  sendNotificationRecord,
} from './notificationService';
let schedulerRunning = false;
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
        AND target_type = 'all'
        AND scheduled_at IS NOT NULL
        AND scheduled_at <= CURRENT_TIMESTAMP
      ORDER BY scheduled_at ASC
      LIMIT 20
    `);
    for (const notification of result.rows) {
      try {
        // The notification service owns the atomic claim.
        const sendResult = await sendNotificationRecord(
          notification.id
        );
        if (sendResult.success) {
          console.log('Scheduled notification processed:', {
            notificationId: notification.id,
            accepted: sendResult.sent,
          });
        } else {
          console.warn('Scheduled notification not submitted:', {
            notificationId: notification.id,
          });
        }
      } catch {
        // Never overwrite another worker's processing state.
        console.error('Scheduled notification processing failed:', {
          notificationId: notification.id,
        });
      }
    }
  } catch {
    console.error('Scheduled notification processor failed.');
  } finally {
    schedulerRunning = false;
  }
}
