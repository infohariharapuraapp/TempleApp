
import {
  Expo,
  ExpoPushMessage,
  ExpoPushTicket,
} from 'expo-server-sdk';

import { pool } from '../db';

const expo = new Expo();

// ========================================
// TYPES
// ========================================

export interface NotificationData {
  type: string;
  screen?: string;
  [key: string]: any;
}

export interface CreateNotificationOptions {
  title: string;
  body: string;
  notificationType: string;
  data?: NotificationData;
  targetType?: string;
  scheduledAt?: Date | null;
}

type DeviceToken = {
  id: number;
  user_id: number;
  expo_push_token: string;
  platform: string;
};

type SendResult = {
  success: boolean;
  sent: number;
  notificationId?: number;
  totalDevices?: number;
  totalUsers?: number;
  message?: string;
};

type PushTarget = {
  device: DeviceToken;
  message: ExpoPushMessage;
};

type PushOutcome = {
  accepted: number;
  failed: number;
  tickets: Array<{
    device: DeviceToken;
    ticketId: string;
  }>;
  errors: Array<{
    device: DeviceToken;
    error: string;
  }>;
};

// ========================================
// DEVICE TOKEN HELPERS
// ========================================

async function deactivateInvalidPushToken(
  expoPushToken: string
): Promise<void> {
  try {
    await pool.query(
      `
        UPDATE device_tokens
        SET
          is_active = FALSE,
          updated_at = CURRENT_TIMESTAMP
        WHERE expo_push_token = $1
          AND is_active = TRUE
      `,
      [expoPushToken]
    );

    console.log(
      'Deactivated invalid Expo push token.'
    );
  } catch (error) {
    console.error(
      'Deactivate token error:',
      error
    );
  }
}

async function getAllActiveDevices():
  Promise<DeviceToken[]> {
  const result = await pool.query(
    `
      SELECT
        id,
        user_id,
        expo_push_token,
        platform
      FROM device_tokens
      WHERE is_active = TRUE
      ORDER BY id ASC
    `
  );

  return result.rows;
}

async function getUserActiveDevices(
  userId: number
): Promise<DeviceToken[]> {
  const result = await pool.query(
    `
      SELECT
        id,
        user_id,
        expo_push_token,
        platform
      FROM device_tokens
      WHERE user_id = $1
        AND is_active = TRUE
      ORDER BY id ASC
    `,
    [userId]
  );

  return result.rows;
}

// ========================================
// CREATE NOTIFICATION RECORD
// ========================================

export async function createNotification(
  options: CreateNotificationOptions
) {
  const {
    title,
    body,
    notificationType,
    data = { type: notificationType },
    targetType = 'all',
    scheduledAt = null,
  } = options;

  const status = scheduledAt
    ? 'scheduled'
    : 'pending';

  const result = await pool.query(
    `
      INSERT INTO notifications (
        title,
        body,
        notification_type,
        data,
        target_type,
        scheduled_at,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `,
    [
      title,
      body,
      notificationType,
      JSON.stringify(data),
      targetType,
      scheduledAt,
      status,
    ]
  );

  return result.rows[0];
}

// ========================================
// CREATE IN-APP DELIVERY RECORDS
// ========================================

async function createAllUserDeliveries(
  notificationId: number
): Promise<void> {
  await pool.query(
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
    [notificationId]
  );
}

async function createUserDelivery(
  notificationId: number,
  userId: number,
  device: DeviceToken | null
): Promise<void> {
  await pool.query(
    `
      INSERT INTO notification_deliveries (
        notification_id,
        user_id,
        device_token_id,
        expo_push_token,
        status
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (
        notification_id,
        user_id
      )
      DO NOTHING
    `,
    [
      notificationId,
      userId,
      device?.id ?? null,
      device?.expo_push_token ?? null,
      device ? 'pending' : 'no_device',
    ]
  );
}

// ========================================
// NOTIFICATION STATUS
// ========================================

