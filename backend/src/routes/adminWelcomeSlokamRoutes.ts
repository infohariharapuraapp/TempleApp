
import { Router } from 'express';
import multer from 'multer';
import cloudinary from '../config/cloudinary';

import {
  getAdminWelcomeSlokams,
  createWelcomeSlokam,
  updateWelcomeSlokam,
  activateWelcomeSlokam,
  deleteWelcomeSlokam,
} from '../controllers/welcomeSlokamController';

import {
  authenticateToken,
} from '../middleware/authMiddleware';

import {
  requireAdmin,
} from '../middleware/adminMiddleware';

const router = Router();

// Protect all admin routes
router.use(authenticateToken, requireAdmin);

// Get all welcome slokams
router.get('/', getAdminWelcomeSlokams);

// Add new slokam
router.post('/', createWelcomeSlokam);

// Edit slokam
router.put('/:id', updateWelcomeSlokam);

// Select active welcome slokam
router.patch('/:id/activate', activateWelcomeSlokam);

// Delete slokam
router.delete('/:id', deleteWelcomeSlokam);



// ========================================
// WELCOME SLOKAM MP3 UPLOAD
// ========================================

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 15 * 1024 * 1024, // Maximum 15 MB
  },

  fileFilter: (_req, file, callback) => {
    const isMp3 =
      file.mimetype === 'audio/mpeg' ||
      file.mimetype === 'audio/mp3';

    if (!isMp3) {
      return callback(
        new Error('Only MP3 audio files are allowed')
      );
    }

    callback(null, true);
  },
});

router.post(
  '/upload',
  (req, res) => {
    upload.single('audio')(req, res, async (error) => {
      if (error) {
        return res.status(400).json({
          success: false,
          message: error.message || 'Invalid audio upload',
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Please select an MP3 file',
        });
      }

      try {
        const result = await new Promise<{
          secure_url: string;
          public_id: string;
        }>((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: 'temple-app/welcome-slokams',
              resource_type: 'video',
              format: 'mp3',
            },
            (uploadError, uploadResult) => {
              if (uploadError || !uploadResult) {
                return reject(
                  uploadError ??
                    new Error('Cloudinary upload failed')
                );
              }

              resolve({
                secure_url: uploadResult.secure_url,
                public_id: uploadResult.public_id,
              });
            }
          );

         stream.end(req.file!.buffer);
        });

        return res.status(201).json({
          success: true,
          message: 'MP3 uploaded successfully',
          data: {
            audio_url: result.secure_url,
            public_id: result.public_id,
          },
        });
      } catch (uploadError) {
        console.error(
          'Welcome Slokam Cloudinary upload:',
          uploadError
        );

        return res.status(500).json({
          success: false,
          message: 'Unable to upload MP3 to Cloudinary',
        });
      }
    });
  }
);

export default router;
