
import { Router } from 'express';
import { getQuotes } from '../controllers/quotesController';

const router = Router();

router.get('/', getQuotes);

export default router;
