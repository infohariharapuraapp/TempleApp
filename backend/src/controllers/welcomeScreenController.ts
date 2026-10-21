
import { Request, Response } from 'express';
import { pool } from '../db';

// ========================================
// PUBLIC — GET WELCOME SCREEN
// ========================================

export const getWelcomeScreen = async (
  _req: Request,
  res: Response
) => {
  try {
    const result = await pool.query(
      `SELECT title, image_url, is_enabled, display_duration
       FROM welcome_screen_settings
       WHERE id = 1`
    );

    const settings = result.rows[0];

    return res.json({
      success: true,
      data:
        settings?.is_enabled && settings?.image_url
          ? settings
          : null,
    });
  } catch (error) {
    console.error('Get welcome screen:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to load welcome screen',
    });
  }
};

// ========================================
// ADMIN — GET SETTINGS
// ========================================

export const getAdminWelcomeScreen = async (
  _req: Request,
  res: Response
) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM welcome_screen_settings
       WHERE id = 1`
    );

    return res.json({
      success: true,
      data: result.rows[0] ?? null,
    });
  } catch (error) {
    console.error('Get admin welcome settings:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to load welcome settings',
    });
  }
};

// ========================================
// ADMIN — UPDATE SETTINGS
// ========================================

export const updateWelcomeScreen = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      title,
      image_url,
      is_enabled,
      display_duration,
    } = req.body;

    if (
      typeof title !== 'string' ||
      title.trim().length > 200 ||
      typeof is_enabled !== 'boolean' ||
      !Number.isInteger(display_duration) ||
      display_duration < 2 ||
      display_duration > 10
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid welcome screen settings',
      });
    }

    // Only accept HTTPS Cloudinary image URLs.
    // This prevents arbitrary remote image URLs.
    if (
      image_url !== null &&
      image_url !== '' &&
      (
        typeof image_url !== 'string' ||
        !/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(
          image_url
        )
      )
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Cloudinary image URL',
      });
    }

    const result = await pool.query(
      `UPDATE welcome_screen_settings
       SET title = $1,
           image_url = $2,
           is_enabled = $3,
           display_duration = $4,
           updated_at = NOW()
       WHERE id = 1
       RETURNING *`,
      [
        title.trim(),
        image_url || null,
        is_enabled,
        display_duration,
      ]
    );

    return res.json({
      success: true,
      message: 'Welcome settings updated',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Update welcome settings:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to update welcome settings',
    });
  }
};
