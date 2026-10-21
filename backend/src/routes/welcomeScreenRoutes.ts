
import { Router, Request, Response } from 'express';
import multer from 'multer';

import cloudinary from '../config/cloudinary';

import {
  getWelcomeScreen,
  getAdminWelcomeScreen,
  updateWelcomeScreen,
} from '../controllers/welcomeScreenController';

import {
  authenticateToken,
} from '../middleware/authMiddleware';

import {
  requireAdmin,
} from '../middleware/adminMiddleware';

// ========================================
// PUBLIC ROUTES
// ========================================

export const welcomeScreenRouter = Router();

welcomeScreenRouter.get('/', getWelcomeScreen);

// ========================================
// ADMIN ROUTES
// ========================================

export const adminWelcomeScreenRouter = Router();

adminWelcomeScreenRouter.use(
  authenticateToken,
  requireAdmin
);

adminWelcomeScreenRouter.get(
  '/',
  getAdminWelcomeScreen
);

adminWelcomeScreenRouter.put(
  '/',
  updateWelcomeScreen
);

// ========================================
// CLOUDINARY IMAGE UPLOAD
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
        new Error('Only JPG, PNG or WebP images are allowed')
      );
    }

    callback(null, true);
  },
});

adminWelcomeScreenRouter.post(
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

        try {
          const result = await new Promise<{
            secure_url: string;
            public_id: string;
          }>((resolve, reject) => {
            const stream =
              cloudinary.uploader.upload_stream(
                {
                  folder: 'temple-app/welcome-screen',
                  resource_type: 'image',
                  format: 'webp',
                  transformation: [
                    {
                      width: 1200,
                      height: 1600,
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
            message: 'Welcome image uploaded',
            data: {
              image_url: result.secure_url,
              public_id: result.public_id,
            },
          });
        } catch (uploadError) {
          console.error(
            'Welcome image upload:',
            uploadError
          );

          return res.status(500).json({
            success: false,
            message: 'Unable to upload welcome image',
          });
        }
      }
    );
  }
);