async function updateNotificationStatus(
  notificationId: number,
  status: string,
  markSent: boolean = false
): Promise<void> {
  await pool.query(
    `
      UPDATE notifications
      SET
        status = $1,
        sent_at = CASE
          WHEN $2 = TRUE
          THEN COALESCE(
            sent_at,
            CURRENT_TIMESTAMP
          )
          ELSE sent_at
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `,
    [status, markSent, notificationId]
  );
}

// ========================================
// PARSE NOTIFICATION DATA
// ========================================

function parseNotificationData(
  value: unknown
): NotificationData {
  let parsed: unknown = value;

  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      parsed = {};
    }
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    Array.isArray(parsed)
  ) {
    return { type: 'system' };
  }

  const data = parsed as Record<string, any>;

  return {
    ...data,
    type:
      typeof data.type === 'string'
        ? data.type
        : 'system',
  };
}

// ========================================
// BUILD PUSH TARGETS
// ========================================

async function buildPushTargets(
  devices: DeviceToken[],
  title: string,
  body: string,
  data: NotificationData
): Promise<PushTarget[]> {
  const targets: PushTarget[] = [];

  for (const device of devices) {
    if (
      !Expo.isExpoPushToken(
        device.expo_push_token
      )
    ) {
      console.warn(
        `Invalid Expo token, device ${device.id}`
      );

      await deactivateInvalidPushToken(
        device.expo_push_token
      );

      continue;
    }

    targets.push({
      device,
      message: {
        to: device.expo_push_token,
        sound: 'default',
        channelId: 'default',
        title,
        body,
        data,
      },
    });
  }

  return targets;
}

// ========================================
// SEND PUSH MESSAGES
// ========================================

async function sendPushTargets(
  targets: PushTarget[]
): Promise<PushOutcome> {
  const outcome: PushOutcome = {
    accepted: 0,
    failed: 0,
    tickets: [],
    errors: [],
  };

  if (!targets.length) {
    return outcome;
  }

  // Chunk target objects, not just messages,
  // to preserve the device-to-ticket mapping.
  const messages = targets.map(
    target => target.message
  );

  const chunks =
    expo.chunkPushNotifications(messages);

  let offset = 0;

  for (const chunk of chunks) {
    const chunkTargets = targets.slice(
      offset,
      offset + chunk.length
    );

    offset += chunk.length;

    try {
      const tickets: ExpoPushTicket[] =
        await expo.sendPushNotificationsAsync(
          chunk
        );

      for (
        let index = 0;
        index < chunkTargets.length;
        index++
      ) {
        const device =
          chunkTargets[index].device;

        const ticket = tickets[index];

        if (
          ticket &&
          ticket.status === 'ok'
        ) {
          outcome.accepted++;

          outcome.tickets.push({
            device,
            ticketId: ticket.id,
          });

          continue;
        }

        outcome.failed++;

        const error = ticket
          ? JSON.stringify(ticket)
          : 'Expo returned no push ticket';

        outcome.errors.push({
          device,
          error,
        });

        console.error(
          'Expo push ticket error:',
          error
        );

        if (
          ticket?.status === 'error' &&
          ticket.details?.error ===
            'DeviceNotRegistered'
        ) {
          await deactivateInvalidPushToken(
            device.expo_push_token
          );
        }
      }
    } catch (error) {
      console.error(
        'Expo push chunk error:',
        error
      );

      for (const target of chunkTargets) {
        outcome.failed++;

        outcome.errors.push({
          device: target.device,
          error: String(error),
        });
      }
    }
  }

  return outcome;
}

// ========================================
// UPDATE PER-USER DELIVERY SUMMARY
// ========================================
//
// Existing schema stores one delivery per
// notification/user, not per physical device.
//
// A successful ticket means Expo accepted
// the push, not that the phone received it.
// ========================================

