
import { Request, Response } from 'express';
import { pool } from '../db';
import {
  translateTextOrOriginal,
  TranslationLanguage,
  SUPPORTED_LANGUAGES,
} from '../services/translationService';

// ========================================
// DIVYAKSHETRA UPDATES
// PUBLIC ANNOUNCEMENT CONTROLLER
// MULTILINGUAL SUPPORT
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

function getRequestedLanguage(
  value: unknown
): TranslationLanguage {
  if (
    typeof value === 'string' &&
    SUPPORTED_LANGUAGES.includes(
      value as TranslationLanguage
    )
  ) {
    return value as TranslationLanguage;
  }

  return 'en';
}

// Translate public-facing text only.
// Never translate IDs, URLs, dates or database fields.
async function localizeAnnouncement(
  announcement: any,
  language: TranslationLanguage
) {
  if (language === 'en') {
    return {
      ...announcement,
      language,
      original_title: announcement.title,
      original_message: announcement.message,
    };
  }

  const [title, message] = await Promise.all([
    translateTextOrOriginal(
      announcement.title,
      language,
      'en'
    ),
    translateTextOrOriginal(
      announcement.message,
      language,
      'en'
    ),
  ]);

  return {
    ...announcement,
    title,
    message,
    language,
    original_title: announcement.title,
    original_message: announcement.message,
  };
}

// ========================================
// GET ALL PUBLISHED ANNOUNCEMENTS
// Supports category, search and language
// ========================================

export async function getAnnouncements(
  req: Request,
  res: Response
) {
  try {
    const language = getRequestedLanguage(
      req.query.lang
    );

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
        item =>
          item.toLowerCase() ===
          category.toLowerCase()
      )
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid announcement category',
      });
    }

    const selectedCategory =
      !category ||
      category.toLowerCase() === 'all'
        ? null
        : ALLOWED_CATEGORIES.find(
            item =>
              item.toLowerCase() ===
              category.toLowerCase()
          ) || null;

    const result = await pool.query(
      `
      SELECT
        ${ANNOUNCEMENT_FIELDS}
      FROM announcements
      WHERE is_active = TRUE

        AND (
          publish_at IS NULL
          OR publish_at <= CURRENT_TIMESTAMP
        )

        AND (
          expires_at IS NULL
          OR expires_at > CURRENT_TIMESTAMP
        )

        AND (
          $1::text IS NULL
          OR category = $1
        )

        AND (
          $2::text = ''
          OR title ILIKE '%' || $2 || '%'
          OR message ILIKE '%' || $2 || '%'
        )

      ORDER BY
        is_pinned DESC,
        COALESCE(
          publish_at,
          created_at
        ) DESC,
        id DESC
      `,
      [selectedCategory, search]
    );

    const announcements = result.rows;

    // English requires no external translation.
    if (language === 'en') {
      return res.status(200).json({
        success: true,
        data: announcements,
      });
    }

    // Limit concurrent translation operations
    // to reduce provider pressure.
    const translatedAnnouncements = [];

    for (const announcement of announcements) {
      translatedAnnouncements.push(
        await localizeAnnouncement(
          announcement,
          language
        )
      );
    }

    return res.status(200).json({
      success: true,
      data: translatedAnnouncements,
    });
  } catch (error) {
    console.error(
      'Get Divyakshetra Updates error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Failed to load Divyakshetra Updates',
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
    const announcementId = Number(
      req.params.id
    );

    if (
      !Number.isSafeInteger(announcementId) ||
      announcementId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid announcement ID',
      });
    }

    const language = getRequestedLanguage(
      req.query.lang
    );

    const result = await pool.query(
      `
      SELECT
        ${ANNOUNCEMENT_FIELDS}
      FROM announcements
      WHERE id = $1
        AND is_active = TRUE

        AND (
          publish_at IS NULL
          OR publish_at <= CURRENT_TIMESTAMP
        )

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
        message:
          'Announcement not found or no longer available',
      });
    }

    const announcement =
      result.rows[0];

    if (language === 'en') {
      return res.status(200).json({
        success: true,
        data: announcement,
      });
    }

    const translatedAnnouncement =
      await localizeAnnouncement(
        announcement,
        language
      );

    return res.status(200).json({
      success: true,
      data: translatedAnnouncement,
    });
  } catch (error) {
    console.error(
      'Get Divyakshetra Update by ID error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Failed to load Divyakshetra Update',
    });
  }
}
