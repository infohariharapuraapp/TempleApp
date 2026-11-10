
import { Router } from 'express';
import { getPravachanas } from '../controllers/pravachanaController';

const router = Router();

router.get('/', getPravachanas);

export default router;
