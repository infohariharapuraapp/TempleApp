
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
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
  message?: string;
  unchanged?: boolean;
  replaced?: boolean;
};

// ========================================
// EXTRACT YOUTUBE VIDEO ID
// ========================================

function extractVideoId(input: string): string | null {
  try {
    const url = new URL(input.trim());

    if (url.protocol !== 'https:') {
      return null;
    }

    const host = url.hostname.toLowerCase();
    let id: string | null = null;

    if (host === 'youtu.be' || host === 'www.youtu.be') {
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
        const parts = url.pathname.split('/').filter(Boolean);

        if (['embed', 'shorts', 'live'].includes(parts[0])) {
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
// TODAY'S DARSHAN ADMIN
// ========================================

export default function Darshan() {
  const [name, setName] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');

  const [current, setCurrent] =
    useState<TodayDarshan | null>(null);

  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const videoId = extractVideoId(youtubeUrl);

  const previewUrl = videoId
    ? `https://www.youtube-nocookie.com/embed/${videoId}`
    : null;

  const currentVideoUrl = current
    ? `https://www.youtube-nocookie.com/embed/${current.youtube_video_id}`
    : null;

  // ========================================
  // LOAD TODAY'S DARSHAN
  // ========================================

  const loadTodayDarshan = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const response =
        await apiRequest<ApiResponse<TodayDarshan | null>>(
          '/admin/darshan/today'
        );

      if (!response.success) {
        throw new Error(
          response.message || 'Failed to load Darshan.'
        );
      }

      setCurrent(response.data);

      if (response.data) {
        setName(response.data.name);
        setYoutubeUrl(response.data.youtube_url);
      } else {
        setName('');
        setYoutubeUrl('');
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load Darshan.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTodayDarshan();
  }, [loadTodayDarshan]);

  // ========================================
  // PUBLISH OR REPLACE
  // ========================================

  const handlePublish = async () => {
    setError('');
    setMessage('');

    if (!name.trim()) {
      setError('Please enter Darshan name.');
      return;
    }

    if (!videoId) {
      setError('Please enter a valid YouTube video URL.');
      return;
    }

    const isUnchanged =
      current !== null &&
      current.name === name.trim() &&
      current.youtube_video_id === videoId;

    if (isUnchanged) {
      setMessage(
        'This Darshan is already published. No changes are needed.'
      );
      return;
    }

    const confirmed = window.confirm(
      current
        ? 'Replace today’s Darshan? Devotees may receive a new notification.'
        : 'Publish today’s Darshan and notify devotees?'
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
              name: name.trim(),
              youtube_url: youtubeUrl.trim(),
            }),
          }
        );

      if (!response.success) {
        throw new Error(
          response.message || 'Failed to publish Darshan.'
        );
      }

      setCurrent(response.data);

      setName(response.data.name);
      setYoutubeUrl(response.data.youtube_url);

      setMessage(
        response.message ||
          'Darshan published successfully.'
      );
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
            Publish the daily Darshan video for devotees.
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

      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
          gap: 20,
          alignItems: 'start',
        }}
      >
        {/* PUBLISH FORM */}

        <div className="card">
          <div className="section-header">
            <div>
              <h2>
                {current
                  ? 'Update Today’s Darshan'
                  : 'Publish Today’s Darshan'}
              </h2>

              <p>
                Enter a Darshan name and YouTube video link.
              </p>
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <label
              htmlFor="darshan-name"
              style={{ display: 'block', marginBottom: 8 }}
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
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginTop: 20 }}>
            <label
              htmlFor="darshan-youtube"
              style={{ display: 'block', marginBottom: 8 }}
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
              style={{ width: '100%' }}
            />

            <p
              style={{
                marginTop: 8,
                fontSize: 12,
                color: '#81776d',
              }}
            >
              Supported: YouTube watch, short, live and
              youtu.be links.
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
                : current
                ? 'Replace Darshan'
                : 'Publish Darshan'}
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
            Publishing a new or changed Darshan creates
            a notification for devotees. Submitting
            unchanged details will not create a duplicate.
          </p>
        </div>

        {/* VIDEO PREVIEW */}

        <div className="card">
          <div className="section-header">
            <div>
              <h2>Video Preview</h2>
              <p>
                Check the YouTube video before publishing.
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
                Preview only — this video is not published
                until you click Publish or Replace.
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
              Enter a valid YouTube URL to preview
              the video here.
            </div>
          )}
        </div>
      </div>

      {/* CURRENTLY PUBLISHED VIDEO */}

      <div className="card" style={{ marginTop: 24 }}>
        <div className="section-header">
          <div>
            <h2>Currently Published Darshan</h2>
            <p>
              The Darshan video available to devotees today.
            </p>
          </div>
        </div>

        {loading ? (
          <p style={{ marginTop: 20 }}>
            Loading today's Darshan...
          </p>
        ) : current && currentVideoUrl ? (
          <div style={{ marginTop: 20 }}>
            <h3>{current.name}</h3>

            <p
              style={{
                marginTop: 8,
                marginBottom: 16,
                color: '#81776d',
              }}
            >
              Darshan Date: {current.darshan_date.slice(0, 10)}
            </p>

            <div
              style={{
                width: '100%',
                maxWidth: 720,
                aspectRatio: '16 / 9',
                borderRadius: 12,
                overflow: 'hidden',
                backgroundColor: '#000',
              }}
            >
              <iframe
                key={current.youtube_video_id}
                title="Currently published Darshan"
                src={currentVideoUrl}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                style={{
                  width: '100%',
                  height: '100%',
                  border: 0,
                }}
              />
            </div>
          </div>
        ) : (
          <p
            style={{
              marginTop: 20,
              color: '#81776d',
            }}
          >
            No Darshan video has been published today.
          </p>
        )}
      </div>
    </div>
  );
}
