
import {
  Router,
  Response,
  NextFunction,
} from 'express';

import {
  translateContent,
  translatePublicBatch,
} from '../controllers/translationController';

import {
  authenticateToken,
  AuthRequest,
} from '../middleware/authMiddleware';

const router = Router();

// ======================================
// EXISTING ADMIN TRANSLATION RATE LIMIT
// ======================================

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

// ======================================
// PUBLIC MOBILE APP TRANSLATION LIMIT
// ======================================

// Basic protection for a single backend instance.
// Production should use shared rate limiting.
const PUBLIC_WINDOW_MS = 60 * 1000;
const PUBLIC_MAX_REQUESTS = 10;

const publicRequests = new Map<
  string,
  {
    count: number;
    resetAt: number;
  }
>();

function publicTranslationRateLimit(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const now = Date.now();
  const key = req.ip || 'unknown';

  // Remove expired entries periodically.
  for (const [ip, entry] of publicRequests) {
    if (now >= entry.resetAt) {
      publicRequests.delete(ip);
    }
  }

  const existing = publicRequests.get(key);

  if (!existing) {
    publicRequests.set(key, {
      count: 1,
      resetAt: now + PUBLIC_WINDOW_MS,
    });

    next();
    return;
  }

  if (existing.count >= PUBLIC_MAX_REQUESTS) {
    res.status(429).json({
      success: false,
      message:
        'Too many translation requests. Please try again later.',
    });
    return;
  }

  existing.count += 1;
  next();
}

// ======================================
// PUBLIC BATCH TRANSLATION ENDPOINT
// ======================================

router.post(
  '/public-batch',
  publicTranslationRateLimit,
  translatePublicBatch
);

// ======================================
// EXISTING ADMIN TRANSLATION ENDPOINT
// ======================================

router.post(
  '/',
  authenticateToken,
  requireTranslationAdmin,
  translationRateLimit,
  translateContent
);

export default router;
