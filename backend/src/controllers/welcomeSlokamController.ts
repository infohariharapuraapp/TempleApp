
import { Request, Response } from 'express';
import { pool } from '../db';

// ========================================
// PUBLIC - GET ACTIVE WELCOME SLOKAM
// ========================================

export const getActiveWelcomeSlokam = async (
  _req: Request,
  res: Response
) => {
  try {
    const result = await pool.query(
      `SELECT id, title, audio_url, updated_at
       FROM welcome_slokams
       WHERE is_active = TRUE
       LIMIT 1`
    );

    res.json({
      success: true,
      data: result.rows[0] ?? null,
    });
  } catch (error) {
    console.error('Get active welcome slokam:', error);

    res.status(500).json({
      success: false,
      message: 'Unable to load welcome slokam',
    });
  }
};

// ========================================
// ADMIN - GET ALL SLOKAMS
// ========================================

export const getAdminWelcomeSlokams = async (
  _req: Request,
  res: Response
) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM welcome_slokams
       ORDER BY is_active DESC, created_at DESC, id DESC`
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get welcome slokam library:', error);

    res.status(500).json({
      success: false,
      message: 'Unable to load slokam library',
    });
  }
};

// ========================================
// ADMIN - CREATE SLOKAM
// ========================================

export const createWelcomeSlokam = async (
  req: Request,
  res: Response
) => {
  try {
    const title = String(req.body.title ?? '').trim();
    const audioUrl = String(req.body.audio_url ?? '').trim();

    if (!title || !audioUrl) {
      return res.status(400).json({
        success: false,
        message: 'Title and audio URL are required',
      });
    }

    if (title.length > 255 || !isValidAudioUrl(audioUrl)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid title or audio URL. Use an HTTPS URL.',
      });
    }

    const result = await pool.query(
      `INSERT INTO welcome_slokams (title, audio_url)
       VALUES ($1, $2)
       RETURNING *`,
      [title, audioUrl]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Create welcome slokam:', error);

    res.status(500).json({
      success: false,
      message: 'Unable to create welcome slokam',
    });
  }
};

// ========================================
// ADMIN - UPDATE SLOKAM
// ========================================

export const updateWelcomeSlokam = async (
  req: Request,
  res: Response
) => {
  try {
    const id = parseId(req.params.id);
    const title = String(req.body.title ?? '').trim();
    const audioUrl = String(req.body.audio_url ?? '').trim();

    if (!id || !title || title.length > 255 ||
        !isValidAudioUrl(audioUrl)) {
      return res.status(400).json({
        success: false,
        message: 'Valid ID, title and HTTPS audio URL required',
      });
    }

    const result = await pool.query(
      `UPDATE welcome_slokams
       SET title = $1,
           audio_url = $2,
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [title, audioUrl, id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: 'Slokam not found',
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Update welcome slokam:', error);

    res.status(500).json({
      success: false,
      message: 'Unable to update welcome slokam',
    });
  }
};

// ========================================
// ADMIN - ACTIVATE ONE SLOKAM
// ========================================

export const activateWelcomeSlokam = async (
  req: Request,
  res: Response
) => {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({
      success: false,
      message: 'Invalid slokam ID',
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Serialize concurrent activation requests.
    await client.query(
      'SELECT pg_advisory_xact_lock($1)',
      [8132401]
    );

    const target = await client.query(
      'SELECT id FROM welcome_slokams WHERE id = $1',
      [id]
    );

    if (!target.rows.length) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        success: false,
        message: 'Slokam not found',
      });
    }

    await client.query(
      `UPDATE welcome_slokams
       SET is_active = FALSE,
           updated_at = NOW()
       WHERE is_active = TRUE`
    );

    const result = await client.query(
      `UPDATE welcome_slokams
       SET is_active = TRUE,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Welcome slokam activated',
      data: result.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');

    console.error('Activate welcome slokam:', error);

    res.status(500).json({
      success: false,
      message: 'Unable to activate welcome slokam',
    });
  } finally {
    client.release();
  }
};

// ========================================
// ADMIN - DELETE SLOKAM
// ========================================

export const deleteWelcomeSlokam = async (
  req: Request,
  res: Response
) => {
  try {
    const id = parseId(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Invalid slokam ID',
      });
    }

    const result = await pool.query(
      `DELETE FROM welcome_slokams
       WHERE id = $1
       RETURNING id`,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: 'Slokam not found',
      });
    }

    res.json({
      success: true,
      message: 'Slokam deleted',
    });
  } catch (error) {
    console.error('Delete welcome slokam:', error);

    res.status(500).json({
      success: false,
      message: 'Unable to delete welcome slokam',
    });
  }
};

// ========================================
// HELPERS
// ========================================

function parseId(value: unknown): number | null {
  const id = Number(value);

  return Number.isSafeInteger(id) && id > 0
    ? id
    : null;
}

function isValidAudioUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return (
      url.protocol === 'https:' &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
