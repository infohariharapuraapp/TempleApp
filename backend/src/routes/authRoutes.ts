
import { Router } from 'express';

import {
  deleteAccount,
  forgotPassword,
  getMe,
  login,
  register,
  resetPassword,
  updateProfile,
  verifyResetOtp,
} from '../controllers/authController';

import {
  authenticateToken,
} from '../middleware/authMiddleware';

import {
  deleteAccountLimiter,
  forgotPasswordLimiter,
  loginLimiter,
  resetPasswordLimiter,
  verifyOtpLimiter,
} from '../middleware/authRateLimit';

const router = Router();

// ========================================
// PUBLIC AUTHENTICATION ROUTES
// ========================================

// Register new devotee
router.post(
  '/register',
  register
);

// Login
router.post(
  '/login',
  loginLimiter,
  login
);

// Request password reset OTP
router.post(
  '/forgot-password',
  forgotPasswordLimiter,
  forgotPassword
);

// Verify password reset OTP
router.post(
  '/verify-reset-otp',
  verifyOtpLimiter,
  verifyResetOtp
);

// Reset password
router.post(
  '/reset-password',
  resetPasswordLimiter,
  resetPassword
);

// ========================================
// AUTHENTICATED USER ROUTES
// ========================================

// Update profile
router.put(
  '/profile',
  authenticateToken,
  updateProfile
);

// Get current user
router.get(
  '/me',
  authenticateToken,
  getMe
);

// Delete account
router.delete(
  '/account',
  authenticateToken,
  deleteAccountLimiter,
  deleteAccount
);

export default router;
