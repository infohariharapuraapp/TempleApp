import { Router } from 'express';

import {
  getGuruVani,
  getLatestGuruVani,
  getGuruVaniById,
} from '../controllers/guruVaniController';

const router = Router();

// All active slokas - latest first
router.get('/', getGuruVani);

// Latest published sloka
router.get('/latest', getLatestGuruVani);

// Individual sloka
router.get('/:id', getGuruVaniById);

export default router;