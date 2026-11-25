import { Router, Request, Response } from 'express';
import multer from 'multer';

import cloudinary from '../config/cloudinary';

import {
  getAdminProgrammes,
  createProgramme,
  updateProgramme,
  updateProgrammePublishStatus,
  deleteProgramme,
} from '../controllers/mahaswamijiProgrammeController';

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
// CLOUDINARY IMAGE UPLOAD
// ========================================

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
    fields: 5,
    parts: 6,
    fieldSize: 16 * 1024,
  },

  fileFilter: (_req, file, callback) => {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return callback(
        new Error('Only JPG, PNG or WebP images are allowed')
      );
    }

    callback(null, true);
  },
});

router.post(
  '/upload',
  (req: Request, res: Response) => {
    upload.single('image')(
      req,
      res,
      async (error: any) => {
        if (error) {
          return res.status(400).json({
            success: false,
            message: error.message || 'Invalid image',
          });
        }

        if (!req.file) {
          return res.status(400).json({
            success: false,
            message: 'Please select an image',
          });
        }

        const imageBuffer = req.file.buffer;
        const mime = req.file.mimetype;
        const validJpeg =
          mime === 'image/jpeg' &&
          imageBuffer.length >= 4 &&
          imageBuffer[0] === 0xff &&
          imageBuffer[1] === 0xd8 &&
          imageBuffer[2] === 0xff;
        const validPng =
          mime === 'image/png' &&
          imageBuffer.length >= 24 &&
          imageBuffer.subarray(0, 8).equals(
            Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
          );
        const validWebp =
          mime === 'image/webp' &&
          imageBuffer.length >= 16 &&
          imageBuffer.toString('ascii', 0, 4) === 'RIFF' &&
          imageBuffer.toString('ascii', 8, 12) === 'WEBP';
        if (!validJpeg && !validPng && !validWebp) {
          return res.status(400).json({
            success: false,
            message: 'Invalid or unsupported image file',
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
                    'temple-app/mahaswamiji-programmes',
                  resource_type: 'image',
                  format: 'webp',
                  transformation: [
                    {
                      width: 1600,
                      height: 1200,
                      crop: 'limit',
                      quality: 'auto',
                    },
                  ],
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
            message: 'Programme image uploaded',
            data: {
              image_url: result.secure_url,
              public_id: result.public_id,
            },
          });
        } catch (uploadError) {
          console.error(
            'Mahaswamiji image upload:',
            uploadError
          );

          return res.status(500).json({
            success: false,
            message: 'Unable to upload programme image',
          });
        }
      }
    );
  }
);

// ========================================
// EXISTING ADMIN CRUD ROUTES
// ========================================

router.get('/', getAdminProgrammes);

router.post('/', createProgramme);

router.put('/:id', updateProgramme);

router.patch(
  '/:id/publish',
  updateProgrammePublishStatus
);

router.delete('/:id', deleteProgramme);

export default router;
