
import { Router, Request, Response } from 'express';
import multer from 'multer';

import cloudinary from '../config/cloudinary';

import {
  getAllAdminAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  toggleAnnouncementStatus,
  sendAnnouncementNow,
  scheduleAnnouncement,
} from '../controllers/adminAnnouncementController';

import {
  authenticateToken,
} from '../middleware/authMiddleware';

import {
  requireAdmin,
} from '../middleware/adminMiddleware';

const router = Router();

// ========================================
// ADMIN AUTHENTICATION
// ========================================

router.use(authenticateToken, requireAdmin);

// ========================================
// CLOUDINARY POSTER UPLOAD
// ========================================

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024,
  },

  fileFilter: (_req, file, callback) => {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return callback(
        new Error(
          'Only JPG, PNG or WebP images are allowed'
        )
      );
    }

    callback(null, true);
  },
});

// ========================================
// UPLOAD ANNOUNCEMENT POSTER
// POST /admin/announcements/upload
// ========================================

router.post(
  '/upload',
  (req: Request, res: Response) => {
    upload.single('image')(
      req,
      res,
      async (error: unknown) => {
        if (error) {
          return res.status(400).json({
            success: false,
            message:
              error instanceof Error
                ? error.message
                : 'Invalid poster image',
          });
        }

        if (!req.file) {
          return res.status(400).json({
            success: false,
            message: 'Please select a poster image',
          });
        }

        try {
          const result = await new Promise<{
            secure_url: string;
            public_id: string;
          }>((resolve, reject) => {
            const stream =
              cloudinary.uploader.upload_stream(
                {
                  folder:
                    'temple-app/divyakshetra-updates',
                  resource_type: 'image',
                  format: 'webp',
                  transformation: [
                    {
                      width: 1600,
                      height: 2000,
                      crop: 'limit',
                      quality: 'auto',
                    },
                  ],
                },
                (uploadError, uploadResult) => {
                  if (uploadError || !uploadResult) {
                    return reject(
                      uploadError ??
                        new Error(
                          'Cloudinary upload failed'
                        )
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
            message: 'Poster uploaded successfully',
            data: {
              image_url: result.secure_url,
              public_id: result.public_id,
            },
          });
        } catch (uploadError) {
          console.error(
            'Divyakshetra poster upload error:',
            uploadError
          );

          return res.status(500).json({
            success: false,
            message: 'Unable to upload poster',
          });
        }
      }
    );
  }
);

// ========================================
// EXISTING ANNOUNCEMENT ROUTES
// ========================================

// Get all announcements
router.get(
  '/',
  getAllAdminAnnouncements
);

// Create announcement
router.post(
  '/',
  createAnnouncement
);

// Update announcement
router.put(
  '/:id',
  updateAnnouncement
);

// Activate / deactivate
router.patch(
  '/:id/status',
  toggleAnnouncementStatus
);

// Send notification now
router.post(
  '/:id/send',
  sendAnnouncementNow
);

// Schedule notification
router.post(
  '/:id/schedule',
  scheduleAnnouncement
);


// ========================================
// CLOUDINARY PDF ATTACHMENT UPLOAD
// ========================================

const uploadPdf = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 10 * 1024 * 1024,
  },

  fileFilter: (_req, file, callback) => {
    if (file.mimetype !== 'application/pdf') {
      return callback(
        new Error('Only PDF files are allowed')
      );
    }

    callback(null, true);
  },
});

// ========================================
// POST /admin/announcements/upload-pdf
// ========================================

router.post(
  '/upload-pdf',
  (req: Request, res: Response) => {
    uploadPdf.single('file')(
      req,
      res,
      async (error: unknown) => {
        if (error) {
          return res.status(400).json({
            success: false,
            message:
              error instanceof Error
                ? error.message
                : 'Invalid PDF attachment',
          });
        }

        if (!req.file) {
          return res.status(400).json({
            success: false,
            message: 'Please select a PDF file',
          });
        }

        // Validate PDF file signature.
        const signature = req.file.buffer
          .subarray(0, 5)
          .toString('ascii');

        if (signature !== '%PDF-') {
          return res.status(400).json({
            success: false,
            message: 'The selected file is not a valid PDF',
          });
        }

        try {
          const result = await new Promise<{
            secure_url: string;
            public_id: string;
          }>((resolve, reject) => {
            const stream =
              cloudinary.uploader.upload_stream(
                {
                  folder:
                    'temple-app/divyakshetra-updates/pdfs',
                  resource_type: 'raw',
                  use_filename: false,
                  unique_filename: true,
                },
                (uploadError, uploadResult) => {
                  if (uploadError || !uploadResult) {
                    return reject(
                      uploadError ??
                        new Error('PDF upload failed')
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
            message: 'PDF uploaded successfully',
            data: {
              attachment_url: result.secure_url,
              public_id: result.public_id,
            },
          });
        } catch (uploadError) {
          console.error(
            'Divyakshetra PDF upload error:',
            uploadError
          );

          return res.status(500).json({
            success: false,
            message: 'Unable to upload PDF attachment',
          });
        }
      }
    );
  }
);

export default router;
