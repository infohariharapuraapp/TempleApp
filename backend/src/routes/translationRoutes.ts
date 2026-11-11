
import { Router, Request, Response, NextFunction } from 'express';

import { translateContent } from '../controllers/translationController';

import {
  authenticateToken,
  AuthRequest,
} from '../middleware/authMiddleware';

const router = Router();

// Per-user rate limiting.
// Suitable for initial local testing.
// Production needs a shared limiter for multiple instances.
const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS = 30;

const requests = new Map<
  number,
  {
    count: number;
    resetAt: number;
  }
>();

function translationRateLimit(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const userId = req.user?.userId;

  if (!userId) {
    res.status(401).json({
      success: false,
      message: 'Authentication required.',
    });
    return;
  }

  const now = Date.now();
  const existing = requests.get(userId);

  if (!existing || now >= existing.resetAt) {
    requests.set(userId, {
      count: 1,
      resetAt: now + WINDOW_MS,
    });

    next();
    return;
  }

  if (existing.count >= MAX_REQUESTS) {
    res.status(429).json({
      success: false,
      message:
        'Translation request limit reached. Please try again later.',
    });
    return;
  }

  existing.count += 1;
  next();
}

// Restrict direct translation requests to admins.
// Public mobile screens will receive translated content
// through their normal backend content APIs.
function requireTranslationAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  if (req.user?.role !== 'admin') {
    res.status(403).json({
      success: false,
      message: 'Admin access required.',
    });
    return;
  }

  next();
}

router.post(
  '/',
  authenticateToken,
  requireTranslationAdmin,
  translationRateLimit,
  translateContent
);

export default router;
