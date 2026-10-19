
import { Router } from 'express';

import {
  getActiveWelcomeSlokam,
} from '../controllers/welcomeSlokamController';

const router = Router();

// ========================================
// PUBLIC WELCOME SLOKAM API
// ========================================

// Get the currently active Welcome Slokam
router.get('/active', getActiveWelcomeSlokam);

export default router;
