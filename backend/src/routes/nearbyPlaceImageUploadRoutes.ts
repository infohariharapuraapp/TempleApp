
import { Router, Request, Response } from 'express';
import multer from 'multer';
import cloudinary from '../config/cloudinary';
import { pool } from '../db';

import { authenticateToken } from '../middleware/authMiddleware';
import { requireAdmin } from '../middleware/adminMiddleware';

const router = Router();

router.use(authenticateToken, requireAdmin);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 8,
  },
  fileFilter: (_req, file, callback) => {
    if (
      ![
        'image/jpeg',
        'image/png',
        'image/webp',
      ].includes(file.mimetype)
    ) {
      return callback(
        new Error('Only JPG, PNG or WebP images are allowed')
      );
    }

    callback(null, true);
  },
});

const uploadToCloudinary = (
  buffer: Buffer
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'temple-app/nearby-places',
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
      (error, result) => {
        if (error || !result) {
          return reject(
            error ?? new Error('Cloudinary upload failed')
          );
        }

        resolve(result.secure_url);
      }
    );

    stream.end(buffer);
  });
};

/*
|--------------------------------------------------------------------------
| POST /:placeId/upload
|--------------------------------------------------------------------------
| Multipart field: images
*/

router.post(
  '/:placeId/upload',
  (req: Request, res: Response) => {
    upload.array('images', 8)(
      req,
      res,
      async (error: any) => {
        if (error) {
          return res.status(400).json({
            success: false,
            message: error.message || 'Invalid images',
          });
        }

        const placeId = String(req.params.placeId);

        if (!/^[1-9]\d*$/.test(placeId)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid place ID',
          });
        }

        const files = req.files as Express.Multer.File[];

        if (!files || files.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'Select at least one image',
          });
        }

        try {
          const place = await pool.query(
            'SELECT id FROM nearby_places WHERE id = $1',
            [placeId]
          );

          if (place.rows.length === 0) {
            return res.status(404).json({
              success: false,
              message: 'Place not found',
            });
          }

          const savedImages = [];

          for (const file of files) {
            const imageUrl = await uploadToCloudinary(
              file.buffer
            );

            const result = await pool.query(
              `
              INSERT INTO nearby_place_images
                (place_id, image_url, display_order)
              VALUES (
                $1,
                $2,
                COALESCE(
                  (
                    SELECT MAX(display_order) + 1
                    FROM nearby_place_images
                    WHERE place_id = $1
                  ),
                  0
                )
              )
              RETURNING id, place_id, image_url, display_order
              `,
              [placeId, imageUrl]
            );

            savedImages.push(result.rows[0]);
          }

          return res.status(201).json({
            success: true,
            message: `${savedImages.length} images uploaded`,
            data: savedImages,
          });
        } catch (uploadError) {
          console.error(
            'Nearby place image upload:',
            uploadError
          );

          return res.status(500).json({
            success: false,
            message:
              'Image upload failed. Some earlier images may have been saved.',
          });
        }
      }
    );
  }
);

export default router;
