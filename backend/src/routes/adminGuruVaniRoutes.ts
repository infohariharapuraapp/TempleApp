
import { Router } from 'express';

import {
  getAdminGuruVani,
  createGuruVani,
  updateGuruVani,
  updateGuruVaniStatus,
  deleteGuruVani,
} from '../controllers/guruVaniController';

import {
  authenticateToken,
} from '../middleware/authMiddleware';

import {
  requireAdmin,
} from '../middleware/adminMiddleware';

const router = Router();

// ========================================
// PROTECT ALL ADMIN GURU VANI ROUTES
// ========================================

router.use(authenticateToken, requireAdmin);

// ========================================
// GET ALL GURU VANI
// Including active and inactive slokas
// ========================================

router.get('/', getAdminGuruVani);

// ========================================
// CREATE NEW GURU VANI
// ========================================

router.post('/', createGuruVani);

// ========================================
// UPDATE GURU VANI DETAILS
// ========================================

router.put('/:id', updateGuruVani);

// ========================================
// ACTIVATE / DEACTIVATE GURU VANI
// ========================================

router.patch('/:id/status', updateGuruVaniStatus);

// ========================================
// PERMANENTLY DELETE GURU VANI
// ========================================

router.delete('/:id', deleteGuruVani);

export default router;
