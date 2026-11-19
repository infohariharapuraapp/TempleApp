import { Router } from 'express';

import {
  registerDevice,
  unregisterDevice,
  sendTestNotification,
  getMyNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../controllers/notificationController';

import {
  authenticateToken,
} from '../middleware/authMiddleware';

const router = Router();

// ========================================
// REGISTER DEVICE FOR PUSH NOTIFICATIONS
// ========================================

router.post(
  '/register-device',
  authenticateToken,
  registerDevice
);

// ========================================
// UNREGISTER CURRENT PUSH DEVICE
// ========================================

router.post(
  '/unregister-device',
  authenticateToken,
  unregisterDevice
);

// ========================================
// SEND TEST PUSH NOTIFICATION
// ========================================

router.post(
  '/test',
  authenticateToken,
  sendTestNotification
);

// ========================================
// NOTIFICATION CENTER
// ========================================

// Get logged-in user's notifications

router.get(
  '/',
  authenticateToken,
  getMyNotifications
);

// Get unread notification count

router.get(
  '/unread-count',
  authenticateToken,
  getUnreadCount
);

// Mark all notifications as read

router.patch(
  '/read-all',
  authenticateToken,
  markAllNotificationsAsRead
);

// Mark one notification as read

router.patch(
  '/:id/read',
  authenticateToken,
  markNotificationAsRead
);

export default router;