
import { Router } from 'express';

import {
  getEventCategories,
} from '../controllers/eventCategoryController';

const router = Router();

// ========================================
// PUBLIC EVENT CATEGORY ROUTES
// ========================================

// Fetch all active event categories
router.get('/', getEventCategories);

export default router;
