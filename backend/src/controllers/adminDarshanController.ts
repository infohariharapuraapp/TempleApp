
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
        'www.youtube-nocookie.com',
        'youtube-nocookie.com',
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
// GET TODAY'S DARSHAN
// GET /api/admin/darshan/today
// ========================================

export const getAdminTodayDarshan = async (
  _req: AuthRequest,
  res: Response
) => {
  try {
    const result = await pool.query<TodayDarshan>(
      `
      SELECT *
      FROM today_darshan_videos
      WHERE darshan_date =
        (NOW() AT TIME ZONE 'Asia/Kolkata')::date
      LIMIT 1
      `
    );

    return res.json({
      success: true,
      data: result.rows[0] ?? null,
    });
  } catch (error) {
    console.error(
      'Get today darshan error:',
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch today's Darshan",
    });
  }
};

// ========================================
// PUBLISH OR REPLACE TODAY'S DARSHAN
// POST /api/admin/darshan/today/publish
// ========================================

export const publishTodayDarshan = async (
  req: AuthRequest,
  res: Response
) => {
  const { name, youtube_url } = req.body || {};

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

  let client;

  try {
    client = await pool.connect();
  } catch (error) {
    console.error('Database connection error:', error);

    return res.status(500).json({
      success: false,
      message: 'Database connection failed.',
    });
  }

  let darshan: TodayDarshan | null = null;
  let notificationId: number | null = null;
  let replaced = false;
  let unchanged = false;

  try {
    await client.query('BEGIN');

    // Serialize publishing requests.
    await client.query(
      'SELECT pg_advisory_xact_lock($1)',
      [20261013]
    );

    const existingResult =
      await client.query<TodayDarshan>(
        `
        SELECT *
        FROM today_darshan_videos
        WHERE darshan_date =
          (NOW() AT TIME ZONE 'Asia/Kolkata')::date
        FOR UPDATE
        `
      );

    const existing =
      existingResult.rows[0] ?? null;

    if (
      existing &&
      existing.name === cleanName &&
      existing.youtube_video_id === videoId
    ) {
      unchanged = true;
      darshan = existing;
    } else {
      replaced = existing !== null;

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
          ON CONFLICT (darshan_date)
          DO UPDATE SET
            name = EXCLUDED.name,
            youtube_url = EXCLUDED.youtube_url,
            youtube_video_id =
              EXCLUDED.youtube_video_id,
            published_at = NOW(),
            updated_at = NOW(),
            notification_id = NULL
          RETURNING *
          `,
          [
            cleanName,
            canonicalUrl,
            videoId,
          ]
        );

      darshan = saveResult.rows[0];

      // Create notification in the same
      // transaction as the Darshan update.
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
            replaced
              ? "🛕 Today's Darshan Updated"
              : "🛕 Today's Darshan",
            replaced
              ? `${cleanName} has been updated. Tap to watch.`
              : `${cleanName} is now available. Tap to watch.`,
            JSON.stringify({
              type: 'today_darshan',
              screen: '/darshan',
              darshanId: darshan.id,
            }),
          ]
        );

      notificationId =
        notificationResult.rows[0].id;

      const updateResult =
        await client.query<TodayDarshan>(
          `
          UPDATE today_darshan_videos
          SET notification_id = $1
          WHERE id = $2
          RETURNING *
          `,
          [notificationId, darshan.id]
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

  // Send after successful DB commit.
  // A push failure does not undo publication.
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

  return res.status(
    unchanged || replaced ? 200 : 201
  ).json({
    success: true,
    message: unchanged
      ? 'This Darshan is already published.'
      : replaced
        ? "Today's Darshan updated successfully."
        : "Today's Darshan published successfully.",
    data: darshan,
    unchanged,
    replaced,
    notification: {
      id: notificationId,
      result: pushResult,
    },
  });
};
