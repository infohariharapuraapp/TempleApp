
import { Router } from 'express';

import {
  getPublicationCategories,
  getPublications,
  getAdminPublicationCategories,
  createPublicationCategory,
  updatePublicationCategory,
  deletePublicationCategory,
  getAdminPublications,
  createPublication,
  updatePublication,
  deletePublication,
} from '../controllers/publicationController';

import {
  authenticateToken,
} from '../middleware/authMiddleware';

import {
  requireAdmin,
} from '../middleware/adminMiddleware';

const router = Router();

// ========================================
// PUBLIC ROUTES
// No login required
// ========================================

// Get active publication categories
router.get(
  '/categories',
  getPublicationCategories
);

// Get active publications
// Optional: ?category_id=1
router.get(
  '/',
  getPublications
);

// ========================================
// ADMIN ROUTES
// Authentication and admin role required
// ========================================

router.use(authenticateToken, requireAdmin);

// Get all categories, including inactive
router.get(
  '/admin/categories',
  getAdminPublicationCategories
);

// Create category
router.post(
  '/admin/categories',
  createPublicationCategory
);

// Update category
router.put(
  '/admin/categories/:id',
  updatePublicationCategory
);

// Delete category
router.delete(
  '/admin/categories/:id',
  deletePublicationCategory
);

// Get all publications, including inactive
router.get(
  '/admin',
  getAdminPublications
);

// Create publication
router.post(
  '/admin',
  createPublication
);

// Update publication
router.put(
  '/admin/:id',
  updatePublication
);

// Delete publication
router.delete(
  '/admin/:id',
  deletePublication
);

export default router;
