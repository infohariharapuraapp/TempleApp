
import { Request, Response } from 'express';
import { pool } from '../db';

// ========================================
// PUBLIC - ACTIVE CATEGORIES
// ========================================

export const getNearbyCategories = async (
  _req: Request,
  res: Response
) => {
  try {
    const result = await pool.query(
      `SELECT id, name, description, icon,
              display_order
       FROM nearby_place_categories
       WHERE is_active = TRUE
       ORDER BY display_order ASC, id ASC`
    );

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get nearby categories:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch nearby categories',
    });
  }
};

// ========================================
// ADMIN - ALL CATEGORIES
// ========================================

export const getAdminNearbyCategories = async (
  _req: Request,
  res: Response
) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM nearby_place_categories
       ORDER BY display_order ASC, id ASC`
    );

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Admin nearby categories:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
    });
  }
};

// ========================================
// ADMIN - CREATE CATEGORY
// ========================================

export const createNearbyCategory = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      name,
      description,
      icon,
      display_order,
      is_active,
    } = req.body;

    if (
      typeof name !== 'string' ||
      !name.trim() ||
      name.trim().length > 150
    ) {
      return res.status(400).json({
        success: false,
        message: 'Valid category name is required',
      });
    }

    const result = await pool.query(
      `INSERT INTO nearby_place_categories
       (name, description, icon, display_order, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        name.trim(),
        description ?? null,
        icon || '📍',
        display_order ?? 0,
        is_active ?? true,
      ]
    );

    return res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Create nearby category:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to create category',
    });
  }
};

// ========================================
// ADMIN - UPDATE CATEGORY
// ========================================

export const updateNearbyCategory = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;

    if (!/^[1-9]\d*$/.test(String(id))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID',
      });
    }

    const {
      name,
      description,
      icon,
      display_order,
      is_active,
    } = req.body;

    if (
      name !== undefined &&
      (typeof name !== 'string' ||
        !name.trim() ||
        name.trim().length > 150)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category name',
      });
    }

    const result = await pool.query(
      `UPDATE nearby_place_categories
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           icon = COALESCE($3, icon),
           display_order = COALESCE($4, display_order),
           is_active = COALESCE($5, is_active),
           updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [
        name?.trim() ?? null,
        description ?? null,
        icon ?? null,
        display_order ?? null,
        is_active ?? null,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    return res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Update nearby category:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to update category',
    });
  }
};

/*
|--------------------------------------------------------------------------
| ADMIN - PERMANENTLY DELETE CATEGORY
|--------------------------------------------------------------------------
| A category can only be deleted when it contains no places.
*/

export const deleteNearbyCategory = async (
  req: Request,
  res: Response
) => {
  try {
    const id = String(req.params.id);

    if (!/^[1-9]\d*$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID',
      });
    }

    const result = await pool.query(
      `
      DELETE FROM nearby_place_categories AS c
      WHERE c.id = $1
        AND NOT EXISTS (
          SELECT 1
          FROM nearby_places AS p
          WHERE p.category_id = c.id
        )
      RETURNING c.id, c.name
      `,
      [id]
    );

    if (result.rows.length > 0) {
      return res.json({
        success: true,
        message: 'Category permanently deleted',
        data: result.rows[0],
      });
    }

    const existing = await pool.query(
      `SELECT id
       FROM nearby_place_categories
       WHERE id = $1`,
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    return res.status(409).json({
      success: false,
      message:
        'This category contains places. Move or delete those places before deleting the category.',
    });
  } catch (error: unknown) {
    console.error('Delete nearby category:', error);

    if (
      error !== null &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === '23503'
    ) {
      return res.status(409).json({
        success: false,
        message: 'Category is referenced by existing records',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to delete category',
    });
  }
};
