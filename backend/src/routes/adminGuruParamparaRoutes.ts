import { Router } from 'express';

import {
  authenticateToken,
} from '../middleware/authMiddleware';

import {
  requireAdmin,
} from '../middleware/adminMiddleware';

import {
  getAdminGurus,
  createGuru,
  updateGuru,
  updateGuruStatus,
  deleteGuru,
} from '../controllers/adminGuruParamparaController';

const router = Router();

// Protect all routes in this router
router.use(authenticateToken, requireAdmin);

// GET ALL GURUS
router.get('/', getAdminGurus);

// CREATE GURU
router.post('/', createGuru);

// UPDATE GURU
router.put('/:id', updateGuru);

// ACTIVATE / DEACTIVATE
router.patch('/:id/status', updateGuruStatus);

// DELETE GURU
router.delete('/:id', deleteGuru);

export default router;