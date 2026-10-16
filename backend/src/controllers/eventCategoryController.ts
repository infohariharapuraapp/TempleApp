
import { Request, Response } from 'express';
import { pool } from '../db';

// ========================================
// CATEGORY TRANSLATION FIELDS
// ========================================

const LANGUAGE_FIELDS = [
  'name_en',
  'name_te',
  'name_kn',
  'name_hi',
  'name_ta',
] as const;

type LanguageField =
  (typeof LANGUAGE_FIELDS)[number];

// ========================================
// VALIDATE AND NORMALIZE CATEGORY DATA
// ========================================

function normalizeCategoryInput(
  body: Record<string, unknown>,
  existing?: Record<string, unknown>
) {
  const values = {} as Record<LanguageField, string | null>;

  for (const field of LANGUAGE_FIELDS) {
    const supplied = body[field];

    if (
      supplied !== undefined &&
      supplied !== null &&
      typeof supplied !== 'string'
    ) {
      throw new Error(`Invalid ${field}`);
    }

    if (
      typeof supplied === 'string' &&
      supplied.trim().length > 100
    ) {
      throw new Error(`${field} must be 100 characters or fewer`);
    }

    const previous = existing?.[field];

    const value =
      supplied !== undefined
        ? supplied
        : previous;

    values[field] =
      typeof value === 'string' && value.trim()
        ? value.trim()
        : null;
  }

  // Backward compatibility with existing admin clients.
  const legacyName = body.name;

  if (
    legacyName !== undefined &&
    typeof legacyName !== 'string'
  ) {
    throw new Error('Invalid category name');
  }

  if (
    !values.name_en &&
    typeof legacyName === 'string' &&
    legacyName.trim()
  ) {
    values.name_en = legacyName.trim();
  }

  if (!values.name_en) {
    throw new Error('English category name is required');
  }

  if (values.name_en.length > 100) {
    throw new Error(
      'English category name must be 100 characters or fewer'
    );
  }

  return values;
}

// ========================================
// GET ACTIVE CATEGORIES (PUBLIC)
// ========================================

export const getEventCategories = async (
  _req: Request,
  res: Response
) => {
  try {
    const result = await pool.query(
      `SELECT
         id,
         name,
         COALESCE(NULLIF(name_en, ''), name) AS name_en,
         name_te,
         name_kn,
         name_hi,
         name_ta
       FROM event_categories
       WHERE is_active = TRUE
       ORDER BY name ASC`
    );

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error(
      'Get event categories error:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch event categories',
    });
  }
};

// ========================================
// GET ALL CATEGORIES (ADMIN)
// ========================================

export const getAdminEventCategories = async (
  _req: Request,
  res: Response
) => {
  try {
    const result = await pool.query(
      `SELECT
         id,
         name,
         COALESCE(NULLIF(name_en, ''), name) AS name_en,
         name_te,
         name_kn,
         name_hi,
         name_ta,
         is_active,
         created_at,
         updated_at
       FROM event_categories
       ORDER BY id ASC`
    );

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error(
      'Get admin categories error:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
    });
  }
};

// ========================================
// CREATE CATEGORY (ADMIN)
// ========================================

export const createEventCategory = async (
  req: Request,
  res: Response
) => {
  try {
    const values = normalizeCategoryInput(req.body ?? {});

    const result = await pool.query(
      `INSERT INTO event_categories (
         name,
         name_en,
         name_te,
         name_kn,
         name_hi,
         name_ta
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        values.name_en,
        values.name_en,
        values.name_te,
        values.name_kn,
        values.name_hi,
        values.name_ta,
      ]
    );

    return res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'Category already exists',
      });
    }

    if (error instanceof Error &&
        (error.message.startsWith('Invalid') ||
         error.message.includes('required') ||
         error.message.includes('100 characters'))) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    console.error('Create category error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to create category',
    });
  }
};

// ========================================
// UPDATE CATEGORY (ADMIN)
// ========================================

export const updateEventCategory = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;
    const body = req.body ?? {};

    if (
      !/^[1-9]\d*$/.test(String(id))
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID',
      });
    }

    if (
      body.is_active !== undefined &&
      typeof body.is_active !== 'boolean'
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category status',
      });
    }

    const existingResult = await pool.query(
      `SELECT *
       FROM event_categories
       WHERE id = $1`,
      [id]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    const values = normalizeCategoryInput(
      body,
      existingResult.rows[0]
    );

    const result = await pool.query(
      `UPDATE event_categories
       SET name = $1,
           name_en = $2,
           name_te = $3,
           name_kn = $4,
           name_hi = $5,
           name_ta = $6,
           is_active = COALESCE($7, is_active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING *`,
      [
        values.name_en,
        values.name_en,
        values.name_te,
        values.name_kn,
        values.name_hi,
        values.name_ta,
        body.is_active ?? null,
        id,
      ]
    );

    return res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'Category already exists',
      });
    }

    if (error instanceof Error &&
        (error.message.startsWith('Invalid') ||
         error.message.includes('required') ||
         error.message.includes('100 characters'))) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    console.error('Update category error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to update category',
    });
  }
};