async function saveDeliverySummaries(
  notificationId: number,
  userIds: number[],
  targets: PushTarget[],
  outcome: PushOutcome
): Promise<void> {
  const acceptedByUser =
    new Map<number, typeof outcome.tickets>();

  const errorsByUser =
    new Map<number, string[]>();

  const firstDeviceByUser =
    new Map<number, DeviceToken>();

  for (const target of targets) {
    if (
      !firstDeviceByUser.has(
        target.device.user_id
      )
    ) {
      firstDeviceByUser.set(
        target.device.user_id,
        target.device
      );
    }
  }

  for (const entry of outcome.tickets) {
    const userId = entry.device.user_id;

    const entries =
      acceptedByUser.get(userId) ?? [];

    entries.push(entry);

    acceptedByUser.set(
      userId,
      entries
    );
  }

  for (const entry of outcome.errors) {
    const userId = entry.device.user_id;

    const errors =
      errorsByUser.get(userId) ?? [];

    errors.push(entry.error);

    errorsByUser.set(
      userId,
      errors
    );
  }

  for (const userId of userIds) {
    const accepted =
      acceptedByUser.get(userId) ?? [];

    const errors =
      errorsByUser.get(userId) ?? [];

    const firstAccepted = accepted[0];

    const device =
      firstAccepted?.device ??
      firstDeviceByUser.get(userId) ??
      null;

    const status =
      accepted.length > 0
        ? 'sent'
        : device
          ? 'failed'
          : 'no_device';

    await pool.query(
      `
        UPDATE notification_deliveries
        SET
          status = $1,
          device_token_id = $2,
          expo_push_token = $3,
          expo_ticket_id = $4,
          error_message = $5,
          sent_at = CASE
            WHEN $6 = TRUE
            THEN COALESCE(
              sent_at,
              CURRENT_TIMESTAMP
            )
            ELSE sent_at
          END
        WHERE notification_id = $7
          AND user_id = $8
      `,
      [
        status,
        device?.id ?? null,
        device?.expo_push_token ?? null,
        firstAccepted?.ticketId ?? null,
        errors.length
          ? errors.join('; ').slice(0, 2000)
          : null,
        accepted.length > 0,
        notificationId,
        userId,
      ]
    );
  }
}

// ========================================
// SEND EXISTING NOTIFICATION RECORD
// ========================================

export async function sendNotificationRecord(
  notificationId: number
): Promise<SendResult> {
  try {
    const result = await pool.query(
      `
        SELECT
          id,
          title,
          body,
          notification_type,
          data,
          target_type,
          status
        FROM notifications
        WHERE id = $1
      `,
      [notificationId]
    );

    if (!result.rows.length) {
      return {
        success: false,
        sent: 0,
        notificationId,
        message: 'Notification not found',
      };
    }

    const notification = result.rows[0];

    if (notification.status === 'sent') {
      return {
        success: true,
        sent: 0,
        notificationId,
        message: 'Notification already sent',
      };
    }

    if (notification.status === 'processing') {
      return {
        success: false,
        sent: 0,
        notificationId,
        message:
          'Notification is already processing',
      };
    }

    // Existing function is for broadcast
    // notifications, not individual targets.
    if (notification.target_type !== 'all') {
      return {
        success: false,
        sent: 0,
        notificationId,
        message:
          'This function only sends broadcast notifications',
      };
    }

    await createAllUserDeliveries(
      notificationId
    );

    const devices =
      await getAllActiveDevices();

    if (!devices.length) {
      await pool.query(
        `
          UPDATE notification_deliveries
          SET status = 'no_device'
          WHERE notification_id = $1
            AND status = 'pending'
        `,
        [notificationId]
      );

      await updateNotificationStatus(
        notificationId,
        'sent',
        true
      );

      return {
        success: true,
        sent: 0,
        notificationId,
        message:
          'Published in-app; no active push devices',
      };
    }

    const data = parseNotificationData(
      notification.data
    );

    const targets = await buildPushTargets(
      devices,
      notification.title,
      notification.body,
      data
    );

    if (!targets.length) {
      await pool.query(
        `
          UPDATE notification_deliveries
          SET status = 'no_device'
          WHERE notification_id = $1
            AND status = 'pending'
        `,
        [notificationId]
      );

      await updateNotificationStatus(
        notificationId,
        'sent',
        true
      );

      return {
        success: true,
        sent: 0,
        notificationId,
        message:
          'Published in-app; no valid push tokens',
      };
    }

    await updateNotificationStatus(
      notificationId,
      'processing'
    );

    const outcome =
      await sendPushTargets(targets);

    const usersResult = await pool.query(
      `
        SELECT user_id
        FROM notification_deliveries
        WHERE notification_id = $1
      `,
      [notificationId]
    );

    const userIds: number[] =
      usersResult.rows.map(
        row => Number(row.user_id)
      );

    await saveDeliverySummaries(
      notificationId,
      userIds,
      targets,
      outcome
    );

    await updateNotificationStatus(
      notificationId,
      outcome.accepted > 0
        ? 'sent'
        : 'failed',
      outcome.accepted > 0
    );

    console.log(
      'Broadcast push submission:',
      {
        notificationId,
        accepted: outcome.accepted,
        failed: outcome.failed,
      }
    );

    return {
      success: outcome.accepted > 0,
      sent: outcome.accepted,
      totalDevices: targets.length,
      totalUsers: new Set(
        targets.map(
          target => target.device.user_id
        )
      ).size,
      notificationId,
    };
  } catch (error) {
    console.error(
      'Send notification record error:',
      error
    );

    try {
      await updateNotificationStatus(
        notificationId,
        'failed'
      );
    } catch (databaseError) {
      console.error(
        'Notification status update error:',
        databaseError
      );
    }

    return {
      success: false,
      sent: 0,
      notificationId,
    };
  }
}

