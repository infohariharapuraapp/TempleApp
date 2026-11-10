
import { Router } from 'express';

import { authenticateToken } from '../middleware/authMiddleware';
import { requireAdmin } from '../middleware/adminMiddleware';

import {
  getAdminPravachanas,
  createPravachana,
  updatePravachana,
  deletePravachana,
} from '../controllers/pravachanaController';

const router = Router();

// Authentication + admin authorization
router.use(authenticateToken);
router.use(requireAdmin);

// Get all Pravachanas for admin
router.get('/', getAdminPravachanas);

// Add a new Pravachana
router.post('/', createPravachana);

// Update or publish/unpublish a Pravachana
router.put('/:id', updatePravachana);

// Delete a Pravachana
router.delete('/:id', deletePravachana);

export default router;
