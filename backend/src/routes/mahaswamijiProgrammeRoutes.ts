
import { Router } from 'express';

import {
  getPublishedProgrammes,
  getPublishedProgrammeById,
} from '../controllers/mahaswamijiProgrammeController';

const router = Router();

router.get('/', getPublishedProgrammes);
router.get('/:id', getPublishedProgrammeById);

export default router;
