import { Router } from 'express';

import {
  getGurus,
} from '../controllers/guruParamparaController';

const router = Router();

// ========================================
// PUBLIC GURU PARAMPARA ROUTES
// ========================================

router.get('/', getGurus);

export default router;