
import { Router } from 'express';

import {
  authenticateToken,
} from '../middleware/authMiddleware';

import {
  requireAdmin,
} from '../middleware/adminMiddleware';

import {
  getAdminNearbyCategories,
  createNearbyCategory,
  updateNearbyCategory,
} from '../controllers/nearbyCategoryController';

import {
  getAdminNearbyPlaces,
  createNearbyPlace,
  updateNearbyPlace,
} from '../controllers/nearbyPlaceController';

const router = Router();

// Protect every route in this module
router.use(authenticateToken, requireAdmin);

// ========================================
// CATEGORY MANAGEMENT
// ========================================

router.get(
  '/categories',
  getAdminNearbyCategories
);

router.post(
  '/categories',
  createNearbyCategory
);

router.put(
  '/categories/:id',
  updateNearbyCategory
);

// ========================================
// PLACE MANAGEMENT
// ========================================

router.get(
  '/places',
  getAdminNearbyPlaces
);

router.post(
  '/places',
  createNearbyPlace
);

router.put(
  '/places/:id',
  updateNearbyPlace
);

export default router;
