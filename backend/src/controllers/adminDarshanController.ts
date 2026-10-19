
import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { pool } from '../db';
import { sendNotificationRecord } from '../services/notificationService';

// ========================================
// TYPES
// ========================================

type TodayDarshan = {
  id: number;
  name: string;
  youtube_url: string;
  youtube_video_id: string;
  darshan_date: string;
  published_at: Date;
  updated_at: Date;
  notification_id: number | null;
};

// ========================================
// YOUTUBE URL VALIDATION
// ========================================

function extractYouTubeVideoId(
  input: string
): string | null {
  try {
    const url = new URL(input.trim());
    const host = url.hostname.toLowerCase();

    if (url.protocol !== 'https:') {
      return null;
    }

    let videoId: string | null = null;

    if (
      host === 'youtu.be' ||
      host === 'www.youtu.be'
    ) {
      videoId = url.pathname.split('/')[1] || null;
    } else if (
      [
        'youtube.com',
        'www.youtube.com',
        'm.youtube.com',
        'music.youtube.com',
        'youtube-nocookie.com',
        'www.youtube-nocookie.com',
      ].includes(host)
    ) {
      if (url.pathname === '/watch') {
        videoId = url.searchParams.get('v');
      } else {
        const parts = url.pathname
          .split('/')
          .filter(Boolean);

        if (
          ['live', 'shorts', 'embed'].includes(
            parts[0]
          )
        ) {
          videoId = parts[1] || null;
        }
      }
    }

    return videoId &&
      /^[A-Za-z0-9_-]{11}$/.test(videoId)
      ? videoId
      : null;
  } catch {
    return null;
  }
}

// ========================================
// GET TODAY'S DARSHAN VIDEOS
// GET /api/admin/darshan/today
// ========================================

export const getAdminTodayDarshan = async (
  _req: AuthRequest,
  res: Response
) => {
  try {
    const result = await pool.query<TodayDarshan>(
      `
      SELECT
        id,
        name,
        youtube_url,
        youtube_video_id,
        darshan_date,
        published_at,
        updated_at,
        notification_id
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
      'Get admin today darshan error:',
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch today's Darshan.",
    });
  }
};

// ========================================
// PUBLISH NEW TODAY'S DARSHAN VIDEO
// POST /api/admin/darshan/today/publish
// ========================================

export const publishTodayDarshan = async (
  req: AuthRequest,
  res: Response
) => {
  const { name, youtube_url } = req.body || {};

  // ----------------------------------------
  // VALIDATE NAME
  // ----------------------------------------

  if (
    typeof name !== 'string' ||
    !name.trim() ||
    name.trim().length > 200
  ) {
    return res.status(400).json({
      success: false,
      message: 'Enter a valid Darshan name.',
    });
  }

  // ----------------------------------------
  // VALIDATE YOUTUBE URL
  // ----------------------------------------

  if (
    typeof youtube_url !== 'string' ||
    youtube_url.length > 2048
  ) {
    return res.status(400).json({
      success: false,
      message: 'Enter a valid YouTube URL.',
    });
  }

  const videoId = extractYouTubeVideoId(
    youtube_url
  );

  if (!videoId) {
    return res.status(400).json({
      success: false,
      message: 'Invalid YouTube video URL.',
    });
  }

  const cleanName = name.trim();

  const canonicalUrl =
    `https://www.youtube.com/watch?v=${videoId}`;

  // ----------------------------------------
  // DATABASE CONNECTION
  // ----------------------------------------

  let client;

  try {
    client = await pool.connect();
  } catch (error) {
    console.error(
      'Database connection error:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Database connection failed.',
    });
  }

  let darshan: TodayDarshan | null = null;
  let notificationId: number | null = null;
  let unchanged = false;

  try {
    await client.query('BEGIN');

    // Prevent simultaneous publishing requests
    // from inserting the same video twice.
    await client.query(
      'SELECT pg_advisory_xact_lock($1)',
      [20261013]
    );

    // ----------------------------------------
    // CHECK IF SAME VIDEO ALREADY EXISTS TODAY
    // ----------------------------------------

    const existingResult =
      await client.query<TodayDarshan>(
        `
        SELECT *
        FROM today_darshan_videos
        WHERE darshan_date =
          (NOW() AT TIME ZONE 'Asia/Kolkata')::date
          AND youtube_video_id = $1
        ORDER BY id DESC
        LIMIT 1
        `,
        [videoId]
      );

    const existing =
      existingResult.rows[0] ?? null;

    if (existing) {
      // Prevent duplicate video publications.
      unchanged = true;
      darshan = existing;
    } else {

      // ----------------------------------------
      // INSERT NEW DARSHAN VIDEO
      // ----------------------------------------

      const saveResult =
        await client.query<TodayDarshan>(
          `
          INSERT INTO today_darshan_videos (
            name,
            youtube_url,
            youtube_video_id,
            darshan_date,
            published_at,
            updated_at
          )
          VALUES (
            $1,
            $2,
            $3,
            (NOW() AT TIME ZONE 'Asia/Kolkata')::date,
            NOW(),
            NOW()
          )
          RETURNING *
          `,
          [
            cleanName,
            canonicalUrl,
            videoId,
          ]
        );

      darshan = saveResult.rows[0];

      // ----------------------------------------
      // CREATE PUSH NOTIFICATION
      // ----------------------------------------

      const notificationResult =
        await client.query<{ id: number }>(
          `
          INSERT INTO notifications (
            title,
            body,
            notification_type,
            data,
            target_type,
            status
          )
          VALUES (
            $1,
            $2,
            'today_darshan',
            $3::jsonb,
            'all',
            'pending'
          )
          RETURNING id
          `,
          [
            "🛕 New Today's Darshan",
            `${cleanName} is now available. Tap to watch.`,
            JSON.stringify({
              type: 'today_darshan',
              screen: '/darshan',
              darshanId: darshan.id,
            }),
          ]
        );

      notificationId =
        notificationResult.rows[0].id;

      // ----------------------------------------
      // LINK NOTIFICATION TO DARSHAN
      // ----------------------------------------

      const updateResult =
        await client.query<TodayDarshan>(
          `
          UPDATE today_darshan_videos
          SET notification_id = $1
          WHERE id = $2
          RETURNING *
          `,
          [
            notificationId,
            darshan.id,
          ]
        );

      darshan = updateResult.rows[0];
    }

    await client.query('COMMIT');

  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error(
        'Darshan rollback error:',
        rollbackError
      );
    }

    console.error(
      'Publish Darshan error:',
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to publish today's Darshan.",
    });
  } finally {
    client.release();
  }

  // ========================================
  // SEND PUSH NOTIFICATION
  // ========================================

  let pushResult: unknown = null;

  if (notificationId !== null) {
    try {
      pushResult = await sendNotificationRecord(
        notificationId
      );
    } catch (error) {
      console.error(
        'Darshan push notification error:',
        error
      );
    }
  }

  // ========================================
  // RESPONSE
  // ========================================

  return res.status(
    unchanged ? 200 : 201
  ).json({
    success: true,
    message: unchanged
      ? 'This video is already published today.'
      : 'New Darshan video published successfully.',
    data: darshan,
    unchanged,
    replaced: false,
    notification: {
      id: notificationId,
      result: pushResult,
    },
  });
};
