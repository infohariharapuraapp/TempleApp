import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { requireAdmin } from '../middleware/adminMiddleware';

import {
  getGalleryAlbums,
  createGalleryAlbum,
  updateGalleryAlbum,
  deleteGalleryAlbum,
} from '../controllers/galleryAlbumController';

const router = Router();

router.use(authenticateToken, requireAdmin);

router.get('/', getGalleryAlbums);
router.post('/', createGalleryAlbum);
router.put('/:id', updateGalleryAlbum);
router.delete('/:id', deleteGalleryAlbum);

export default router;