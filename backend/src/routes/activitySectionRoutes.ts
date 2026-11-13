
import { Router } from 'express';

import {
  getActivitySections,
  getActivitySectionById,
  getAdminActivitySections,
  createActivitySection,
  updateActivitySection,
  deleteActivitySection,
} from '../controllers/activitySectionController';

import { authenticateToken } from '../middleware/authMiddleware';
import { requireAdmin } from '../middleware/adminMiddleware';

const router = Router();

/*
|--------------------------------------------------------------------------
| ADMIN ROUTES
|--------------------------------------------------------------------------
*/

// Get all activity sections (active and inactive)
router.get(
  '/admin/all',
  authenticateToken,
  requireAdmin,
  getAdminActivitySections
);

// Create new activity section
router.post(
  '/admin',
  authenticateToken,
  requireAdmin,
  createActivitySection
);

// Update activity section / Activate / Deactivate
router.put(
  '/admin/:id',
  authenticateToken,
  requireAdmin,
  updateActivitySection
);

// Permanently delete an empty activity section
router.delete(
  '/admin/:id',
  authenticateToken,
  requireAdmin,
  deleteActivitySection
);

/*
|--------------------------------------------------------------------------
| PUBLIC ROUTES
|--------------------------------------------------------------------------
*/

// Get active activity sections
router.get('/', getActivitySections);

// Get one active activity section
router.get('/:id', getActivitySectionById);

export default router;
