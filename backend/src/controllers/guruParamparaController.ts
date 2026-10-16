import { Request, Response } from 'express';
import { pool } from '../db';

// ========================================
// GURU PARAMPARA FIELDS
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
  is_active
`;

// ========================================
// GET ACTIVE GURUS
// GET /api/guru-parampara
// ========================================

export const getGurus = async (
  _req: Request,
  res: Response
) => {
  try {
    const result = await pool.query(
      `
      SELECT
        ${GURU_FIELDS}
      FROM guru_parampara
      WHERE is_active = TRUE
      ORDER BY
        display_order ASC,
        id ASC
      `
    );

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error(
      'Error fetching Guru Parampara:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch Guru Parampara',
    });
  }
};