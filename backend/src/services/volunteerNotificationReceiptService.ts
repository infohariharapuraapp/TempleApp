import { Expo } from 'expo-server-sdk';
import { pool } from '../db';

const expo = new Expo();

// ========================================
// CONFIGURATION
// ========================================

const RECEIPT_MINIMUM_AGE_MINUTES = 15;

const RECEIPT_MAXIMUM_AGE_HOURS = 24;

const RECEIPT_BATCH_LIMIT = 500;

let receiptProcessorRunning = false;

// ========================================
// TYPES
// ========================================

interface VolunteerReceiptDevice {
  id: string;
  job_id: string;
  device_token_id: number;
  user_id: number;
  expo_ticket_id: string;
}

interface VolunteerReceiptSummary {
  checked: number;
  delivered: number;
  failed: number;
  awaiting: number;
  unknown: number;
  errors: number;
}

// ========================================
// GET PENDING EXPO RECEIPTS
// ========================================

async function getPendingVolunteerReceipts(
  limit: number
): Promise<VolunteerReceiptDevice[]> {

  const result = await pool.query(
    `
    SELECT
      id,
      job_id,
      device_token_id,
      user_id,
      expo_ticket_id

    FROM volunteer_notification_devices

    WHERE status = 'accepted'

      AND expo_ticket_id IS NOT NULL

      AND accepted_at IS NOT NULL

      AND accepted_at <=
        NOW() -
        ($1::integer * INTERVAL '1 minute')

      AND accepted_at >
        NOW() -
        ($2::integer * INTERVAL '1 hour')

      AND (
        receipt_checked_at IS NULL

        OR receipt_checked_at <=
          NOW() - INTERVAL '5 minutes'
      )

    ORDER BY

      receipt_checked_at ASC NULLS FIRST,

      accepted_at ASC,

      id ASC

    LIMIT $3
    `,
    [
      RECEIPT_MINIMUM_AGE_MINUTES,

      RECEIPT_MAXIMUM_AGE_HOURS,

      limit,
    ]
  );

  return result.rows as VolunteerReceiptDevice[];
}

// ========================================
// MARK SUCCESSFUL PROVIDER RECEIPT
// ========================================

async function markVolunteerReceiptDelivered(
  device: VolunteerReceiptDevice
): Promise<boolean> {

  const result = await pool.query(
    `
    UPDATE volunteer_notification_devices

    SET
      status = 'delivered',

      receipt_checked_at = NOW(),

      last_error = NULL,

      updated_at = NOW()

    WHERE id = $1

      AND expo_ticket_id = $2

      AND status = 'accepted'
    `,
    [
      device.id,

      device.expo_ticket_id,
    ]
  );

  return result.rowCount === 1;
}

// ========================================
// MARK FAILED PROVIDER RECEIPT
// ========================================

async function markVolunteerReceiptFailed(
  device: VolunteerReceiptDevice,
  errorMessage: string
): Promise<boolean> {

  const result = await pool.query(
    `
    UPDATE volunteer_notification_devices

    SET
      status = 'failed',

      last_error = $3,

      receipt_checked_at = NOW(),

      updated_at = NOW()

    WHERE id = $1

      AND expo_ticket_id = $2

      AND status = 'accepted'
    `,
    [
      device.id,

      device.expo_ticket_id,

      errorMessage.slice(0, 2000),
    ]
  );

  return result.rowCount === 1;
}

// ========================================
// MARK RECEIPT CHECK ATTEMPT
// ========================================

async function markVolunteerReceiptChecked(
  device: VolunteerReceiptDevice
): Promise<void> {

  await pool.query(
    `
    UPDATE volunteer_notification_devices

    SET
      receipt_checked_at = NOW(),

      updated_at = NOW()

    WHERE id = $1

      AND expo_ticket_id = $2

      AND status = 'accepted'
    `,
    [
      device.id,

      device.expo_ticket_id,
    ]
  );
}

// ========================================
// EXPIRE UNAVAILABLE RECEIPTS
// ========================================

export async function expireVolunteerPushReceipts():
  Promise<number> {

  const result = await pool.query(
    `
    UPDATE volunteer_notification_devices

    SET
      status = 'unknown',

      last_error =
        'Expo receipt unavailable within receipt retention window',

      receipt_checked_at = NOW(),

      updated_at = NOW()

    WHERE status = 'accepted'

      AND accepted_at IS NOT NULL

      AND accepted_at <=
        NOW() -
        ($1::integer * INTERVAL '1 hour')
    `,
    [
      RECEIPT_MAXIMUM_AGE_HOURS,
    ]
  );

  return result.rowCount ?? 0;
}

// ========================================
// PROCESS EXPO DELIVERY RECEIPTS
// ========================================

export async function processVolunteerPushReceipts(
  limit: number = RECEIPT_BATCH_LIMIT
): Promise<VolunteerReceiptSummary> {

  const summary: VolunteerReceiptSummary = {
    checked: 0,

    delivered: 0,

    failed: 0,

    awaiting: 0,

    unknown: 0,

    errors: 0,
  };

  if (receiptProcessorRunning) {
    return summary;
  }

  receiptProcessorRunning = true;

  try {

    const batchLimit =
      Number.isInteger(limit) && limit > 0
        ? Math.min(limit, RECEIPT_BATCH_LIMIT)
        : RECEIPT_BATCH_LIMIT;

    summary.unknown =
      await expireVolunteerPushReceipts();

    const devices =
      await getPendingVolunteerReceipts(
        batchLimit
      );

    if (!devices.length) {
      return summary;
    }

    const deviceMap =
      new Map<string, VolunteerReceiptDevice>();

    for (const device of devices) {

      deviceMap.set(
        device.expo_ticket_id,

        device
      );
    }

    const receiptIds =
      Array.from(deviceMap.keys());

    const receiptChunks =
      expo.chunkPushNotificationReceiptIds(
        receiptIds
      );

    for (const chunk of receiptChunks) {

      try {

        const receipts =
          await expo.getPushNotificationReceiptsAsync(
            chunk
          );

        for (const receiptId of chunk) {

          const device =
            deviceMap.get(receiptId);

          if (!device) {
            continue;
          }

          summary.checked++;

          try {

            const receipt =
              receipts[receiptId];

            // Receipt is not yet available.

            if (!receipt) {

              await markVolunteerReceiptChecked(
                device
              );

              summary.awaiting++;

              continue;
            }

            // Successful provider receipt.

            if (receipt.status === 'ok') {

              const updated =
                await markVolunteerReceiptDelivered(
                  device
                );

              if (updated) {
                summary.delivered++;
              }

              continue;
            }

            // Provider returned a failure.

            const updated =
              await markVolunteerReceiptFailed(
                device,

                JSON.stringify(receipt)
              );

            if (updated) {
              summary.failed++;
            }

          } catch (error) {

            summary.errors++;

            console.error(
              '[Volunteer Receipts] Device receipt update failed:',

              device.id,

              error
            );
          }
        }

      } catch (error) {

        summary.errors += chunk.length;

        console.error(
          '[Volunteer Receipts] Expo receipt request failed:',

          error
        );
      }
    }

    return summary;

  } finally {

    receiptProcessorRunning = false;
  }
}