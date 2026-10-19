
import { Request, Response } from 'express';
import { pool } from '../db';

// ========================================
// ALLOWED CONTACT SETTINGS
// ========================================

const ALLOWED_KEYS = [
  'main_phone',
  'guest_house_phone',
  'bangalore_phone',
  'email',
  'temple_name',
  'temple_address',
  'bangalore_address',
  'google_maps_url',
] as const;

// ========================================
// GET ADMIN CONTACT SETTINGS
// ========================================

export const getAdminTempleContact = async (
  _req: Request,
  res: Response
) => {
  try {
    const result = await pool.query(
      `SELECT setting_key, setting_value
       FROM temple_contact_settings
       ORDER BY setting_key ASC`
    );

    const settings: Record<string, string> = {};

    for (const row of result.rows) {
      settings[row.setting_key] = row.setting_value;
    }

    return res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error('Admin contact fetch error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch contact settings',
    });
  }
};

// ========================================
// UPDATE ADMIN CONTACT SETTINGS
// ========================================

export const updateAdminTempleContact = async (
  req: Request,
  res: Response
) => {
  try {
    const body = req.body;

    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request body',
      });
    }

    const keys = Object.keys(body);

    if (
      keys.length === 0 ||
      keys.some(
        (key) =>
          !ALLOWED_KEYS.includes(
            key as (typeof ALLOWED_KEYS)[number]
          )
      )
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid contact setting keys',
      });
    }

    for (const key of keys) {
      const value = body[key];

      if (
        typeof value !== 'string' ||
        !value.trim() ||
        value.length > 2000
      ) {
        return res.status(400).json({
          success: false,
          message: `Invalid value for ${key}`,
        });
      }
    }

    if (
      body.email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        body.email.trim()
      )
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email address',
      });
    }

    if (body.google_maps_url) {
      try {
        const url = new URL(
          body.google_maps_url.trim()
        );

        if (
          url.protocol !== 'https:' ||
          ![
            'google.com',
            'www.google.com',
            'maps.google.com',
            'maps.app.goo.gl',
          ].includes(url.hostname.toLowerCase())
        ) {
          throw new Error('Invalid Google Maps URL');
        }
      } catch {
        return res.status(400).json({
          success: false,
          message: 'Invalid Google Maps URL',
        });
      }
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      for (const key of keys) {
        await client.query(
          `INSERT INTO temple_contact_settings
             (setting_key, setting_value, updated_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (setting_key)
           DO UPDATE SET
             setting_value = EXCLUDED.setting_value,
             updated_at = NOW()`,
          [key, body[key].trim()]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return res.json({
      success: true,
      message: 'Temple contact settings updated',
    });
  } catch (error) {
    console.error('Admin contact update error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to update contact settings',
    });
  }
};
