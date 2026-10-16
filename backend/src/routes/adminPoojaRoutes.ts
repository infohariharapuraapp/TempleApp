
import { Router } from 'express';

import { authenticateToken } from '../middleware/authMiddleware';
import { requireAdmin } from '../middleware/adminMiddleware';

import {
  getAdminPoojaSections,
  createPoojaSection,
  updatePoojaSection,
  getAdminPoojas,
  createPooja,
  updatePooja,
} from '../controllers/poojaController';

const router = Router();

router.use(authenticateToken, requireAdmin);

router.get('/sections', getAdminPoojaSections);
router.post('/sections', createPoojaSection);
router.put('/sections/:id', updatePoojaSection);

router.get('/', getAdminPoojas);
router.post('/', createPooja);
router.put('/:id', updatePooja);

export default router;
