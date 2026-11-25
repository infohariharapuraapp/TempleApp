import { Request, Response } from 'express';
import { pool } from '../db';

import {
  createNotification,
  sendNotificationRecord,
} from '../services/notificationService';

// ========================================
// CONSTANTS
// ========================================

const VALID_LABELS = ['live', 'watch'] as const;

const LANGUAGE_FIELDS = [
  'name_en',
  'name_te',
  'name_kn',
  'name_hi',
  'name_ta',
] as const;

type VideoLabel = (typeof VALID_LABELS)[number];

// ========================================
// VALIDATION HELPERS
// ========================================

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

function normalizeLabel(value: unknown): VideoLabel {
  const label = String(value ?? '')
    .trim()
    .toLowerCase();

  if (!VALID_LABELS.includes(label as VideoLabel)) {
    throw new ValidationError(
      'Label must be either live or watch.'
    );
  }

  return label as VideoLabel;
}

function normalizeId(value: unknown): number {
  const id = Number(value);

  if (
    !Number.isSafeInteger(id) ||
    id <= 0 ||
    id > 2147483647
  ) {
    throw new ValidationError('Invalid ID.');
  }

  return id;
}

function normalizeBoolean(
  value: unknown,
  fallback: boolean
): boolean {
  if (value === undefined || value === null) {
    return fallback;
  }

  if (
    value === true ||
    value === 'true' ||
    value === '1' ||
    value === 1
  ) {
    return true;
  }

  if (
    value === false ||
    value === 'false' ||
    value === '0' ||
    value === 0
  ) {
    return false;
  }

  throw new ValidationError('Invalid active status.');
}

function requiredText(
  value: unknown,
  field: string
): string {
  if (
    typeof value !== 'string' ||
    !value.trim()
  ) {
    throw new ValidationError(
      `${field} is required.`
    );
  }

  return value.trim();
}

function optionalText(
  value: unknown
): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new ValidationError('Invalid text value.');
  }

  return value.trim() || null;
}

// ========================================
// CATEGORY VALIDATION
// ========================================

async function normalizeCategoryId(
  value: unknown
): Promise<number | null> {
  if (
    value === undefined ||
    value === null ||
    value === '' ||
    value === 'null'
  ) {
    return null;
  }

  const categoryId = normalizeId(value);

  const result = await pool.query(
    `
    SELECT id
    FROM darshan_video_categories
    WHERE id = $1
    `,
    [categoryId]
  );

  if (!result.rows.length) {
    throw new ValidationError(
      'Selected category does not exist.'
    );
  }

  return categoryId;
}

// ========================================
// LANGUAGE HELPER
// ========================================

function getLanguageField(req: Request) {
  const language = String(req.query.lang || 'en')
    .trim()
    .toLowerCase()
    .split('-')[0];

  return LANGUAGE_FIELDS.find(
    (field) => field === `name_${language}`
  ) || 'name_en';
}

// ========================================
// VIDEO URL VALIDATION
// ========================================

function validateVideoUrl(value: unknown): string {
  const url = requiredText(value, 'Video URL');

  try {
    const parsed = new URL(url);

    if (
      parsed.protocol !== 'https:' &&
      parsed.protocol !== 'http:'
    ) {
      throw new Error('Invalid protocol');
    }

    return url;
  } catch {
    throw new ValidationError(
      'Please enter a valid video URL.'
    );
  }
}

// ========================================
// YOUTUBE THUMBNAIL
// ========================================

function getYouTubeThumbnail(
  url: string
): string | null {
  try {
    const parsedUrl = new URL(url);

    const hostname =
      parsedUrl.hostname.toLowerCase();

    let videoId: string | null = null;

    const isYouTube =
      hostname === 'youtube.com' ||
      hostname.endsWith('.youtube.com');

    if (isYouTube) {
      videoId = parsedUrl.searchParams.get('v');

      if (!videoId) {
        const parts = parsedUrl.pathname
          .split('/')
          .filter(Boolean);

        if (
          ['live', 'shorts', 'embed', 'v']
            .includes(parts[0])
        ) {
          videoId = parts[1] || null;
        }
      }
    }

    if (hostname === 'youtu.be') {
      videoId =
        parsedUrl.pathname
          .split('/')
          .filter(Boolean)[0] || null;
    }

    if (
      !videoId ||
      !/^[a-zA-Z0-9_-]{11}$/.test(videoId)
    ) {
      return null;
    }

    return (
      `https://img.youtube.com/vi/` +
      `${videoId}/hqdefault.jpg`
    );
  } catch {
    return null;
  }
}

