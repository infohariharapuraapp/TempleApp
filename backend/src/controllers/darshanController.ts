
import { Request, Response } from 'express';
import { pool } from '../db';

// ========================================
// GET TODAY'S DARSHAN VIDEOS
// GET /api/darshan/today
// ========================================

export const getTodayDarshan = async (
  _req: Request,
  res: Response
) => {
  try {
    const result = await pool.query(
      `
      SELECT
        id,
        name,
        youtube_url,
        youtube_video_id,
        darshan_date,
        published_at,
        updated_at
      FROM today_darshan_videos
      WHERE darshan_date =
        (NOW() AT TIME ZONE 'Asia/Kolkata')::date
      ORDER BY published_at DESC, id DESC
      `
    );

    return res.status(200).json({
      success: true,
      data: result.rows,
    });

  } catch (error) {
    console.error(
      'Get today darshan error:',
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch today's Darshan.",
    });
  }
};
