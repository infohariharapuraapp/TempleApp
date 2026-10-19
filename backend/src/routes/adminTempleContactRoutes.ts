
import { Router } from 'express';

import { authenticateToken } from '../middleware/authMiddleware';
import { requireAdmin } from '../middleware/adminMiddleware';

import {
  getAdminTempleContact,
  updateAdminTempleContact,
} from '../controllers/adminTempleContactController';

const router = Router();

// All routes require admin authentication
router.use(authenticateToken);
router.use(requireAdmin);

// Get temple contact settings
router.get('/', getAdminTempleContact);

// Update temple contact settings
router.put('/', updateAdminTempleContact);

export default router;
