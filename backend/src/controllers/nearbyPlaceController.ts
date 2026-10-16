
import { Request, Response } from 'express';
import { pool } from '../db';

const isValidId = (value: unknown): boolean =>
  typeof value === 'string' &&
  /^[1-9]\d*$/.test(value);

const isValidMapsUrl = (value: string): boolean => {
  try {
    const url = new URL(value);

    const host = url.hostname.toLowerCase();

    return (
      url.protocol === 'https:' &&
      (
        host === 'maps.google.com' ||
        host === 'www.google.com' ||
        host === 'google.com' ||
        host === 'maps.app.goo.gl' ||
        host === 'goo.gl'
      )
    );
  } catch {
    return false;
  }
};

// ========================================
// PUBLIC - ACTIVE PLACES
// ========================================

export const getNearbyPlaces = async (
  req: Request,
  res: Response
) => {
  try {
    const categoryId = req.query.category_id;

    if (
      categoryId !== undefined &&
      !isValidId(categoryId)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID',
      });
    }

    const result = await pool.query(
      `SELECT
         p.id,
         p.category_id,
         c.name AS category_name,
         p.name,
         p.description,
         p.address,
         p.phone,
         p.google_maps_url,
         p.image_url,
         p.display_order
       FROM nearby_places p
       JOIN nearby_place_categories c
         ON c.id = p.category_id
       WHERE p.is_active = TRUE
         AND c.is_active = TRUE
         AND ($1::integer IS NULL
              OR p.category_id = $1::integer)
       ORDER BY p.display_order ASC, p.id ASC`,
      [categoryId ?? null]
    );

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get nearby places:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch nearby places',
    });
  }
};

// ========================================
// ADMIN - ALL PLACES
// ========================================

export const getAdminNearbyPlaces = async (
  _req: Request,
  res: Response
) => {
  try {
    const result = await pool.query(
      `SELECT
         p.*,
         c.name AS category_name
       FROM nearby_places p
       JOIN nearby_place_categories c
         ON c.id = p.category_id
       ORDER BY p.display_order ASC, p.id ASC`
    );

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Admin nearby places:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch places',
    });
  }
};

// ========================================
// ADMIN - CREATE PLACE
// ========================================

export const createNearbyPlace = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      category_id,
      name,
      description,
      address,
      phone,
      google_maps_url,
      image_url,
      display_order,
      is_active,
    } = req.body;

    if (
      !Number.isSafeInteger(category_id) ||
      category_id <= 0 ||
      typeof name !== 'string' ||
      !name.trim() ||
      name.trim().length > 200
    ) {
      return res.status(400).json({
        success: false,
        message: 'Valid category ID and place name required',
      });
    }

    if (
      google_maps_url &&
      (
        typeof google_maps_url !== 'string' ||
        !isValidMapsUrl(google_maps_url)
      )
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Google Maps URL',
      });
    }

    const category = await pool.query(
      `SELECT id
       FROM nearby_place_categories
       WHERE id = $1`,
      [category_id]
    );

    if (category.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Category does not exist',
      });
    }

    const result = await pool.query(
      `INSERT INTO nearby_places
       (
         category_id,
         name,
         description,
         address,
         phone,
         google_maps_url,
         image_url,
         display_order,
         is_active
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        category_id,
        name.trim(),
        description ?? null,
        address ?? null,
        phone ?? null,
        google_maps_url || null,
        image_url || null,
        display_order ?? 0,
        is_active ?? true,
      ]
    );

    return res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Create nearby place:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to create nearby place',
    });
  }
};

// ========================================
// ADMIN - UPDATE PLACE
// ========================================

export const updateNearbyPlace = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid place ID',
      });
    }

    const {
      category_id,
      name,
      description,
      address,
      phone,
      google_maps_url,
      image_url,
      display_order,
      is_active,
    } = req.body;

    if (
      category_id !== undefined &&
      (
        !Number.isSafeInteger(category_id) ||
        category_id <= 0
      )
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID',
      });
    }

    if (
      name !== undefined &&
      (
        typeof name !== 'string' ||
        !name.trim() ||
        name.trim().length > 200
      )
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid place name',
      });
    }

    if (
      google_maps_url &&
      (
        typeof google_maps_url !== 'string' ||
        !isValidMapsUrl(google_maps_url)
      )
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Google Maps URL',
      });
    }

    if (category_id !== undefined) {
      const category = await pool.query(
        `SELECT id
         FROM nearby_place_categories
         WHERE id = $1`,
        [category_id]
      );

      if (category.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Category does not exist',
        });
      }
    }

    const result = await pool.query(
      `UPDATE nearby_places
       SET category_id = COALESCE($1, category_id),
           name = COALESCE($2, name),
           description = COALESCE($3, description),
           address = COALESCE($4, address),
           phone = COALESCE($5, phone),
           google_maps_url = COALESCE($6, google_maps_url),
           image_url = COALESCE($7, image_url),
           display_order = COALESCE($8, display_order),
           is_active = COALESCE($9, is_active),
           updated_at = NOW()
       WHERE id = $10
       RETURNING *`,
      [
        category_id ?? null,
        name?.trim() ?? null,
        description ?? null,
        address ?? null,
        phone ?? null,
        google_maps_url ?? null,
        image_url ?? null,
        display_order ?? null,
        is_active ?? null,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Place not found',
      });
    }

    return res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Update nearby place:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to update nearby place',
    });
  }
};