// ========================================
// ERROR RESPONSE
// ========================================

function handleError(
  res: Response,
  error: unknown,
  message: string
) {
  if (error instanceof ValidationError) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23503'
  ) {
    return res.status(400).json({
      success: false,
      message: 'Selected category no longer exists.',
    });
  }

  console.error(message, error);

  return res.status(500).json({
    success: false,
    message,
  });
}

// ========================================
// GET PUBLIC DARSHAN VIDEOS
// ========================================

export async function getDarshanVideos(
  req: Request,
  res: Response
) {
  try {
    const languageField = getLanguageField(req);

    const result = await pool.query(`
      SELECT
        v.id,
        v.title,
        v.description,
        v.label,
        v.url,
        v.thumbnail_url,
        v.is_active,
        v.created_at,
        v.updated_at,

        CASE
          WHEN c.is_active = TRUE
          THEN v.category_id
          ELSE NULL
        END AS category_id,

        CASE
          WHEN c.is_active = TRUE
          THEN COALESCE(
            NULLIF(c.${languageField}, ''),
            c.name_en,
            c.name
          )
          ELSE NULL
        END AS category_name

      FROM darshan_videos v

      LEFT JOIN darshan_video_categories c
        ON v.category_id = c.id

      WHERE v.is_active = TRUE

      ORDER BY
        CASE
          WHEN v.label = 'live' THEN 0
          ELSE 1
        END,
        v.id DESC
    `);

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    return handleError(
      res,
      error,
      'Failed to load darshan videos.'
    );
  }
}

// ========================================
// GET ALL ADMIN DARSHAN VIDEOS
// ========================================

export async function getAdminDarshanVideos(
  _req: Request,
  res: Response
) {
  try {
    const result = await pool.query(`
      SELECT
        v.id,
        v.title,
        v.description,
        v.label,
        v.url,
        v.thumbnail_url,
        v.is_active,
        v.category_id,
        v.created_at,
        v.updated_at,

        COALESCE(
          c.name_en,
          c.name
        ) AS category_name,

        c.is_active AS category_is_active

      FROM darshan_videos v

      LEFT JOIN darshan_video_categories c
        ON v.category_id = c.id

      ORDER BY v.id DESC
    `);

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    return handleError(
      res,
      error,
      'Failed to load darshan videos.'
    );
  }
}

// ========================================
// SEND VIDEO NOTIFICATION
// ========================================

async function notifyDarshanVideo(
  video: {
    id: number;
    title: string;
    label: VideoLabel;
  }
) {
  try {
    const notification =
      await createNotification({
        title:
          video.label === 'live'
            ? '🔴 Live Darshan'
            : '🎥 New Darshan Video',

        body:
          video.label === 'live'
            ? `${video.title} is now available to watch live.`
            : `${video.title} is now available to watch.`,

        notificationType: 'darshan_video',

        data: {
          type: 'darshan_video',
          videoId: video.id,
          label: video.label,
          screen: '/darshan-videos',
        },

        targetType: 'all',

        scheduledAt: null,
      });

    await sendNotificationRecord(
      notification.id
    );

    console.log(
      `Darshan video notification processed for video ${video.id}`
    );
  } catch (notificationError) {
    console.error(
      'Darshan video notification error:',
      notificationError
    );
  }
}

// ========================================
// CREATE DARSHAN VIDEO
// ========================================

