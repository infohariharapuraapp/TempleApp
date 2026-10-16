import { Router } from 'express';

import {
  getAdminGuruVani,
  createGuruVani,
  updateGuruVani,
  updateGuruVaniStatus,
} from '../controllers/guruVaniController';

import {
  authenticateToken,
} from '../middleware/authMiddleware';

import {
  requireAdmin,
} from '../middleware/adminMiddleware';

const router = Router();

// Protect every route in this router
router.use(authenticateToken, requireAdmin);

// Get all slokas including inactive
router.get('/', getAdminGuruVani);

// Create a new sloka
router.post('/', createGuruVani);

// Update sloka details
router.put('/:id', updateGuruVani);

// Activate or deactivate sloka
router.patch('/:id/status', updateGuruVaniStatus);

export default router;