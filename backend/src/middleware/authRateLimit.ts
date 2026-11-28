
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

// Count unsuccessful login requests per IP.
// Successful authentication does not consume the allowance.
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: rateLimitResponse,
});

// 5 registration requests per hour per IP.
export const registerLimiter = createAuthLimiter(
  60 * 60 * 1000,
  5
);

// 30 password-recovery requests per 15 minutes per IP.
export const forgotPasswordLimiter = createAuthLimiter(
  15 * 60 * 1000,
  30
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
// Account deletion: 5 attempts per 15 minutes per IP.
export const deleteAccountLimiter = createAuthLimiter(
  15 * 60 * 1000,
  5
);