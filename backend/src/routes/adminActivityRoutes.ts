
import { Router } from 'express';

import {
  getAdminActivities,
  createActivity,
  updateActivity,
  deleteActivity,
} from '../controllers/adminActivityController';

import { authenticateToken } from '../middleware/authMiddleware';
import { requireAdmin } from '../middleware/adminMiddleware';

const router = Router();

// Only authenticated admins can access these routes.
router.use(authenticateToken, requireAdmin);

// Get all activities
router.get('/', getAdminActivities);

// Create activity
router.post('/', createActivity);

// Update activity
router.put('/:id', updateActivity);

// Permanently delete activity
router.delete('/:id', deleteActivity);

export default router;
