
import { Request, Response } from 'express';
import { pool } from '../db';

// ========================================
// HELPERS
// ========================================

const validId = (value: unknown): number | null => {
  const id = Number(value);

  return Number.isSafeInteger(id) && id > 0
    ? id
    : null;
};

const handleError = (
  res: Response,
  error: unknown
) => {
  console.error('Pooja Services error:', error);

  return res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
};

// ========================================
// PUBLIC: GET ACTIVE SECTIONS
// ========================================

export const getPoojaSections = async (
  _req: Request,
  res: Response
) => {
  try {
    const result = await pool.query(`
      SELECT id, name, image_url, display_order
      FROM pooja_sections
      WHERE is_active = TRUE
      ORDER BY display_order ASC, id ASC
    `);

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// ========================================
// PUBLIC: GET ACTIVE POOJAS
// ========================================

export const getPoojas = async (
  req: Request,
  res: Response
) => {
  try {
    const sectionId = validId(req.query.section_id);

    if (!sectionId) {
      return res.status(400).json({
        success: false,
        message: 'Valid section_id is required',
      });
    }

    const result = await pool.query(
      `SELECT p.id, p.section_id, p.name,
              p.description, p.price, p.display_order
       FROM poojas p
       JOIN pooja_sections s ON s.id = p.section_id
       WHERE p.section_id = $1
         AND p.is_active = TRUE
         AND s.is_active = TRUE
       ORDER BY p.display_order ASC, p.id ASC`,
      [sectionId]
    );

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// ========================================
// ADMIN: GET ALL SECTIONS
// ========================================

export const getAdminPoojaSections = async (
  _req: Request,
  res: Response
) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM pooja_sections
      ORDER BY display_order ASC, id ASC
    `);

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// ========================================
// ADMIN: CREATE SECTION
// ========================================

export const createPoojaSection = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      name,
      image_url = null,
      display_order = 0,
    } = req.body;

    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Section name is required',
      });
    }

    const order = Number(display_order);

    if (!Number.isSafeInteger(order)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid display order',
      });
    }

    const result = await pool.query(
      `INSERT INTO pooja_sections
       (name, image_url, display_order)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [
        name.trim(),
        image_url || null,
        order,
      ]
    );

    return res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// ========================================
// ADMIN: UPDATE SECTION
// ========================================

export const updatePoojaSection = async (
  req: Request,
  res: Response
) => {
  try {
    const id = validId(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Invalid section ID',
      });
    }

    const {
      name,
      image_url,
      display_order,
      is_active,
    } = req.body;

    if (
      name !== undefined &&
      (typeof name !== 'string' || !name.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid section name',
      });
    }

    if (
      is_active !== undefined &&
      typeof is_active !== 'boolean'
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status',
      });
    }

    if (
      display_order !== undefined &&
      !Number.isSafeInteger(Number(display_order))
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid display order',
      });
    }

    const result = await pool.query(
      `UPDATE pooja_sections
       SET name = COALESCE($1, name),
           image_url = CASE
             WHEN $2::boolean THEN $3
             ELSE image_url
           END,
           display_order = COALESCE($4, display_order),
           is_active = COALESCE($5, is_active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING *`,
      [
        name?.trim() ?? null,
        image_url !== undefined,
        image_url ?? null,
        display_order === undefined
          ? null
          : Number(display_order),
        is_active ?? null,
        id,
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: 'Section not found',
      });
    }

    return res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// ========================================
// ADMIN: GET ALL POOJAS
// ========================================

export const getAdminPoojas = async (
  _req: Request,
  res: Response
) => {
  try {
    const result = await pool.query(`
      SELECT p.*, s.name AS section_name
      FROM poojas p
      JOIN pooja_sections s ON s.id = p.section_id
      ORDER BY s.display_order ASC,
               p.display_order ASC, p.id ASC
    `);

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// ========================================
// ADMIN: CREATE POOJA
// ========================================

export const createPooja = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      section_id,
      name,
      description = null,
      price,
      display_order = 0,
    } = req.body;

    const sectionId = validId(section_id);
    const amount = Number(price);
    const order = Number(display_order);

    if (
      !sectionId ||
      typeof name !== 'string' ||
      !name.trim() ||
      price === undefined ||
      price === null ||
      price === '' ||
      !Number.isFinite(amount) ||
      amount < 0 ||
      amount > 99999999.99 ||
      !Number.isSafeInteger(order)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid pooja details',
      });
    }

    const section = await pool.query(
      'SELECT id FROM pooja_sections WHERE id = $1',
      [sectionId]
    );

    if (!section.rows.length) {
      return res.status(404).json({
        success: false,
        message: 'Section not found',
      });
    }

    const result = await pool.query(
      `INSERT INTO poojas
       (section_id, name, description, price, display_order)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        sectionId,
        name.trim(),
        description || null,
        amount,
        order,
      ]
    );

    return res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// ========================================
// ADMIN: UPDATE POOJA
// ========================================

export const updatePooja = async (
  req: Request,
  res: Response
) => {
  try {
    const id = validId(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Invalid pooja ID',
      });
    }

    const {
      section_id,
      name,
      description,
      price,
      display_order,
      is_active,
    } = req.body;

    const sectionId =
      section_id === undefined
        ? null
        : validId(section_id);

    if (
      (section_id !== undefined && !sectionId) ||
      (name !== undefined &&
        (typeof name !== 'string' || !name.trim())) ||
      (is_active !== undefined &&
        typeof is_active !== 'boolean') ||
      (display_order !== undefined &&
        !Number.isSafeInteger(Number(display_order))) ||
      (price !== undefined &&
        (price === null ||
          price === '' ||
          !Number.isFinite(Number(price)) ||
          Number(price) < 0 ||
          Number(price) > 99999999.99))
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid pooja details',
      });
    }

    if (sectionId) {
      const section = await pool.query(
        'SELECT id FROM pooja_sections WHERE id = $1',
        [sectionId]
      );

      if (!section.rows.length) {
        return res.status(404).json({
          success: false,
          message: 'Section not found',
        });
      }
    }

    const result = await pool.query(
      `UPDATE poojas
       SET section_id = COALESCE($1, section_id),
           name = COALESCE($2, name),
           description = CASE
             WHEN $3::boolean THEN $4
             ELSE description
           END,
           price = COALESCE($5, price),
           display_order = COALESCE($6, display_order),
           is_active = COALESCE($7, is_active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING *`,
      [
        sectionId,
        name?.trim() ?? null,
        description !== undefined,
        description ?? null,
        price === undefined ? null : Number(price),
        display_order === undefined
          ? null
          : Number(display_order),
        is_active ?? null,
        id,
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: 'Pooja not found',
      });
    }

    return res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    return handleError(res, error);
  }
};
