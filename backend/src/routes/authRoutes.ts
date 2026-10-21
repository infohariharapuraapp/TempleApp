import { Router } from 'express';
import {
  register,
  login,
  getMe,
    updateProfile,
  forgotPassword,
   verifyResetOtp,
   deleteAccount,
   resetPassword,
} from '../controllers/authController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post(
  '/forgot-password',
  forgotPassword
);
router.put(
  '/profile',
  authenticateToken,
  updateProfile
);
router.post(
  '/verify-reset-otp',
  verifyResetOtp
);
router.post(
  '/reset-password',
  resetPassword
);

router.get(
  '/me',
  authenticateToken,
  getMe
);
router.delete(
  '/account',
  authenticateToken,
  deleteAccount
);

export default router;