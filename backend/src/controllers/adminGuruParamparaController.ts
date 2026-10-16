import { Request, Response } from 'express';
import { pool } from '../db';

// ========================================
// SHARED HELPERS
// ========================================

const GURU_FIELDS = `
  id,
  name,
  title,
  image_url,
  verse,
  transliteration,
  translation,
  display_order,
  is_active,
  created_at,
  updated_at
`;

const validId = (value: string): number | null => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0
    ? id
    : null;
};

const validText = (value: unknown): boolean =>
  typeof value === 'string';

const optionalText = (value: unknown): boolean =>
  value === null || validText(value);

// ========================================
// GET ALL GURUS (ADMIN)
// ========================================

export const getAdminGurus = async (
  _req: Request,
  res: Response
) => {
  try {
    const result = await pool.query(`
      SELECT ${GURU_FIELDS}
      FROM guru_parampara
      ORDER BY display_order ASC, id ASC
    `);

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get admin gurus error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch gurus',
    });
  }
};

// ========================================
// CREATE GURU
// ========================================

export const createGuru = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      name,
      title = null,
      image_url = null,
      verse = null,
      transliteration = null,
      translation = null,
      display_order = 0,
      is_active = true,
    } = req.body ?? {};

    if (
      !validText(name) ||
      !name.trim() ||
      name.trim().length > 255 ||
      !optionalText(title) ||
      (typeof title === 'string' && title.length > 150) ||
      !optionalText(image_url) ||
      !optionalText(verse) ||
      !optionalText(transliteration) ||
      !optionalText(translation) ||
      !Number.isSafeInteger(display_order) ||
      typeof is_active !== 'boolean'
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Guru Parampara fields',
      });
    }

    const result = await pool.query(
      `
      INSERT INTO guru_parampara (
        name,
        title,
        image_url,
        verse,
        transliteration,
        translation,
        display_order,
        is_active
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING ${GURU_FIELDS}
      `,
      [
        name.trim(),
        title,
        image_url,
        verse,
        transliteration,
        translation,
        display_order,
        is_active,
      ]
    );

    return res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Create guru error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to create guru',
    });
  }
};

// ========================================
// UPDATE GURU
// ========================================

export const updateGuru = async (
  req: Request,
  res: Response
) => {
  try {
    const id = validId(String(req.params.id));

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Invalid guru ID',
      });
    }

    const allowedFields = [
      'name',
      'title',
      'image_url',
      'verse',
      'transliteration',
      'translation',
      'display_order',
      'is_active',
    ];

    const body = req.body ?? {};
    const fields = Object.keys(body);

    if (
      fields.length === 0 ||
      fields.some((field) => !allowedFields.includes(field))
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid update fields',
      });
    }

    if (
      ('name' in body &&
        (!validText(body.name) ||
          !body.name.trim() ||
          body.name.trim().length > 255)) ||
      ('title' in body &&
        (!optionalText(body.title) ||
          (typeof body.title === 'string' &&
            body.title.length > 150))) ||
      ['image_url', 'verse', 'transliteration', 'translation']
        .some(
          (field) =>
            field in body &&
            !optionalText(body[field])
        ) ||
      ('display_order' in body &&
        !Number.isSafeInteger(body.display_order)) ||
      ('is_active' in body &&
        typeof body.is_active !== 'boolean')
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Guru Parampara fields',
      });
    }

    const values = fields.map((field) =>
      field === 'name' ? body[field].trim() : body[field]
    );

    const assignments = fields.map(
      (field, index) => `${field} = $${index + 1}`
    );

    values.push(id);

    const result = await pool.query(
      `
      UPDATE guru_parampara
      SET
        ${assignments.join(', ')},
        updated_at = NOW()
      WHERE id = $${values.length}
      RETURNING ${GURU_FIELDS}
      `,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Guru not found',
      });
    }

    return res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Update guru error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to update guru',
    });
  }
};

// ========================================
// UPDATE GURU STATUS
// ========================================

export const updateGuruStatus = async (
  req: Request,
  res: Response
) => {
  try {
    const id = validId(String(req.params.id));
    const { is_active } = req.body ?? {};

    if (!id || typeof is_active !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Invalid guru ID or status',
      });
    }

    const result = await pool.query(
      `
      UPDATE guru_parampara
      SET is_active = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING ${GURU_FIELDS}
      `,
      [is_active, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Guru not found',
      });
    }

    return res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Update guru status error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to update guru status',
    });
  }
};

// ========================================
// DELETE GURU
// ========================================

export const deleteGuru = async (
  req: Request,
  res: Response
) => {
  try {
    const id = validId(String(req.params.id));

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Invalid guru ID',
      });
    }

    const result = await pool.query(
      `
      DELETE FROM guru_parampara
      WHERE id = $1
      RETURNING id
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Guru not found',
      });
    }

    return res.json({
      success: true,
      message: 'Guru deleted successfully',
    });
  } catch (error) {
    console.error('Delete guru error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to delete guru',
    });
  }
};