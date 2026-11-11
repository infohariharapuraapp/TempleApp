
import { Router } from 'express';

import {
  getAdminProgrammes,
  createProgramme,
  updateProgramme,
  updateProgrammePublishStatus,
  deleteProgramme,
} from '../controllers/mahaswamijiProgrammeController';

import {
  authenticateToken,
} from '../middleware/authMiddleware';

import {
  requireAdmin,
} from '../middleware/adminMiddleware';

const router = Router();

router.use(authenticateToken, requireAdmin);

router.get('/', getAdminProgrammes);
router.post('/', createProgramme);
router.put('/:id', updateProgramme);
router.patch('/:id/publish', updateProgrammePublishStatus);
router.delete('/:id', deleteProgramme);

export default router;