export async function createDarshanVideo(
  req: Request,
  res: Response
) {
  try {
    const body = req.body ?? {};

    const title = requiredText(
      body.title,
      'Title'
    );

    const description = optionalText(
      body.description
    );

    const label = normalizeLabel(
      body.label
    );

    const url = validateVideoUrl(
      body.url
    );

    const isActive = normalizeBoolean(
      body.is_active,
      true
    );

    const categoryId =
      await normalizeCategoryId(
        body.category_id
      );

    // Uploaded thumbnail has priority.

    let thumbnailUrl = optionalText(
      body.thumbnail_url
    );

    if (req.file) {
      thumbnailUrl =
        req.file.path;
    }

    // Automatically generate YouTube thumbnail.

    if (!thumbnailUrl) {
      thumbnailUrl =
        getYouTubeThumbnail(url);
    }

    const result = await pool.query(
      `
      INSERT INTO darshan_videos (
        title,
        description,
        label,
        url,
        thumbnail_url,
        category_id,
        is_active
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7
      )
      RETURNING *
      `,
      [
        title,
        description,
        label,
        url,
        thumbnailUrl,
        categoryId,
        isActive,
      ]
    );

    const createdVideo = result.rows[0];

    // Send notifications only for active videos.

    if (createdVideo.is_active) {
      await notifyDarshanVideo(createdVideo);
    }

    return res.status(201).json({
      success: true,
      data: createdVideo,
    });
  } catch (error) {
    return handleError(
      res,
      error,
      'Failed to create darshan video.'
    );
  }
}

// ========================================
// UPDATE DARSHAN VIDEO
// ========================================

export async function updateDarshanVideo(
  req: Request,
  res: Response
) {
  try {
    const id = normalizeId(
      req.params.id
    );

    const body = req.body ?? {};

    const existingResult =
      await pool.query(
        `
        SELECT *
        FROM darshan_videos
        WHERE id = $1
        `,
        [id]
      );

    if (!existingResult.rows.length) {
      return res.status(404).json({
        success: false,
        message: 'Darshan video not found.',
      });
    }

    const existing =
      existingResult.rows[0];

    const title = requiredText(
      body.title ?? existing.title,
      'Title'
    );

    const description =
      body.description !== undefined
        ? optionalText(body.description)
        : existing.description;

    const label = normalizeLabel(
      body.label ?? existing.label
    );

    const url = validateVideoUrl(
      body.url ?? existing.url
    );

    const isActive = normalizeBoolean(
      body.is_active,
      existing.is_active
    );

    // Preserve existing category when omitted.

    const categoryId =
      body.category_id !== undefined
        ? await normalizeCategoryId(
            body.category_id
          )
        : existing.category_id;

    // Preserve existing thumbnail when omitted.

    let thumbnailUrl =
      body.thumbnail_url !== undefined
        ? optionalText(body.thumbnail_url)
        : existing.thumbnail_url;

    // New uploaded thumbnail has priority.

    if (req.file) {
      thumbnailUrl =
        req.file.path;
    }

    // Generate thumbnail if none exists.

    if (!thumbnailUrl) {
      thumbnailUrl =
        getYouTubeThumbnail(url);
    }

    const result = await pool.query(
      `
      UPDATE darshan_videos
      SET
        title = $1,
        description = $2,
        label = $3,
        url = $4,
        thumbnail_url = $5,
        category_id = $6,
        is_active = $7,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING *
      `,
      [
        title,
        description,
        label,
        url,
        thumbnailUrl,
        categoryId,
        isActive,
        id,
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: 'Darshan video not found.',
      });
    }

    const updatedVideo = result.rows[0];

    // Do not resend notifications when editing.

    return res.json({
      success: true,
      data: updatedVideo,
    });
  } catch (error) {
    return handleError(
      res,
      error,
      'Failed to update darshan video.'
    );
  }
}

// ========================================
// DELETE DARSHAN VIDEO
// ========================================

export async function deleteDarshanVideo(
  req: Request,
  res: Response
) {
  try {
    const id = normalizeId(
      req.params.id
    );

    const result = await pool.query(
      `
      DELETE FROM darshan_videos
      WHERE id = $1
      RETURNING id
      `,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: 'Darshan video not found.',
      });
    }

    return res.json({
      success: true,
      message:
        'Darshan video deleted successfully.',
    });
  } catch (error) {
    return handleError(
      res,
      error,
      'Failed to delete darshan video.'
    );
  }
}