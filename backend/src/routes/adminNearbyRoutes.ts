
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
  deleteNearbyCategory,
} from '../controllers/nearbyCategoryController';

import {
  getAdminNearbyPlaces,
  createNearbyPlace,
  updateNearbyPlace,
  deleteNearbyPlace,
} from '../controllers/nearbyPlaceController';

const router = Router();

// Protect all admin nearby routes
router.use(authenticateToken, requireAdmin);

/*
|--------------------------------------------------------------------------
| CATEGORY MANAGEMENT
|--------------------------------------------------------------------------
*/

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

router.delete(
  '/categories/:id',
  deleteNearbyCategory
);

/*
|--------------------------------------------------------------------------
| PLACE MANAGEMENT
|--------------------------------------------------------------------------
*/

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

router.delete(
  '/places/:id',
  deleteNearbyPlace
);

export default router;
