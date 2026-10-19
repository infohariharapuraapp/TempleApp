
import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../lib/api';

// ========================================
// TYPES
// ========================================

type TodayDarshan = {
  id: number;
  name: string;
  youtube_url: string;
  youtube_video_id: string;
  darshan_date: string;
  published_at: string;
  updated_at: string;
  notification_id?: number | null;
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
  message?: string;
  unchanged?: boolean;
  replaced?: boolean;
};

// ========================================
// YOUTUBE VIDEO ID
// ========================================

function extractVideoId(input: string): string | null {
  try {
    const url = new URL(input.trim());

    if (url.protocol !== 'https:') {
      return null;
    }

    const host = url.hostname.toLowerCase();

    let id: string | null = null;

    if (
      host === 'youtu.be' ||
      host === 'www.youtu.be'
    ) {
      id = url.pathname.split('/')[1] || null;
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
        id = url.searchParams.get('v');
      } else {
        const parts = url.pathname
          .split('/')
          .filter(Boolean);

        if (
          ['embed', 'shorts', 'live'].includes(parts[0])
        ) {
          id = parts[1] || null;
        }
      }
    }

    return id && /^[A-Za-z0-9_-]{11}$/.test(id)
      ? id
      : null;
  } catch {
    return null;
  }
}

// ========================================
// FORMAT DATE
// ========================================