// ========================================
// SEND PUSH TO ONE USER
// ========================================

export async function sendPushNotificationToUser(
  userId: number,
  title: string,
  body: string,
  data: NotificationData = {
    type: 'system',
  }
): Promise<SendResult> {
  let notificationId:
    number | undefined;

  try {
    const notification =
      await createNotification({
        title,
        body,
        notificationType:
          data.type || 'system',
        data,
        targetType: 'user',
      });

    notificationId = notification.id;

    const devices =
      await getUserActiveDevices(userId);

    await createUserDelivery(
      notification.id,
      userId,
      devices[0] ?? null
    );

    if (!devices.length) {
      await updateNotificationStatus(
        notification.id,
        'sent',
        true
      );

      return {
        success: true,
        sent: 0,
        notificationId: notification.id,
        message:
          'Saved in-app; no active push device',
      };
    }

    const targets = await buildPushTargets(
      devices,
      title,
      body,
      data
    );

    if (!targets.length) {
      await pool.query(
        `
          UPDATE notification_deliveries
          SET
            status = 'no_device',
            device_token_id = NULL,
            expo_push_token = NULL
          WHERE notification_id = $1
            AND user_id = $2
        `,
        [notification.id, userId]
      );

      await updateNotificationStatus(
        notification.id,
        'sent',
        true
      );

      return {
        success: true,
        sent: 0,
        notificationId: notification.id,
        message:
          'Saved in-app; no valid push token',
      };
    }

    await updateNotificationStatus(
      notification.id,
      'processing'
    );

    const outcome =
      await sendPushTargets(targets);

    await saveDeliverySummaries(
      notification.id,
      [userId],
      targets,
      outcome
    );

    await updateNotificationStatus(
      notification.id,
      outcome.accepted > 0
        ? 'sent'
        : 'failed',
      outcome.accepted > 0
    );

    console.log(
      'User push submission:',
      {
        userId,
        notificationId: notification.id,
        accepted: outcome.accepted,
        failed: outcome.failed,
      }
    );

    return {
      success: outcome.accepted > 0,
      sent: outcome.accepted,
      notificationId: notification.id,
    };
  } catch (error) {
    console.error(
      'Send user notification error:',
      error
    );

    if (notificationId !== undefined) {
      try {
        await updateNotificationStatus(
          notificationId,
          'failed'
        );
      } catch (databaseError) {
        console.error(
          'Notification status error:',
          databaseError
        );
      }
    }

    return {
      success: false,
      sent: 0,
      notificationId,
    };
  }
}

