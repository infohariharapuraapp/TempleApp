import { Request, Response } from 'express';
import { pool } from '../db';

const LANGUAGE_FIELDS = [
  'name_en',
  'name_te',
  'name_kn',
  'name_hi',
  'name_ta',
] as const;

function normalizeCategory(
  body: Record<string, unknown>,
  existing: Record<string, unknown> = {}
) {
  const names = LANGUAGE_FIELDS.map((field) => {
    const value =
      body[field] !== undefined
        ? body[field]
        : existing[field];

    if (value == null) return null;

    if (
      typeof value !== 'string' ||
      value.trim().length > 100
    ) {
      throw new Error(`Invalid ${field}`);
    }

    return value.trim() || null;
  });

  if (!names[0]) {
    throw new Error('English category name is required.');
  }

  const sortOrder =
    body.sort_order ?? existing.sort_order ?? 0;

  if (
    typeof sortOrder !== 'number' ||
    !Number.isInteger(sortOrder) ||
    sortOrder < 0 ||
    sortOrder > 2147483647
  ) {
    throw new Error('Invalid sort order.');
  }

  const isActive =
    body.is_active ?? existing.is_active ?? true;

  if (typeof isActive !== 'boolean') {
    throw new Error('Invalid active status.');
  }

  return {
    names,
    sortOrder,
    isActive,
  };
}

function validId(value: unknown) {
  const id = Number(value);

  return Number.isSafeInteger(id) &&
    id > 0 &&
    id <= 2147483647
    ? id
    : null;
}

// ========================================
// PUBLIC CATEGORIES
// ========================================

export async function getDarshanVideoCategories(
  req: Request,
  res: Response
) {
  try {
    const lang = String(req.query.lang || 'en')
      .toLowerCase()
      .split('-')[0];

    const field = LANGUAGE_FIELDS.find(
      (item) => item === `name_${lang}`
    ) || 'name_en';

    const result = await pool.query(`
      SELECT
        c.id,
        COALESCE(
          NULLIF(c.${field}, ''),
          c.name_en,
          c.name
        ) AS name,
        c.name_en,
        c.name_te,
        c.name_kn,
        c.name_hi,
        c.name_ta,
        c.sort_order,
        COUNT(v.id)::INTEGER AS video_count
      FROM darshan_video_categories c
      LEFT JOIN darshan_videos v
        ON v.category_id = c.id
        AND v.is_active = TRUE
      WHERE c.is_active = TRUE
      GROUP BY c.id
      ORDER BY c.sort_order ASC, c.id ASC
    `);

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get Darshan categories:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to load categories.',
    });
  }
}

// ========================================
// ALL CATEGORIES - ADMIN
// ========================================

export async function getAdminDarshanVideoCategories(
  _req: Request,
  res: Response
) {
  try {
    const result = await pool.query(`
      SELECT
        c.*,
        COUNT(v.id)::INTEGER AS video_count
      FROM darshan_video_categories c
      LEFT JOIN darshan_videos v
        ON v.category_id = c.id
      GROUP BY c.id
      ORDER BY c.sort_order ASC, c.id ASC
    `);

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Admin Darshan categories:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to load categories.',
    });
  }
}

// ========================================
// CREATE CATEGORY
// ========================================

export async function createDarshanVideoCategory(
  req: Request,
  res: Response
) {
  let input;

  try {
    input = normalizeCategory(req.body ?? {});
  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Invalid category data.',
    });
  }

  try {
    const result = await pool.query(
      `
      INSERT INTO darshan_video_categories (
        name,
        name_en,
        name_te,
        name_kn,
        name_hi,
        name_ta,
        sort_order,
        is_active
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *
      `,
      [
        input.names[0],
        ...input.names,
        input.sortOrder,
        input.isActive,
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
        message: 'Category already exists.',
      });
    }

    console.error('Create Darshan category:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to create category.',
    });
  }
}

// ========================================
// UPDATE CATEGORY
// ========================================

export async function updateDarshanVideoCategory(
  req: Request,
  res: Response
) {
  const id = validId(req.params.id);

  if (!id) {
    return res.status(400).json({
      success: false,
      message: 'Invalid category ID.',
    });
  }

  try {
    const existing = await pool.query(
      `
      SELECT *
      FROM darshan_video_categories
      WHERE id = $1
      `,
      [id]
    );

    if (!existing.rows.length) {
      return res.status(404).json({
        success: false,
        message: 'Category not found.',
      });
    }

    let input;

    try {
      input = normalizeCategory(
        req.body ?? {},
        existing.rows[0]
      );
    } catch (error) {
      return res.status(400).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Invalid category data.',
      });
    }

    const result = await pool.query(
      `
      UPDATE darshan_video_categories
      SET
        name = $1,
        name_en = $2,
        name_te = $3,
        name_kn = $4,
        name_hi = $5,
        name_ta = $6,
        sort_order = $7,
        is_active = $8,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
      RETURNING *
      `,
      [
        input.names[0],
        ...input.names,
        input.sortOrder,
        input.isActive,
        id,
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: 'Category not found.',
      });
    }

    return res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'Category already exists.',
      });
    }

    console.error('Update Darshan category:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to update category.',
    });
  }
}

// ========================================
// DELETE CATEGORY
// ========================================

export async function deleteDarshanVideoCategory(
  req: Request,
  res: Response
) {
  const id = validId(req.params.id);

  if (!id) {
    return res.status(400).json({
      success: false,
      message: 'Invalid category ID.',
    });
  }

  try {
    const result = await pool.query(
      `
      DELETE FROM darshan_video_categories
      WHERE id = $1
      RETURNING id
      `,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: 'Category not found.',
      });
    }

    return res.json({
      success: true,
      message: 'Category deleted successfully.',
    });
  } catch (error) {
    console.error('Delete Darshan category:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to delete category.',
    });
  }
}