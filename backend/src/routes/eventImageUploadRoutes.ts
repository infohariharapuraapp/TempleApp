
import { Router, Request, Response } from 'express';
import multer from 'multer';
import cloudinary from '../config/cloudinary';
import { authenticateToken } from '../middleware/authMiddleware';
import { requireAdmin } from '../middleware/adminMiddleware';

const router = Router();

router.use(authenticateToken, requireAdmin);

const ALLOWED_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.bmp',
  '.tif',
  '.tiff',
  '.heic',
  '.heif',
  '.avif',
]);

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/x-ms-bmp',
  'image/tiff',
  'image/heic',
  'image/heif',
  'image/avif',
]);

function getExtension(filename: string): string {
  const index = filename.lastIndexOf('.');
  return index < 0 ? '' : filename.slice(index).toLowerCase();
}

function detectImageFormat(buffer: Buffer): string | null {
  if (
    buffer.length >= 3 &&
    buffer.subarray(0, 3).equals(
      Buffer.from([0xff, 0xd8, 0xff])
    )
  ) return 'jpeg';

  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    )
  ) return 'png';

  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) return 'webp';

  if (
    buffer.length >= 6 &&
    ['GIF87a', 'GIF89a'].includes(
      buffer.toString('ascii', 0, 6)
    )
  ) return 'gif';

  if (
    buffer.length >= 2 &&
    buffer.toString('ascii', 0, 2) === 'BM'
  ) return 'bmp';

  if (
    buffer.length >= 4 &&
    (
      buffer.subarray(0, 4).equals(
        Buffer.from([0x49, 0x49, 0x2a, 0x00])
      ) ||
      buffer.subarray(0, 4).equals(
        Buffer.from([0x4d, 0x4d, 0x00, 0x2a])
      )
    )
  ) return 'tiff';

  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 4, 8) === 'ftyp'
  ) {
    const brand = buffer.toString('ascii', 8, 12);

    if (['avif', 'avis'].includes(brand)) return 'avif';

    if (
      ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand)
    ) return 'heif';
  }

  return null;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 10,
  },
  fileFilter: (_req, file, callback) => {
    const extension = getExtension(file.originalname);

    if (
      !ALLOWED_EXTENSIONS.has(extension) ||
      !ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase())
    ) {
      return callback(
        new Error(
          'Unsupported image format. Use JPG, JPEG, PNG, WebP, GIF, BMP, TIFF, HEIC, HEIF or AVIF.'
        )
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
            flags: 'strip_profile',
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
          // Validate all files before uploading any.
          for (const file of files) {
            const detected = detectImageFormat(file.buffer);

            if (!detected) {
              return res.status(400).json({
                success: false,
                message: `Invalid or unsupported image: ${file.originalname}`,
              });
            }

            const extension = getExtension(file.originalname);
            const validExtensions: Record<string, string[]> = {
              jpeg: ['.jpg', '.jpeg'],
              png: ['.png'],
              webp: ['.webp'],
              gif: ['.gif'],
              bmp: ['.bmp'],
              tiff: ['.tif', '.tiff'],
              heif: ['.heic', '.heif'],
              avif: ['.avif'],
            };

            if (!validExtensions[detected]?.includes(extension)) {
              return res.status(400).json({
                success: false,
                message: `Image extension does not match file content: ${file.originalname}`,
              });
            }
          }

          for (const file of files) {
            uploaded.push(
              await uploadToCloudinary(file.buffer)
            );
          }

          return res.status(201).json({
            success: true,
            message: 'Event images uploaded successfully',
            data: uploaded,
          });
        } catch (uploadError) {
          console.error('Event image upload error:', uploadError);

          await Promise.allSettled(
            uploaded.map(item =>
              cloudinary.uploader.destroy(item.public_id)
            )
          );

          return res.status(500).json({
            success: false,
            message: 'Unable to process or upload event images',
          });
        }
      }
    );
  }
);

export default router;
