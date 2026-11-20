import { Response } from 'express';
import multer from 'multer';
import { randomUUID } from 'crypto';

import { pool } from '../db';
import cloudinary from '../config/cloudinary';
import { AuthRequest } from '../middleware/authMiddleware';

// ========================================
// PHOTO UPLOAD CONFIGURATION
// ========================================

const MAX_PHOTO_SIZE = 5 * 1024 * 1024;
const MAX_CONCURRENT_PHOTO_UPLOADS = 4;
const activePhotoUploads = new Map<number, symbol>();

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: MAX_PHOTO_SIZE,
    files: 1,
    fields: 2,
    parts: 3,
  },

  fileFilter: (_req, file, callback) => {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return callback(
        new Error('Only JPG, PNG and WebP images are allowed')
      );
    }

    callback(null, true);
  },
});

// ========================================
// VALIDATE IMAGE SIGNATURE
// ========================================

function isValidImage(
  buffer: Buffer,
  mimeType: string
): boolean {
  if (buffer.length < 12) {
    return false;
  }

  if (mimeType === 'image/jpeg') {
    return (
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    );
  }

  if (mimeType === 'image/png') {
    return buffer.subarray(0, 8).equals(
      Buffer.from([
        0x89, 0x50, 0x4e, 0x47,
        0x0d, 0x0a, 0x1a, 0x0a,
      ])
    );
  }

  if (mimeType === 'image/webp') {
    return (
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP'
    );
  }

  return false;
}

// ========================================
// VALIDATE POSITIVE INTEGER ID
// ========================================

function parseId(value: unknown): number | null {
  const text = String(value ?? '');

  if (!/^[1-9]\d*$/.test(text)) {
    return null;
  }

  const number = Number(text);

  if (
    !Number.isSafeInteger(number) ||
    number > 2147483647
  ) {
    return null;
  }

  return number;
}

// ========================================
// UPLOAD PRIVATE VOLUNTEER PHOTOGRAPH
// ========================================

async function uploadPrivatePhoto(
  buffer: Buffer
): Promise<{
  secure_url: string;
  public_id: string;
}> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'temple-app/volunteer/photos',

        public_id: randomUUID(),

        resource_type: 'image',

        type: 'authenticated',

        overwrite: false,

        format: 'webp',

        transformation: [
          {
            width: 1000,
            height: 1200,
            crop: 'limit',
            quality: 'auto',
          },
        ],

        timeout: 30000,
      },

      (error, result) => {
        if (error || !result) {
          return reject(
            error ?? new Error('Photo upload failed')
          );
        }

        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
        });
      }
    );

    stream.end(buffer);
  });
}

// ========================================
// CLEAN UP FAILED UPLOAD
// ========================================

async function deletePrivatePhoto(
  publicId: string
): Promise<void> {
  try {
    await cloudinary.uploader.destroy(
      publicId,
      {
        resource_type: 'image',
        type: 'authenticated',
        invalidate: true,
      }
    );
  } catch {
    console.error(
      'Volunteer photograph cleanup failed'
    );
  }
}

// ========================================
// DEVOTEE: TEMPORARY PHOTO UPLOAD
// POST /volunteer/photos/upload
// ========================================

