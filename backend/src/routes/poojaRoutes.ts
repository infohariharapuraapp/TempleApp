
import { Router } from 'express';

import {
  getPoojaSections,
  getPoojas,
} from '../controllers/poojaController';

const router = Router();

router.get('/sections', getPoojaSections);
router.get('/', getPoojas);

export default router;
