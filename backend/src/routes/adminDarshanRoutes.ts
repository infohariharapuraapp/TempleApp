
import { Router } from 'express';

import {
  authenticateToken,
} from '../middleware/authMiddleware';

import {
  requireAdmin,
} from '../middleware/adminMiddleware';

import {
  getAdminTodayDarshan,
  publishTodayDarshan,
} from '../controllers/adminDarshanController';

const router = Router();

router.get(
  '/today',
  authenticateToken,
  requireAdmin,
  getAdminTodayDarshan
);

router.post(
  '/today/publish',
  authenticateToken,
  requireAdmin,
  publishTodayDarshan
);

export default router;