export const uploadVolunteerPhoto = (
  req: AuthRequest,
  res: Response
) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }

  res.set('Cache-Control', 'private, no-store');

  const userId = req.user.userId;
  if (activePhotoUploads.has(userId)) {
    return res.status(429).json({
      success: false,
      message:
        'A photograph upload is already running. Please wait.',
    });
  }
  if (
    activePhotoUploads.size >=
    MAX_CONCURRENT_PHOTO_UPLOADS
  ) {
    return res.status(503).json({
      success: false,
      message:
        'Photograph uploads are busy. Please try again shortly.',
    });
  }
  const uploadToken = Symbol('volunteer-photo-upload');
  activePhotoUploads.set(userId, uploadToken);
  let callbackStarted = false;
  let disconnected = false;
  const releaseUpload = () => {
    if (
      activePhotoUploads.get(userId) === uploadToken
    ) {
      activePhotoUploads.delete(userId);
    }
  };
  const handleDisconnect = () => {
    disconnected = true;
    if (!callbackStarted) {
      releaseUpload();
    }
  };
  res.once('close', handleDisconnect);
  try {
    upload.single('image')(
    req,
    res,

    async (error: any) => {
      callbackStarted = true;
      try {
        if (
          disconnected ||
          req.aborted ||
          res.destroyed ||
          activePhotoUploads.get(userId) !== uploadToken
        ) {
          return;
        }
      if (error) {
        return res.status(400).json({
          success: false,
          message:
            error.code === 'LIMIT_FILE_SIZE'
              ? 'Photograph must not exceed 5 MB'
              : 'Invalid photograph upload',
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Please select a photograph',
        });
      }

      const opportunityId = parseId(
        req.body?.opportunity_id
      );

      if (!opportunityId) {
        return res.status(400).json({
          success: false,
          message: 'Invalid volunteer opportunity',
        });
      }

      if (
        !isValidImage(
          req.file.buffer,
          req.file.mimetype
        )
      ) {
        return res.status(400).json({
          success: false,
          message: 'Invalid image content',
        });
      }

      let uploadedPublicId: string | null = null;

      // Avoid deleting an image if the database
      // write outcome is uncertain.
      let databaseWriteStarted = false;

      try {
        const opportunity = await pool.query(
          `
          SELECT o.id
          FROM volunteer_opportunities o
          WHERE o.id = $1
            AND (
              (
                o.is_published = TRUE
                AND o.registration_enabled = TRUE
                AND clock_timestamp() >= o.registration_start_at
                AND clock_timestamp() < o.registration_end_at
                AND o.service_end_date >=
                  (clock_timestamp()
                    AT TIME ZONE 'Asia/Kolkata')::date
                AND NOT EXISTS (
                  SELECT 1
                  FROM volunteer_registrations existing
                  WHERE existing.opportunity_id = o.id
                    AND existing.user_id = $2
                    AND existing.status NOT IN (
                      'rejected', 'cancelled'
                    )
                )
              )
              OR EXISTS (
                SELECT 1
                FROM volunteer_registrations r
                JOIN volunteer_members m
                  ON m.registration_id = r.id
                  AND m.opportunity_id = o.id
                WHERE r.opportunity_id = o.id
                  AND (
                    r.user_id = $2
                    OR m.user_id = $2
                  )
                  AND r.status IN (
                    'pending',
                    'approved',
                    'assigned',
                    'in_progress'
                  )
                  AND m.status IN (
                    'pending',
                    'approved'
                  )
                  AND m.photo_status IN (
                    'missing',
                    'correction_required'
                  )
                  AND NOT EXISTS (
                    SELECT 1
                    FROM volunteer_id_cards c
                    WHERE c.member_id = m.id
                      AND c.status = 'active'
                      AND c.valid_until >=
                        (clock_timestamp()
                          AT TIME ZONE 'Asia/Kolkata')::date
                  )
              )
            )
          `,
          [opportunityId, userId]
        );

        if (!opportunity.rows.length) {
          return res.status(404).json({
            success: false,
            message: 'Photograph upload is not available for this opportunity',
          });
        }

        const pendingUploads = await pool.query(
          `
          SELECT COUNT(*)::integer AS total
          FROM volunteer_photo_uploads
          WHERE user_id = $1
            AND consumed_at IS NULL
            AND expires_at > NOW()
          `,
          [userId]
        );

        if (pendingUploads.rows[0].total >= 550) {
          return res.status(429).json({
            success: false,
            message: 'Too many pending photograph uploads',
          });
        }

        const uploaded = await uploadPrivatePhoto(
          req.file.buffer
        );

        uploadedPublicId = uploaded.public_id;

        databaseWriteStarted = true;

        const result = await pool.query(
          `
          INSERT INTO volunteer_photo_uploads (
            user_id,
            opportunity_id,
            photo_url,
            cloudinary_public_id
          )
          VALUES ($1, $2, $3, $4)
          RETURNING
            id,
            expires_at
          `,
          [
            userId,
            opportunityId,
            uploaded.secure_url,
            uploaded.public_id,
          ]
        );

        return res.status(201).json({
          success: true,
          message: 'Photograph uploaded successfully',

          data: {
            upload_id: result.rows[0].id,
            expires_at: result.rows[0].expires_at,
          },
        });

      } catch {
        if (
          uploadedPublicId &&
          !databaseWriteStarted
        ) {
          await deletePrivatePhoto(uploadedPublicId);
        }

        console.error(
          'Volunteer photograph upload failed'
        );

        return res.status(500).json({
          success: false,
          message:
            'Unable to upload photograph. Please try again.',
        });
      }
      } finally {
        res.removeListener('close', handleDisconnect);
        releaseUpload();
      }
    }
  );
  } catch {
    res.removeListener('close', handleDisconnect);
    releaseUpload();
    if (!res.headersSent && !res.destroyed) {
      return res.status(500).json({
        success: false,
        message: 'Unable to process photograph upload',
      });
    }
  }
};