function formatDate(value: string): string {
  if (!value) {
    return '';
  }

  const date = new Date(
    `${value.slice(0, 10)}T12:00:00+05:30`
  );

  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

// ========================================
// TODAY'S DARSHAN ADMIN
// ========================================

export default function Darshan() {
  const [name, setName] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');

  const [videos, setVideos] =
    useState<TodayDarshan[]>([]);

  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const videoId = extractVideoId(youtubeUrl);

  const previewUrl = videoId
    ? `https://www.youtube.com/embed/${videoId}?rel=0`
    : null;

  // ========================================
  // LOAD TODAY'S DARSHAN VIDEOS
  // ========================================

  const loadTodayDarshan = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const response =
        await apiRequest<ApiResponse<TodayDarshan[]>>(
          '/admin/darshan/today'
        );

      if (!response.success) {
        throw new Error(
          response.message ||
            'Failed to load Darshan videos.'
        );
      }

      setVideos(
        Array.isArray(response.data)
          ? response.data
          : []
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load Darshan videos.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTodayDarshan();
  }, [loadTodayDarshan]);

  // ========================================
  // PUBLISH NEW DARSHAN VIDEO
  // ========================================

  const handlePublish = async () => {
    setError('');
    setMessage('');

    const cleanName = name.trim();

    if (!cleanName) {
      setError('Please enter Darshan name.');
      return;
    }

    if (!videoId) {
      setError(
        'Please enter a valid YouTube video URL.'
      );
      return;
    }

    const duplicate = videos.some(
      (video) =>
        video.youtube_video_id === videoId
    );

    if (duplicate) {
      setError(
        'This YouTube video is already published today.'
      );
      return;
    }

    const confirmed = window.confirm(
      'Publish this Darshan video and send a notification to devotees?'
    );

    if (!confirmed) {
      return;
    }

    try {
      setPublishing(true);

      const response =
        await apiRequest<ApiResponse<TodayDarshan>>(
          '/admin/darshan/today/publish',
          {
            method: 'POST',
            body: JSON.stringify({
              name: cleanName,
              youtube_url: youtubeUrl.trim(),
            }),
          }
        );

      if (!response.success) {
        throw new Error(
          response.message ||
            'Failed to publish Darshan.'
        );
      }

      setMessage(
        response.message ||
          'Darshan video published successfully.'
      );

      if (!response.unchanged) {
        setName('');
        setYoutubeUrl('');
      }

      await loadTodayDarshan();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to publish Darshan.'
      );
    } finally {
      setPublishing(false);
    }
  };

  // ========================================
  // RENDER
  // ========================================

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Today's Darshan</h1>

          <p>
            Publish multiple Darshan videos for
            devotees to watch today.
          </p>
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={loadTodayDarshan}
          disabled={loading || publishing}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {message && (
        <div
          className="card"
          role="status"
          style={{
            marginBottom: 20,
            borderLeft: '4px solid #3F8554',
          }}
        >
          {message}
        </div>
      )}

      {/* ====================================
          ADD VIDEO + PREVIEW
      ==================================== */}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
          gap: 20,
          alignItems: 'start',
        }}
      >
        {/* ADD DARSHAN FORM */}

        <div className="card">
          <div className="section-header">
            <div>
              <h2>Add Darshan Video</h2>
              <p>
                Add another Darshan video without
                replacing existing videos.
              </p>
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <label
              htmlFor="darshan-name"
              style={{
                display: 'block',
                marginBottom: 8,
              }}
            >
              Darshan Name
            </label>

            <input
              id="darshan-name"
              type="text"
              value={name}
              maxLength={200}
              onChange={(event) =>
                setName(event.target.value)
              }
              placeholder="Example: Sri Sharada Devi Darshan"
              disabled={loading || publishing}
              style={{
                width: '100%',
                maxWidth: '100%',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginTop: 20 }}>
            <label
              htmlFor="darshan-youtube"
              style={{
                display: 'block',
                marginBottom: 8,
              }}
            >
              YouTube Video URL
            </label>

            <input
              id="darshan-youtube"
              type="url"
              value={youtubeUrl}
              onChange={(event) =>
                setYoutubeUrl(event.target.value)
              }
              placeholder="https://www.youtube.com/watch?v=..."
              disabled={loading || publishing}
              style={{
                width: '100%',
                maxWidth: '100%',
                boxSizing: 'border-box',
              }}
            />

            <p
              style={{
                marginTop: 8,
                fontSize: 12,
                color: '#81776d',
                lineHeight: 1.6,
              }}
            >
              Supported: YouTube watch, shorts,
              live, embed and youtu.be links.
            </p>
          </div>

          <div style={{ marginTop: 24 }}>
            <button
              type="button"
              className="primary-button"
              onClick={handlePublish}
              disabled={
                loading ||
                publishing ||
                !name.trim() ||
                !videoId
              }
            >
              {publishing
                ? 'Publishing...'
                : 'Add & Publish Darshan'}
            </button>
          </div>

          <p
            style={{
              marginTop: 14,
              fontSize: 12,
              color: '#81776d',
              lineHeight: 1.6,
            }}
          >
            Each new video is added to today's
            Darshan list and generates a
            notification for devotees.
          </p>
        </div>

        {/* VIDEO PREVIEW */}

        <div className="card">
          <div className="section-header">
            <div>
              <h2>Video Preview</h2>
              <p>
                Preview the YouTube video before
                publishing.
              </p>
            </div>
          </div>

          {previewUrl ? (
            <div style={{ marginTop: 20 }}>
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: '16 / 9',
                  backgroundColor: '#000',
                  borderRadius: 12,
                  overflow: 'hidden',
                }}
              >
                <iframe
                  key={videoId}
                  title="Darshan video preview"
                  src={previewUrl}
                  referrerPolicy="strict-origin-when-cross-origin"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 0,
                  }}
                />
              </div>

              <p
                style={{
                  marginTop: 12,
                  fontSize: 13,
                  color: '#81776d',
                }}
              >
                Preview only. The video is not
                published until you click
                Add & Publish Darshan.
              </p>
            </div>
          ) : (
            <div
              style={{
                marginTop: 20,
                padding: 30,
                border: '1px dashed #D8C9B5',
                borderRadius: 12,
                textAlign: 'center',
                color: '#81776d',
              }}
            >
              Enter a valid YouTube URL to
              preview the video.
            </div>
          )}
        </div>
      </div>

      {/* ====================================
          PUBLISHED DARSHAN VIDEOS
      ==================================== */}

      <div
        className="card"
        style={{ marginTop: 24 }}
      >
        <div className="section-header">
          <div>
            <h2>Published Darshan Videos</h2>

            <p>
              All Darshan videos available
              to devotees today.
            </p>
          </div>
        </div>

        {loading ? (
          <p style={{ marginTop: 20 }}>
            Loading today's Darshan videos...
          </p>
        ) : videos.length > 0 ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
              gap: 20,
              marginTop: 20,
            }}
          >
            {videos.map((video) => (
              <div
                key={video.id}
                style={{
                  border: '1px solid #E8DCCB',
                  borderRadius: 14,
                  overflow: 'hidden',
                  backgroundColor: '#FFFFFF',
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    padding: 16,
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {video.name}
                  </h3>

                  <p
                    style={{
                      marginTop: 8,
                      fontSize: 12,
                      color: '#81776d',
                    }}
                  >
                    {formatDate(video.darshan_date)}
                  </p>
                </div>

                <div
                  style={{
                    width: '100%',
                    aspectRatio: '16 / 9',
                    backgroundColor: '#000',
                  }}
                >
                  <iframe
                    title={`Darshan ${video.id}`}
                    src={`https://www.youtube.com/embed/${video.youtube_video_id}?rel=0`}
                    referrerPolicy="strict-origin-when-cross-origin"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    loading="lazy"
                    style={{
                      width: '100%',
                      height: '100%',
                      border: 0,
                    }}
                  />
                </div>

                <div style={{ padding: 16 }}>
                  <a
                    href={video.youtube_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: '#6B1720',
                      fontWeight: 600,
                      fontSize: 13,
                      overflowWrap: 'anywhere',
                    }}
                  >
                    Open on YouTube ↗
                  </a>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p
            style={{
              marginTop: 20,
              color: '#81776d',
            }}
          >
            No Darshan videos have been published today.
          </p>
        )}
      </div>
    </div>
  );
}
