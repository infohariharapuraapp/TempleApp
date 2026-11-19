import {
  Request,
  Response,
} from 'express';

import multer from 'multer';

import cloudinary from '../config/cloudinary';

// ========================================
// IMAGE UPLOAD CONFIGURATION
// ========================================

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
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
          'Only JPG, PNG and WebP images are allowed'
        )
      );
    }

    callback(null, true);
  },
});

// ========================================
// ADMIN: UPLOAD PUBLIC VOLUNTEER IMAGE
// ========================================

export const uploadVolunteerImage = (
  req: Request,
  res: Response
) => {
  upload.single('image')(
    req,
    res,
    async (error: any) => {
      if (error) {
        return res.status(400).json({
          success: false,
          message:
            error.message || 'Invalid image',
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Please select an image',
        });
      }

      const type = req.body?.type;

      const allowedTypes = [
        'opportunity',
        'male-dress',
        'female-dress',
      ];

      if (!allowedTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid image upload type',
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
                  `temple-app/volunteer/${type}`,

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

              (uploadError, uploadResult) => {
                if (
                  uploadError ||
                  !uploadResult
                ) {
                  return reject(
                    uploadError ??
                    new Error(
                      'Cloudinary upload failed'
                    )
                  );
                }

                resolve({
                  secure_url:
                    uploadResult.secure_url,

                  public_id:
                    uploadResult.public_id,
                });
              }
            );

          stream.end(req.file!.buffer);
        });

        return res.status(201).json({
          success: true,

          message:
            'Volunteer image uploaded successfully',

          data: {
            image_url: result.secure_url,
            public_id: result.public_id,
          },
        });
      } catch (uploadError) {
        console.error(
          'Volunteer image upload error:',
          uploadError
        );

        return res.status(500).json({
          success: false,
          message: 'Unable to upload image',
        });
      }
    }
  );
};