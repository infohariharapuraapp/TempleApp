import {
  requestDeviceRecovery,
  confirmDeviceRecovery,
} from '../controllers/deviceRecoveryController';import { rateLimit } from 'express-rate-limit';
import { requireAdmin } from '../middleware/adminMiddleware';
import type { AuthRequest } from '../middleware/authMiddleware';
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
// Notification responses contain account-specific data.
router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});
const deviceRegistrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) =>
    `device-register:${(req as AuthRequest).user?.userId}`,
  message: {
    success: false,
    message: 'Too many device registration requests. Please try again later.',
  },
});
const deviceUnregistrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) =>
    `device-unregister:${(req as AuthRequest).user?.userId}`,
  message: {
    success: false,
    message: 'Too many device unregistration requests. Please try again later.',
  },
});
const testNotificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) =>
    `admin:${(req as AuthRequest).user?.userId}`,
  message: {
    success: false,
    message: 'Too many test notifications. Please try again later.',
  },
});

// ========================================
// REGISTER DEVICE FOR PUSH NOTIFICATIONS
// ========================================

router.post(
  '/register-device',
  authenticateToken,
  deviceRegistrationLimiter,
  registerDevice
);

// ========================================
// UNREGISTER CURRENT PUSH DEVICE
// ========================================

router.post(
  '/unregister-device',
  authenticateToken,
  deviceUnregistrationLimiter,
  unregisterDevice
);

// ========================================
// SEND TEST PUSH NOTIFICATION
// ========================================

router.post(
  '/test',
  authenticateToken,
  requireAdmin,
  testNotificationLimiter,
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

const recoveryRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: req =>
    `recovery-request:${(req as AuthRequest).user?.userId}`,
  message: {
    success: false,
    message: 'Too many device recovery requests',
  },
});
const recoveryConfirmLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: req =>
    `recovery-confirm:${(req as AuthRequest).user?.userId}`,
  message: {
    success: false,
    message: 'Too many device recovery attempts',
  },
});
router.post(
  '/recover-device/request',
  authenticateToken,
  recoveryRequestLimiter,
  requestDeviceRecovery
);
router.post(
  '/recover-device/confirm',
  authenticateToken,
  recoveryConfirmLimiter,
  confirmDeviceRecovery
);
export default router;