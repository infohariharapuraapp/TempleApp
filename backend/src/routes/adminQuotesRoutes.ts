
import { Router } from 'express';

import { authenticateToken } from '../middleware/authMiddleware';
import { requireAdmin } from '../middleware/adminMiddleware';

import {
  getAdminQuotes,
  createQuote,
  updateQuote,
  deleteQuote,
} from '../controllers/quotesController';

const router = Router();

router.use(authenticateToken);
router.use(requireAdmin);

router.get('/', getAdminQuotes);
router.post('/', createQuote);
router.put('/:id', updateQuote);
router.delete('/:id', deleteQuote);

export default router;
