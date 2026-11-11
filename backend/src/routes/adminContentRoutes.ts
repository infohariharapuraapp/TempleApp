
import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { requireAdmin } from '../middleware/adminMiddleware';
import { uploadGalleryImage } from '../middleware/uploadMiddleware';

import {
  getAdminDeities,
  createDeity,
  updateDeity,
  deactivateDeity,
  getAdminGallery,
  createGalleryItem,
  updateGalleryItem,
  deleteGalleryItem,
  sendAnnouncementNotification,
} from '../controllers/adminContentController';

const router = Router();

router.use(authenticateToken, requireAdmin);

// ========================================
// DEITIES
// ========================================

router.get('/deities', getAdminDeities);
router.post('/deities', createDeity);
router.put('/deities/:id', updateDeity);
router.delete('/deities/:id', deactivateDeity);

// ========================================
// GALLERY
// ========================================

router.get('/gallery', getAdminGallery);

router.post(
  '/gallery',
  uploadGalleryImage.single('image'),
  createGalleryItem
);

router.put(
  '/gallery/:id',
  uploadGalleryImage.single('image'),
  updateGalleryItem
);

router.delete('/gallery/:id', deleteGalleryItem);

// ========================================
// LEGACY NOTIFICATION ROUTE
// ========================================
// Preserve the existing notification endpoint.
// All other announcement operations are handled
// by adminAnnouncementRoutes.ts.

router.post(
  '/announcements/:id/send',
  sendAnnouncementNotification
);

export default router;
