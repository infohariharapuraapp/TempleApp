
import { Router, Request, Response } from 'express';
import multer from 'multer';
import cloudinary from '../config/cloudinary';
import { authenticateToken } from '../middleware/authMiddleware';
import { requireAdmin } from '../middleware/adminMiddleware';

const router = Router();

router.use(authenticateToken, requireAdmin);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 10,
  },
  fileFilter: (_req, file, callback) => {
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(
        file.mimetype
      )
    ) {
      return callback(
        new Error('Only JPG, PNG and WebP images are allowed')
      );
    }

    callback(null, true);
  },
});

function uploadToCloudinary(
  buffer: Buffer
): Promise<{ image_url: string; public_id: string }> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'temple-app/events',
        resource_type: 'image',
        format: 'webp',
        transformation: [
          {
            width: 1600,
            height: 1600,
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

        resolve({
          image_url: result.secure_url,
          public_id: result.public_id,
        });
      }
    );

    stream.end(buffer);
  });
}

router.post(
  '/upload-images',
  (req: Request, res: Response) => {
    upload.array('images', 10)(
      req,
      res,
      async (error: any) => {
        if (error) {
          return res.status(400).json({
            success: false,
            message: error.message || 'Invalid image upload',
          });
        }

        const files = req.files as Express.Multer.File[];

        if (!files?.length) {
          return res.status(400).json({
            success: false,
            message: 'Please select at least one image',
          });
        }

        const uploaded: {
          image_url: string;
          public_id: string;
        }[] = [];

        try {
          for (const file of files) {
            // Validate actual image content, not just MIME.
            const buffer = file.buffer;
            const jpeg =
              buffer.length >= 3 &&
              buffer.subarray(0, 3).equals(
                Buffer.from([0xff, 0xd8, 0xff])
              );
            const png =
              buffer.length >= 8 &&
              buffer.subarray(0, 8).equals(
                Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
              );
            const webp =
              buffer.length >= 12 &&
              buffer.toString('ascii', 0, 4) === 'RIFF' &&
              buffer.toString('ascii', 8, 12) === 'WEBP';

            if (!jpeg && !png && !webp) {
              throw new Error('Invalid image file content');
            }

            uploaded.push(
              await uploadToCloudinary(buffer)
            );
          }

          return res.status(201).json({
            success: true,
            message: 'Event images uploaded successfully',
            data: uploaded,
          });
        } catch (uploadError) {
          console.error('Event image upload error:', uploadError);

          // Clean up images from a partially failed batch.
          await Promise.allSettled(
            uploaded.map(item =>
              cloudinary.uploader.destroy(item.public_id)
            )
          );

          return res.status(500).json({
            success: false,
            message: 'Unable to upload event images',
          });
        }
      }
    );
  }
);

export default router;
