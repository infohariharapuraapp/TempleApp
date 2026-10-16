import { Request, Response } from 'express';
import { pool } from '../db';

// ========================================
// PUBLIC - GET ALL ACTIVE GURU VANI
// Latest published first
// ========================================

export const getGuruVani = async (
  _req: Request,
  res: Response
) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM guru_vani
       WHERE is_active = TRUE
       ORDER BY published_at DESC, id DESC`
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get Guru Vani error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to fetch Guru Vani',
    });
  }
};

// ========================================
// PUBLIC - GET LATEST GURU VANI
// ========================================

export const getLatestGuruVani = async (
  _req: Request,
  res: Response
) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM guru_vani
       WHERE is_active = TRUE
       ORDER BY published_at DESC, id DESC
       LIMIT 1`
    );

    res.json({
      success: true,
      data: result.rows[0] || null,
    });
  } catch (error) {
    console.error('Get latest Guru Vani error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to fetch latest Guru Vani',
    });
  }
};

// ========================================
// PUBLIC - GET GURU VANI BY ID
// ========================================

export const getGuruVaniById = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT *
       FROM guru_vani
       WHERE id = $1 AND is_active = TRUE`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Guru Vani not found',
      });
      return;
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Get Guru Vani by ID error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to fetch Guru Vani',
    });
  }
};

// ========================================
// ADMIN - GET ALL GURU VANI
// ========================================

export const getAdminGuruVani = async (
  _req: Request,
  res: Response
) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM guru_vani
       ORDER BY published_at DESC, id DESC`
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Admin Guru Vani error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to fetch Guru Vani',
    });
  }
};

// ========================================
// ADMIN - CREATE GURU VANI
// ========================================

export const createGuruVani = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      title,
      sloka,
      transliteration,
      meaning,
      guru_name,
      is_active = true,
    } = req.body;

    if (
      typeof title !== 'string' ||
      !title.trim() ||
      typeof sloka !== 'string' ||
      !sloka.trim()
    ) {
      res.status(400).json({
        success: false,
        message: 'Title and sloka are required',
      });
      return;
    }

    const optionalText = [
      transliteration,
      meaning,
      guru_name,
    ];

    if (
      optionalText.some(
        (value) =>
          value != null &&
          typeof value !== 'string'
      ) ||
      typeof is_active !== 'boolean'
    ) {
      res.status(400).json({
        success: false,
        message: 'Invalid Guru Vani fields',
      });
      return;
    }

    const result = await pool.query(
      `INSERT INTO guru_vani
       (
         title,
         sloka,
         transliteration,
         meaning,
         guru_name,
         is_active
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        title.trim(),
        sloka.trim(),
        transliteration?.trim() || null,
        meaning?.trim() || null,
        guru_name?.trim() || null,
        is_active,
      ]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Create Guru Vani error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to create Guru Vani',
    });
  }
};

// ========================================
// ADMIN - UPDATE GURU VANI
// ========================================

export const updateGuruVani = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;
    const {
      title,
      sloka,
      transliteration,
      meaning,
      guru_name,
    } = req.body;

    if (
      typeof title !== 'string' ||
      !title.trim() ||
      typeof sloka !== 'string' ||
      !sloka.trim() ||
      [transliteration, meaning, guru_name].some(
        (value) =>
          value != null &&
          typeof value !== 'string'
      )
    ) {
      res.status(400).json({
        success: false,
        message: 'Invalid Guru Vani fields',
      });
      return;
    }

    const result = await pool.query(
      `UPDATE guru_vani
       SET title = $1,
           sloka = $2,
           transliteration = $3,
           meaning = $4,
           guru_name = $5,
           updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [
        title.trim(),
        sloka.trim(),
        transliteration?.trim() || null,
        meaning?.trim() || null,
        guru_name?.trim() || null,
        id,
      ]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Guru Vani not found',
      });
      return;
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Update Guru Vani error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to update Guru Vani',
    });
  }
};

// ========================================
// ADMIN - UPDATE ACTIVE STATUS
// ========================================

export const updateGuruVaniStatus = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    if (typeof is_active !== 'boolean') {
      res.status(400).json({
        success: false,
        message: 'is_active must be a boolean',
      });
      return;
    }

    const result = await pool.query(
      `UPDATE guru_vani
       SET is_active = $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [is_active, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Guru Vani not found',
      });
      return;
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Update Guru Vani status error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to update Guru Vani status',
    });
  }
};