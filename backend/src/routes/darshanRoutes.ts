
import { Router } from 'express';

import {
  getTodayDarshan,
} from '../controllers/darshanController';

const router = Router();

router.get('/today', getTodayDarshan);

export default router;
