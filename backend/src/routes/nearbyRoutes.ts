
import { Router } from 'express';

import {
  getNearbyCategories,
} from '../controllers/nearbyCategoryController';

import {
  getNearbyPlaces,
} from '../controllers/nearbyPlaceController';

const router = Router();

router.get('/categories', getNearbyCategories);

router.get('/places', getNearbyPlaces);

export default router;
