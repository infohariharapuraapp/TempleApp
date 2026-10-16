import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { requireAdmin } from '../middleware/adminMiddleware';
import {
  getAdminEventCategories,
  createEventCategory,
  updateEventCategory,
} from '../controllers/eventCategoryController';
import {
  getDashboardSummary,
  getAllUsers,
  getUserById,

  updateUser,


                getAllEvents,
createEvent,
updateEvent,
updateEventStatus,


            } from '../controllers/adminController';
const router = Router();

/* =========================================================
   EVENTS
========================================================= */

router.get(
  '/events',
  authenticateToken,
  requireAdmin,
  getAllEvents
);

router.post(
  '/events',
  authenticateToken,
  requireAdmin,
  createEvent
);

router.put(
  '/events/:id',
  authenticateToken,
  requireAdmin,
  updateEvent
);

router.patch(
  '/events/:id/status',
  authenticateToken,
  requireAdmin,
  updateEventStatus
);

router.put(
  '/users/:id',
  authenticateToken,
  requireAdmin,
  updateUser
);
router.get(
  '/users',
  authenticateToken,
  requireAdmin,
  getAllUsers
);
router.get(
  '/users/:id',
  authenticateToken,
  requireAdmin,
  getUserById
);

router.get(
  '/dashboard',
  authenticateToken,
  requireAdmin,
  getDashboardSummary
);

/* =========================================================
   EVENT CATEGORY MANAGEMENT
========================================================= */

// GET ALL EVENT CATEGORIES (ADMIN)
router.get(
  '/event-categories',
  authenticateToken,
  requireAdmin,
  getAdminEventCategories
);

// CREATE EVENT CATEGORY
router.post(
  '/event-categories',
  authenticateToken,
  requireAdmin,
  createEventCategory
);

// UPDATE CATEGORY NAME OR STATUS
router.put(
  '/event-categories/:id',
  authenticateToken,
  requireAdmin,
  updateEventCategory
);


export default router;