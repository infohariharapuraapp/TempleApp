
import { Request, Response } from 'express';
import { pool } from '../db';

// ========================================
// GET PUBLIC TEMPLE CONTACT DETAILS
// ========================================

export const getTempleContact = async (
  _req: Request,
  res: Response
) => {
  try {
    const result = await pool.query(
      `
      SELECT
        setting_key,
        setting_value
      FROM temple_contact_settings
      ORDER BY setting_key ASC
      `
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
    console.error(
      'Get temple contact error:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch temple contact details',
    });
  }
};
