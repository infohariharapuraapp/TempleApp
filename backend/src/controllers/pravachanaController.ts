
import { Request, Response } from 'express';
import { pool } from '../db';

type PravachanaInput = {
  title?: unknown;
  description?: unknown;
  youtube_url?: unknown;
  language?: unknown;
  is_published?: unknown;
};

const extractYouTubeVideoId = (input: string): string | null => {
  try {
    const url = new URL(input.trim());
    const host = url.hostname.toLowerCase().replace(/^www\./, '');

    let videoId: string | null = null;

    if (host === 'youtu.be') {
      videoId = url.pathname.split('/').filter(Boolean)[0] ?? null;
    } else if (
      host === 'youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'youtube-nocookie.com'
    ) {
      const parts = url.pathname.split('/').filter(Boolean);

      if (parts[0] === 'watch') {
        videoId = url.searchParams.get('v');
      } else if (
        ['shorts', 'embed', 'live'].includes(parts[0])
      ) {
        videoId = parts[1] ?? null;
      }
    }

    return videoId && /^[A-Za-z0-9_-]{11}$/.test(videoId)
      ? videoId
      : null;
  } catch {
    return null;
  }
};

const parseVideoInput = (
  body: PravachanaInput,
  existing?: Record<string, any>
) => {
  const title = body.title ?? existing?.title;
  const description = body.description ?? existing?.description ?? '';
  const youtubeUrl = body.youtube_url ?? existing?.youtube_url;
  const language = body.language ?? existing?.language ?? 'Kannada';
  const isPublished = body.is_published ?? existing?.is_published ?? false;

  if (typeof title !== 'string' || !title.trim() || title.trim().length > 255) {
    return { error: 'Valid title is required (maximum 255 characters).' };
  }

  if (typeof description !== 'string') {
    return { error: 'Description must be text.' };
  }

  if (typeof youtubeUrl !== 'string') {
    return { error: 'YouTube URL is required.' };
  }

  const videoId = extractYouTubeVideoId(youtubeUrl);

  if (!videoId) {
    return { error: 'Enter a valid YouTube video URL.' };
  }

  if (typeof language !== 'string' || !language.trim() || language.length > 50) {
    return { error: 'Valid language is required.' };
  }

  if (typeof isPublished !== 'boolean') {
    return { error: 'is_published must be true or false.' };
  }

  return {
    value: {
      title: title.trim(),
      description: description.trim(),
      youtube_url: youtubeUrl.trim(),
      youtube_video_id: videoId,
      language: language.trim(),
      is_published: isPublished,
    },
  };
};

// PUBLIC: GET /api/pravachanas
export const getPravachanas = async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT id, title, description, youtube_url,
             youtube_video_id, language, published_at, created_at
      FROM pravachana_videos
      WHERE is_published = TRUE
      ORDER BY published_at DESC NULLS LAST, id DESC
    `);

    return res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get Pravachanas error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch Pravachanas.',
    });
  }
};

// ADMIN: GET /api/admin/pravachanas
export const getAdminPravachanas = async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM pravachana_videos
      ORDER BY created_at DESC, id DESC
    `);

    return res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Admin Pravachanas error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch admin Pravachanas.',
    });
  }
};

// ADMIN: POST /api/admin/pravachanas
export const createPravachana = async (req: Request, res: Response) => {
  try {
    const parsed = parseVideoInput(req.body ?? {});

    if (!parsed.value) {
      return res.status(400).json({
        success: false,
        message: parsed.error,
      });
    }

    const video = parsed.value;

    const result = await pool.query(
      `
      INSERT INTO pravachana_videos (
        title, description, youtube_url, youtube_video_id,
        language, is_published, published_at
      )
      VALUES ($1, $2, $3, $4, $5, $6,
              CASE WHEN $6::boolean THEN NOW() ELSE NULL END)
      RETURNING *
      `,
      [
        video.title,
        video.description,
        video.youtube_url,
        video.youtube_video_id,
        video.language,
        video.is_published,
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Pravachana created successfully.',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Create Pravachana error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create Pravachana.',
    });
  }
};

// ADMIN: PUT /api/admin/pravachanas/:id
export const updatePravachana = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Pravachana ID.',
      });
    }

    const existingResult = await pool.query(
      'SELECT * FROM pravachana_videos WHERE id = $1',
      [id]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pravachana not found.',
      });
    }

    const existing = existingResult.rows[0];
    const parsed = parseVideoInput(req.body ?? {}, existing);

    if (!parsed.value) {
      return res.status(400).json({
        success: false,
        message: parsed.error,
      });
    }

    const video = parsed.value;

    const result = await pool.query(
      `
      UPDATE pravachana_videos
      SET
        title = $1,
        description = $2,
        youtube_url = $3,
        youtube_video_id = $4,
        language = $5,
        is_published = $6,
        published_at = CASE
          WHEN $6::boolean = TRUE AND is_published = FALSE
            THEN NOW()
          WHEN $6::boolean = FALSE
            THEN NULL
          ELSE published_at
        END,
        updated_at = NOW()
      WHERE id = $7
      RETURNING *
      `,
      [
        video.title,
        video.description,
        video.youtube_url,
        video.youtube_video_id,
        video.language,
        video.is_published,
        id,
      ]
    );

    return res.status(200).json({
      success: true,
      message: 'Pravachana updated successfully.',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Update Pravachana error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update Pravachana.',
    });
  }
};

// ADMIN: DELETE /api/admin/pravachanas/:id
export const deletePravachana = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Pravachana ID.',
      });
    }

    const result = await pool.query(
      'DELETE FROM pravachana_videos WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pravachana not found.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Pravachana deleted successfully.',
    });
  } catch (error) {
    console.error('Delete Pravachana error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete Pravachana.',
    });
  }
};
