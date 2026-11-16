import type { PoolClient } from 'pg';

// ========================================
// TYPES
// ========================================

export type EventVideoInput = {
  title: string | null;
  youtube_url: string;
  youtube_video_id: string;
  display_order: number;
};

// ========================================
// CONFIGURATION
// ========================================

export const MAX_EVENT_VIDEOS = 10;

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

// ========================================
// EXTRACT YOUTUBE VIDEO ID
// ========================================

export function extractYouTubeVideoId(
  value: string
): string | null {
  try {
    const url = new URL(value.trim());

    if (
      url.protocol !== 'https:' &&
      url.protocol !== 'http:'
    ) {
      return null;
    }

    if (url.username || url.password || url.port) {
      return null;
    }

    const host = url.hostname.toLowerCase();

    const parts = url.pathname
      .split('/')
      .filter(Boolean);

    let videoId: string | null = null;

    if (host === 'youtu.be') {
      videoId = parts[0] || null;
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
      } else if (
        ['embed', 'shorts', 'live', 'v'].includes(
          parts[0]
        )
      ) {
        videoId = parts[1] || null;
      }
    }

    return videoId &&
      VIDEO_ID_PATTERN.test(videoId)
      ? videoId
      : null;
  } catch {
    return null;
  }
}

// ========================================
// VALIDATE EVENT VIDEOS
// ========================================

export function parseEventVideos(
  value: unknown
): EventVideoInput[] | undefined {
  // Preserve videos when older clients omit
  // the videos field during an update.

  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error('Videos must be an array');
  }

  if (value.length > MAX_EVENT_VIDEOS) {
    throw new Error(
      `Maximum ${MAX_EVENT_VIDEOS} videos per event`
    );
  }

  const seen = new Set<string>();

  return value.map((item, index) => {
    if (
      !item ||
      typeof item !== 'object' ||
      Array.isArray(item)
    ) {
      throw new Error(
        `Invalid video at position ${index + 1}`
      );
    }

    const url = item.youtube_url;

    if (
      typeof url !== 'string' ||
      !url.trim() ||
      url.length > 2048
    ) {
      throw new Error(
        `YouTube URL is required for video ${index + 1}`
      );
    }

    const videoId = extractYouTubeVideoId(url);

    if (!videoId) {
      throw new Error(
        `Invalid YouTube URL for video ${index + 1}`
      );
    }

    if (seen.has(videoId)) {
      throw new Error(
        'Duplicate YouTube videos are not allowed'
      );
    }

    seen.add(videoId);

    if (
      item.title != null &&
      typeof item.title !== 'string'
    ) {
      throw new Error(
        `Invalid title for video ${index + 1}`
      );
    }

    const title =
      typeof item.title === 'string'
        ? item.title.trim()
        : '';

    if (title.length > 255) {
      throw new Error(
        'Video title cannot exceed 255 characters'
      );
    }

    return {
      title: title || null,

      youtube_url:
        `https://www.youtube.com/watch?v=${videoId}`,

      youtube_video_id: videoId,

      display_order: index,
    };
  });
}

// ========================================
// SAVE EVENT VIDEOS
// ========================================

export async function saveEventVideos(
  client: PoolClient,
  eventId: number,
  videos: EventVideoInput[]
): Promise<void> {
  await client.query(
    'DELETE FROM event_videos WHERE event_id = $1',
    [eventId]
  );

  for (const video of videos) {
    await client.query(
      `INSERT INTO event_videos (
         event_id,
         title,
         youtube_url,
         youtube_video_id,
         display_order
       )
       VALUES ($1, $2, $3, $4, $5)`,
      [
        eventId,
        video.title,
        video.youtube_url,
        video.youtube_video_id,
        video.display_order,
      ]
    );
  }
}

// ========================================
// GET EVENT VIDEOS
// ========================================

export async function getEventVideos(
  client: PoolClient,
  eventId: number
) {
  const result = await client.query(
    `SELECT
       id,
       title,
       youtube_url,
       youtube_video_id,
       display_order
     FROM event_videos
     WHERE event_id = $1
     ORDER BY display_order, id`,
    [eventId]
  );

  return result.rows;
}