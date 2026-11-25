import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { requireAdmin } from '../middleware/adminMiddleware';

import {
  getBuildings,
  createBuilding,
  updateBuilding,
  deleteBuilding,
} from '../controllers/buildingController';

const router = Router();

router.get('/', getBuildings);

router.post('/', authenticateToken, requireAdmin, createBuilding);

router.put('/:id', authenticateToken, requireAdmin, updateBuilding);

router.delete('/:id', authenticateToken, requireAdmin, deleteBuilding);

export default router;