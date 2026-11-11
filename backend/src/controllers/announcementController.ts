
import { Request, Response } from 'express';
import { pool } from '../db';

// ========================================
// DIVYAKSHETRA UPDATES
// PUBLIC ANNOUNCEMENT CONTROLLER
// ========================================

const ALLOWED_CATEGORIES = [
  'General',
  'Festivals',
  'Poojas',
  'Sevas',
  'Important Notices',
  'Special Events',
];

const ANNOUNCEMENT_FIELDS = `
  id,
  title,
  message,
  image_url,
  category,
  is_pinned,
  expires_at,
  attachment_url,
  is_active,
  publish_at,
  created_at,
  updated_at
`;

// ========================================
// GET ALL PUBLISHED ANNOUNCEMENTS
// Supports optional category and search
// ========================================

export async function getAnnouncements(
  req: Request,
  res: Response
) {
  try {
    const category =
      typeof req.query.category === 'string'
        ? req.query.category.trim()
        : '';

    const search =
      typeof req.query.search === 'string'
        ? req.query.search.trim()
        : '';

    if (
      category &&
      category.toLowerCase() !== 'all' &&
      !ALLOWED_CATEGORIES.some(
        item => item.toLowerCase() === category.toLowerCase()
      )
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid announcement category',
      });
    }

    const selectedCategory =
      !category || category.toLowerCase() === 'all'
        ? null
        : ALLOWED_CATEGORIES.find(
            item =>
              item.toLowerCase() === category.toLowerCase()
          ) || null;

    const result = await pool.query(
      `
      SELECT
        ${ANNOUNCEMENT_FIELDS}
      FROM announcements
      WHERE is_active = TRUE

        -- Show published updates only
        AND (
          publish_at IS NULL
          OR publish_at <= CURRENT_TIMESTAMP
        )

        -- Hide expired updates
        AND (
          expires_at IS NULL
          OR expires_at > CURRENT_TIMESTAMP
        )

        -- Optional category filter
        AND (
          $1::text IS NULL
          OR category = $1
        )

        -- Optional search
        AND (
          $2::text = ''
          OR title ILIKE '%' || $2 || '%'
          OR message ILIKE '%' || $2 || '%'
        )

      ORDER BY
        is_pinned DESC,
        COALESCE(publish_at, created_at) DESC,
        id DESC
      `,
      [selectedCategory, search]
    );

    return res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error(
      'Get Divyakshetra Updates error:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to load Divyakshetra Updates',
    });
  }
}

// ========================================
// GET SINGLE ANNOUNCEMENT
// Used by details and push navigation
// ========================================

export async function getAnnouncementById(
  req: Request,
  res: Response
) {
  try {
    const announcementId = Number(req.params.id);

    if (
      !Number.isSafeInteger(announcementId) ||
      announcementId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid announcement ID',
      });
    }

    const result = await pool.query(
      `
      SELECT
        ${ANNOUNCEMENT_FIELDS}
      FROM announcements
      WHERE id = $1
        AND is_active = TRUE

        -- Must already be published
        AND (
          publish_at IS NULL
          OR publish_at <= CURRENT_TIMESTAMP
        )

        -- Must not be expired
        AND (
          expires_at IS NULL
          OR expires_at > CURRENT_TIMESTAMP
        )

      LIMIT 1
      `,
      [announcementId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found or no longer available',
      });
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error(
      'Get Divyakshetra Update by ID error:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to load Divyakshetra Update',
    });
  }
}
