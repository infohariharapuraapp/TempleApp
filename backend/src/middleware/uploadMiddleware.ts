import multer from 'multer';
import cloudinary from '../config/cloudinary';

import { randomUUID } from 'crypto';
import { RequestHandler } from 'express';
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_CONCURRENT_UPLOADS = 4;
let activeUploads = 0;
const galleryDirectory = 'temple-app/gallery';
const darshanDirectory = 'temple-app/darshan';
function detectImageExtension(
  buffer: Buffer,
  mimeType: string
): string | null {
  if (buffer.length < 12) {
    return null;
  }
  if (
    (mimeType === 'image/jpeg' ||
      mimeType === 'image/jpg') &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return '.jpg';
  }
  if (
    mimeType === 'image/png' &&
    buffer.subarray(0, 8).equals(
      Buffer.from([
        0x89, 0x50, 0x4e, 0x47,
        0x0d, 0x0a, 0x1a, 0x0a,
      ])
    )
  ) {
    return '.png';
  }
  if (
    mimeType === 'image/webp' &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return '.webp';
  }
  return null;
}
const parser = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_SIZE,
    files: 1,
    fields: 20,
    parts: 22,
    fieldSize: 64 * 1024,
    fieldNameSize: 100,
  },
  fileFilter: (_req, file, callback) => {
    const allowed = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
    ];
    if (!allowed.includes(file.mimetype)) {
      return callback(new Error('Invalid image type'));
    }
    callback(null, true);
  },
});
function createUploader(directory: string) {
  return {
    single(fieldName: string): RequestHandler {
      return (req, res, next) => {
        // Preserve existing JSON and URL-only requests.
        if (!req.is('multipart/form-data')) {
          return next();
        }
        if (activeUploads >= MAX_CONCURRENT_UPLOADS) {
          return res.status(503).json({
            success: false,
            message: 'Image uploads are busy. Please try again shortly.',
          });
        }
        activeUploads++;
        let released = false;
        let processing = false;
        let disconnected = false;
        const release = () => {
          if (!released) {
            released = true;
            activeUploads--;
          }
        };
        const onClose = () => {
          disconnected = true;
          if (!processing) {
            release();
          }
        };
        res.once('close', onClose);
        try {
          parser.single(fieldName)(
            req,
            res,
            async (error: unknown) => {
              processing = true;

              try {
                if (disconnected || req.aborted || res.destroyed) {
                  return;
                }
                if (error) {
                  const tooLarge =
                    error instanceof multer.MulterError &&
                    error.code === 'LIMIT_FILE_SIZE';
                  return res.status(tooLarge ? 413 : 400).json({
                    success: false,
                    message: tooLarge
                      ? 'Image must not exceed 5 MB'
                      : 'Invalid image upload',
                  });
                }
                if (req.file) {
                  const extension = detectImageExtension(
                    req.file.buffer,
                    req.file.mimetype
                  );
                  if (!extension) {
                    return res.status(400).json({
                      success: false,
                      message: 'Invalid image content',
                    });
                  }
                  const publicId = randomUUID();
                  const imageBuffer = req.file.buffer;
                  const uploaded = await new Promise<{
                    secure_url: string;
                    public_id: string;
                  }>((resolve, reject) => {
                    const stream = cloudinary.uploader.upload_stream(
                      {
                        folder: directory,
                        public_id: publicId,
                        resource_type: 'image',
                        type: 'upload',
                        overwrite: false,
                        format: 'webp',
                        timeout: 30000,
                        transformation: [
                          {
                            width: 1600,
                            height: 1600,
                            crop: 'limit',
                            quality: 'auto',
                          },
                        ],
                      },
                      (uploadError, result) => {
                        if (uploadError || !result) {
                          reject(new Error('Image storage failed'));
                          return;
                        }
                        resolve({
                          secure_url: result.secure_url,
                          public_id: result.public_id,
                        });
                      }
                    );
                    stream.once('error', reject);
                    stream.end(imageBuffer);
                  });
                  const imageUrl = new URL(uploaded.secure_url);
                  if (
                    imageUrl.protocol !== 'https:' ||
                    imageUrl.hostname !== 'res.cloudinary.com' ||
                    !imageUrl.pathname.startsWith(
                      '/' + process.env.CLOUDINARY_CLOUD_NAME +
                      '/image/upload/'
                    )
                  ) {
                    throw new Error('Invalid image storage response');
                  }
                  if (
                    disconnected ||
                    req.aborted ||
                    res.destroyed
                  ) {
                    await cloudinary.uploader.destroy(
                      uploaded.public_id,
                      { resource_type: 'image', type: 'upload' }
                    ).catch(() => {
                      console.error('Image storage cleanup failed');
                    });
                    return;
                  }
                  req.file.filename = publicId + '.webp';
                  req.file.destination = directory;
                  req.file.path = uploaded.secure_url;
                  req.file.mimetype = 'image/webp';
                  req.file.buffer = Buffer.alloc(0);
                }
              } catch {

                console.error('Secure image upload failed');
                if (!res.headersSent && !res.destroyed) {
                  return res.status(500).json({
                    success: false,
                    message: 'Unable to upload image',
                  });
                }
                return;
              } finally {
                res.removeListener('close', onClose);
                release();
              }
              if (!disconnected && !req.aborted && !res.destroyed) {
                next();
              }
            }
          );
        } catch {
          res.removeListener('close', onClose);
          release();
          if (!res.headersSent && !res.destroyed) {
            return res.status(500).json({
              success: false,
              message: 'Unable to process image upload',
            });
          }
        }
      };
    },
  };
}
export const uploadGalleryImage =
  createUploader(galleryDirectory);
export const uploadDarshanThumbnail =
  createUploader(darshanDirectory);