// ========================================
// CHECK EXPO PUSH RECEIPTS
// ========================================
//
// Call this function from a scheduled job,
// typically several minutes after sending.
//
// Receipts indicate whether Expo handed
// the message to FCM/APNs. They do not
// prove the phone displayed it.
//
// The existing delivery schema stores
// only one ticket per user.
// ========================================

export async function checkPushReceipts(
  limit: number = 500
) {
  const safeLimit = Math.min(
    Math.max(Math.floor(limit), 1),
    1000
  );

  const result = await pool.query(
    `
      SELECT
        nd.id,
        nd.notification_id,
        nd.user_id,
        nd.expo_ticket_id,
        nd.expo_push_token
      FROM notification_deliveries nd
      WHERE nd.expo_ticket_id IS NOT NULL
        AND nd.status = 'sent'
        AND nd.sent_at <=
          CURRENT_TIMESTAMP - INTERVAL '2 minutes'
        AND nd.sent_at >=
          CURRENT_TIMESTAMP - INTERVAL '24 hours'
      ORDER BY nd.sent_at ASC
      LIMIT $1
    `,
    [safeLimit]
  );

  if (!result.rows.length) {
    return {
      checked: 0,
      accepted: 0,
      failed: 0,
      pending: 0,
    };
  }

  const rows = result.rows;

  const receiptIds = rows.map(
    row => String(row.expo_ticket_id)
  );

  const chunks =
    expo.chunkPushNotificationReceiptIds(
      receiptIds
    );

  let checked = 0;
  let accepted = 0;
  let failed = 0;
  let pending = 0;

  for (const chunk of chunks) {
    try {
      const receipts =
        await expo.getPushNotificationReceiptsAsync(
          chunk
        );

      for (const ticketId of chunk) {
        const receipt = receipts[ticketId];

        if (!receipt) {
          pending++;
          continue;
        }

        const matchingRows = rows.filter(
          row =>
            row.expo_ticket_id === ticketId
        );

        for (const row of matchingRows) {
          checked++;

          if (receipt.status === 'ok') {
            accepted++;

            // Keep the existing 'sent' status
            // for compatibility with current UI.
            // Clear ticket ID to avoid checking
            // the same receipt repeatedly.
            await pool.query(
              `
                UPDATE notification_deliveries
                SET expo_ticket_id = NULL
                WHERE id = $1
                  AND expo_ticket_id = $2
              `,
              [row.id, ticketId]
            );
          } else {
            failed++;

            const errorDetails =
              JSON.stringify(receipt);

            await pool.query(
              `
                UPDATE notification_deliveries
                SET
                  status = 'failed',
                  error_message = $1,
                  expo_ticket_id = NULL
                WHERE id = $2
                  AND expo_ticket_id = $3
              `,
              [
                errorDetails,
                row.id,
                ticketId,
              ]
            );

            if (
              receipt.details?.error ===
                'DeviceNotRegistered' &&
              row.expo_push_token
            ) {
              await deactivateInvalidPushToken(
                row.expo_push_token
              );
            }
          }
        }
      }
    } catch (error) {
      console.error(
        'Expo receipt check error:',
        error
      );

      pending += chunk.length;
    }
  }

  console.log(
    'Expo receipt check completed:',
    {
      checked,
      accepted,
      failed,
      pending,
    }
  );

  return {
    checked,
    accepted,
    failed,
    pending,
  };
}

// ========================================
// CREATE + SEND TO ALL USERS
// ========================================

export async function sendNotificationToAllUsers(
  title: string,
  body: string,
  data: NotificationData = {
    type: 'system',
  }
): Promise<SendResult> {
  const notification =
    await createNotification({
      title,
      body,
      notificationType:
        data.type || 'system',
      data,
      targetType: 'all',
    });

  return sendNotificationRecord(
    notification.id
  );
}
