import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { pool } from '../db';
import {
  sendPushNotificationToUser,
} from '../services/notificationService';

// ========================================
// REGISTER DEVICE FOR PUSH NOTIFICATIONS
// ========================================

export const registerDevice = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const {
      expoPushToken,
      platform,
      deviceName,
    } = req.body;

    if (!expoPushToken) {
      return res.status(400).json({
        success: false,
        message: 'Expo push token is required',
      });
    }

    if (!platform) {
      return res.status(400).json({
        success: false,
        message: 'Platform is required',
      });
    }

    const result = await pool.query(
      `INSERT INTO device_tokens (
        user_id,
        expo_push_token,
        platform,
        device_name,
        is_active,
        updated_at
      )
      VALUES ($1, $2, $3, $4, TRUE, CURRENT_TIMESTAMP)

      ON CONFLICT (expo_push_token)
      DO UPDATE SET
        user_id = EXCLUDED.user_id,
        platform = EXCLUDED.platform,
        device_name = EXCLUDED.device_name,
        is_active = TRUE,
        updated_at = CURRENT_TIMESTAMP

      RETURNING
        id,
        user_id,
        expo_push_token,
        platform,
        device_name,
        is_active,
        created_at,
        updated_at`,
      [
        userId,
        expoPushToken,
        platform,
        deviceName || null,
      ]
    );

    return res.status(200).json({
      success: true,
      message: 'Device registered for notifications',
      data: result.rows[0],
    });
  } catch (error) {
    console.error(
      'Register device error:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to register device',
    });
  }
};

// ========================================
// SEND TEST PUSH NOTIFICATION
// ========================================

// ========================================
// SEND TEST PUSH NOTIFICATION
// ========================================

export const sendTestNotification = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    console.log(
      'Test notification requested for user:',
      userId
    );

    // ====================================
    // SEND PUSH NOTIFICATION
    // ====================================

    const result = await sendPushNotificationToUser(
      userId,
      'Temple App',
      'This is a test push notification 🙏',
      {
        type: 'test',
        screen: '/(tabs)',
      }
    );

    // ====================================
    // NO DEVICE OR FAILED SUBMISSION
    // ====================================

    if (!result.success || result.sent === 0) {
      console.warn(
        'Test push notification not submitted:',
        result
      );

      return res.status(200).json({
        success: false,
        message:
          'No push notification was accepted by Expo. Check device registration and backend logs.',
        data: {
          acceptedCount: result.sent ?? 0,
          notificationId:
            'notificationId' in result
              ? result.notificationId
              : null,
        },
      });
    }

    // ====================================
    // EXPO ACCEPTED THE PUSH
    // ====================================

    console.log(
      'Test notification accepted by Expo:',
      result
    );

    return res.status(200).json({
      success: true,
      message:
        'Push notification accepted by Expo. Device delivery is not yet confirmed.',
      data: {
        acceptedCount: result.sent,
        notificationId:
          'notificationId' in result
            ? result.notificationId
            : null,
      },
    });

  } catch (error) {
    console.error(
      'Test notification error:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to send test notification',
    });
  }
};
// ========================================
// GET MY NOTIFICATIONS
// ========================================

export const getMyNotifications = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const result = await pool.query(
      `SELECT
        n.id,
        n.title,
        n.body,
        n.notification_type,
        n.data,
        n.created_at,
        nd.read_at,
        CASE
          WHEN nd.read_at IS NULL THEN FALSE
          ELSE TRUE
        END AS is_read
      FROM notification_deliveries nd
      INNER JOIN notifications n
        ON n.id = nd.notification_id
      WHERE nd.user_id = $1
      ORDER BY n.created_at DESC`,
      [userId]
    );

    return res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error(
      'Get notifications error:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to load notifications',
    });
  }
};

// ========================================
// GET UNREAD NOTIFICATION COUNT
// ========================================

export const getUnreadCount = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const result = await pool.query(
      `SELECT COUNT(*)::int AS unread_count
       FROM notification_deliveries
       WHERE user_id = $1
       AND read_at IS NULL`,
      [userId]
    );

    return res.status(200).json({
      success: true,
      data: {
        unreadCount:
          result.rows[0]?.unread_count || 0,
      },
    });
  } catch (error) {
    console.error(
      'Unread notification count error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Failed to load unread notification count',
    });
  }
};

// ========================================
// MARK ONE NOTIFICATION AS READ
// ========================================

export const markNotificationAsRead = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.user?.userId;
    const notificationId = Number(req.params.id);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    if (
      !Number.isInteger(notificationId) ||
      notificationId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification ID',
      });
    }

    const result = await pool.query(
      `UPDATE notification_deliveries
       SET read_at = COALESCE(
         read_at,
         CURRENT_TIMESTAMP
       )
       WHERE user_id = $1
       AND notification_id = $2
       RETURNING read_at`,
      [userId, notificationId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: {
        readAt: result.rows[0].read_at,
      },
    });
  } catch (error) {
    console.error(
      'Mark notification read error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Failed to mark notification as read',
    });
  }
};

// ========================================
// MARK ALL NOTIFICATIONS AS READ
// ========================================

export const markAllNotificationsAsRead = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const result = await pool.query(
      `UPDATE notification_deliveries
       SET read_at = CURRENT_TIMESTAMP
       WHERE user_id = $1
       AND read_at IS NULL
       RETURNING id`,
      [userId]
    );

    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      data: {
        updatedCount: result.rowCount || 0,
      },
    });
  } catch (error) {
    console.error(
      'Mark all notifications read error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Failed to mark all notifications as read',
    });
  }
};