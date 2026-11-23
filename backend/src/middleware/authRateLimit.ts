
import { rateLimit } from 'express-rate-limit';

// Limit responses are JSON so the mobile app can handle them.
const rateLimitResponse = {
  success: false,
  message: 'Too many requests. Please try again later.',
};

const createAuthLimiter = (
  windowMs: number,
  limit: number
) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: rateLimitResponse,
  });

// 10 login requests per 15 minutes per IP.
// A separate account-based limiter is recommended later.
export const loginLimiter = createAuthLimiter(
  15 * 60 * 1000,
  10
);

// 5 registration requests per hour per IP.
export const registerLimiter = createAuthLimiter(
  60 * 60 * 1000,
  5
);

// 5 password-recovery requests per 15 minutes per IP.
export const forgotPasswordLimiter = createAuthLimiter(
  15 * 60 * 1000,
  5
);

// 10 OTP verification requests per 15 minutes per IP.
// The existing per-OTP attempt limit remains in force.
export const verifyOtpLimiter = createAuthLimiter(
  15 * 60 * 1000,
  10
);

// 10 password-reset requests per 15 minutes per IP.
export const resetPasswordLimiter = createAuthLimiter(
  15 * 60 * 1000,
  10
);
