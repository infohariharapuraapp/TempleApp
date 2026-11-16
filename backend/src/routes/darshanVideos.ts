import { Router } from 'express';

// ========================================
// AUTHENTICATION MIDDLEWARE
// ========================================

import {
  authenticateToken,
} from '../middleware/authMiddleware';

import {
  requireAdmin,
} from '../middleware/adminMiddleware';

// ========================================
// IMAGE UPLOAD MIDDLEWARE
// ========================================

import {
  uploadDarshanThumbnail,
} from '../middleware/uploadMiddleware';

// ========================================
// VIDEO CONTROLLERS
// ========================================

import {
  getDarshanVideos,
  getAdminDarshanVideos,
  createDarshanVideo,
  updateDarshanVideo,
  deleteDarshanVideo,
} from '../controllers/darshanVideosController';

// ========================================
// CATEGORY CONTROLLERS
// ========================================

import {
  getDarshanVideoCategories,
  getAdminDarshanVideoCategories,
  createDarshanVideoCategory,
  updateDarshanVideoCategory,
  deleteDarshanVideoCategory,
} from '../controllers/darshanVideoCategoryController';

const router = Router();

// ========================================
// PUBLIC DARSHAN VIDEOS
// ========================================

router.get(
  '/darshan-videos',
  getDarshanVideos
);

// ========================================
// PUBLIC DARSHAN VIDEO CATEGORIES
// ========================================

router.get(
  '/darshan-video-categories',
  getDarshanVideoCategories
);

// ========================================
// ADMIN - GET ALL VIDEOS
// ========================================

router.get(
  '/admin/darshan-videos',
  authenticateToken,
  requireAdmin,
  getAdminDarshanVideos
);

// ========================================
// ADMIN - CREATE VIDEO
// ========================================

router.post(
  '/admin/darshan-videos',
  authenticateToken,
  requireAdmin,
  uploadDarshanThumbnail.single('thumbnail'),
  createDarshanVideo
);

// ========================================
// ADMIN - UPDATE VIDEO
// ========================================

router.put(
  '/admin/darshan-videos/:id',
  authenticateToken,
  requireAdmin,
  uploadDarshanThumbnail.single('thumbnail'),
  updateDarshanVideo
);

// ========================================
// ADMIN - DELETE VIDEO
// ========================================

router.delete(
  '/admin/darshan-videos/:id',
  authenticateToken,
  requireAdmin,
  deleteDarshanVideo
);

// ========================================
// ADMIN - GET ALL CATEGORIES
// ========================================

router.get(
  '/admin/darshan-video-categories',
  authenticateToken,
  requireAdmin,
  getAdminDarshanVideoCategories
);

// ========================================
// ADMIN - CREATE CATEGORY
// ========================================

router.post(
  '/admin/darshan-video-categories',
  authenticateToken,
  requireAdmin,
  createDarshanVideoCategory
);

// ========================================
// ADMIN - UPDATE CATEGORY
// ========================================

router.put(
  '/admin/darshan-video-categories/:id',
  authenticateToken,
  requireAdmin,
  updateDarshanVideoCategory
);

// ========================================
// ADMIN - DELETE CATEGORY
// ========================================

router.delete(
  '/admin/darshan-video-categories/:id',
  authenticateToken,
  requireAdmin,
  deleteDarshanVideoCategory
);

export default router;