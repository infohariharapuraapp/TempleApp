
import React, { useEffect, useState } from 'react';
import { apiRequest } from '../lib/api';

type Video = {
  id: number;
  title: string;
  description: string | null;
  youtube_url: string;
  youtube_video_id: string;
  language: string;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
};

type FormData = {
  id?: number;
  title: string;
  description: string;
  youtube_url: string;
  language: string;
  is_published: boolean;
};

const emptyForm: FormData = {
  title: '',
  description: '',
  youtube_url: '',
  language: 'Kannada',
  is_published: false,
};

function getYouTubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    if (host === 'youtu.be' || host === 'www.youtu.be') {
      const id = parsed.pathname.split('/')[1];
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }

    if (
      host === 'youtube.com' ||
      host === 'www.youtube.com' ||
      host === 'm.youtube.com'
    ) {
      const id =
        parsed.pathname === '/watch'
          ? parsed.searchParams.get('v')
          : parsed.pathname.match(
              /^\/(?:shorts|embed|live)\/([^/]+)/
            )?.[1];

      return id && /^[a-zA-Z0-9_-]{11}$/.test(id)
        ? id
        : null;
    }
  } catch {
    return null;
  }

  return null;
}

function formatDate(date: string | null) {
  if (!date) return 'Not published';

  const time = new Date(date);

  return Number.isNaN(time.getTime())
    ? 'Unknown date'
    : time.toLocaleString('en-IN');
}

export default function Pravachanas() {
  const [items, setItems] = useState<Video[]>([]);
  const [editing, setEditing] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] =
    useState<'all' | 'published' | 'draft'>('all');

  async function load() {
    try {
      setLoading(true);

      const response = await apiRequest<{
        success: boolean;
        data: Video[];
      }>('/admin/pravachanas');

      setItems(response.data || []);
      setError('');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load Pravachanas'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function add() {
    setEditing({ ...emptyForm });
    setError('');
    setSuccess('');
  }

  function edit(item: Video) {
    setEditing({
      id: item.id,
      title: item.title,
      description: item.description || '',
      youtube_url: item.youtube_url,
      language: item.language || 'Kannada',
      is_published: item.is_published,
    });

    setError('');
    setSuccess('');
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();

    if (!editing || busy) return;

    if (!editing.title.trim()) {
      setError('Video title is required.');
      return;
    }

    if (!getYouTubeId(editing.youtube_url.trim())) {
      setError('Enter a valid YouTube video URL.');
      return;
    }

    setBusy(true);
    setError('');
    setSuccess('');

    try {
      const isEdit = editing.id !== undefined;

      await apiRequest(
        isEdit
          ? `/admin/pravachanas/${editing.id}`
          : '/admin/pravachanas',
        {
          method: isEdit ? 'PUT' : 'POST',
          body: JSON.stringify({
            title: editing.title.trim(),
            description: editing.description.trim() || null,
            youtube_url: editing.youtube_url.trim(),
            language: editing.language,
            is_published: editing.is_published,
          }),
        }
      );

      setEditing(null);
      await load();

      setSuccess(
        isEdit
          ? 'Pravachana updated successfully.'
          : 'Pravachana added successfully.'
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save Pravachana'
      );
    } finally {
      setBusy(false);
    }
  }

  async function togglePublish(item: Video) {
    if (busy) return;

    const action = item.is_published ? 'unpublish' : 'publish';

    if (
      !window.confirm(
        `Are you sure you want to ${action} "${item.title}"?`
      )
    ) {
      return;
    }

    setBusy(true);
    setError('');
    setSuccess('');

    try {
      await apiRequest(`/admin/pravachanas/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          is_published: !item.is_published,
        }),
      });

      await load();
      setSuccess(`Video ${action}ed successfully.`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update publication status'
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: Video) {
    if (busy) return;

    if (
      !window.confirm(
        `Permanently delete "${item.title}"?\n\nThis cannot be undone.`
      )
    ) {
      return;
    }

    setBusy(true);
    setError('');
    setSuccess('');

    try {
      await apiRequest(`/admin/pravachanas/${item.id}`, {
        method: 'DELETE',
      });

      await load();
      setSuccess('Pravachana deleted successfully.');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to delete Pravachana'
      );
    } finally {
      setBusy(false);
    }
  }

  const filtered = items
    .filter((item) => {
      if (filter === 'published' && !item.is_published)
        return false;

      if (filter === 'draft' && item.is_published)
        return false;

      const q = search.toLowerCase().trim();

      return (
        !q ||
        item.title.toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q) ||
        item.language.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const aTime = new Date(
        a.published_at || a.created_at
      ).getTime();

      const bTime = new Date(
        b.published_at || b.created_at
      ).getTime();

      return bTime - aTime || b.id - a.id;
    });

  return (
    <main className="content">
      <div className="page-head">
        <div>
          <h2>Manage Pravachanas</h2>
          <p>
            Publish spiritual discourses and YouTube videos
            to the devotee mobile application.
          </p>
        </div>

        <button
          className="primary"
          type="button"
          onClick={add}
          disabled={busy}
        >
          + Add Pravachana
        </button>
      </div>

      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}

      {success && (
        <div className="panel" role="status">
          {success}
        </div>
      )}

      {editing && (
        <form className="form-card" onSubmit={save}>
          <h3>
            {editing.id
              ? 'Edit Pravachana'
              : 'Add New Pravachana'}
          </h3>

          <label>
            Video Title *
            <input
              required
              maxLength={255}
              value={editing.title}
              placeholder="Bhagavad Gita — Chapter 2"
              onChange={(e) =>
                setEditing({
                  ...editing,
                  title: e.target.value,
                })
              }
            />
          </label>

          <label>
            YouTube Video URL *
            <input
              required
              type="url"
              value={editing.youtube_url}
              placeholder="https://www.youtube.com/watch?v=..."
              onChange={(e) =>
                setEditing({
                  ...editing,
                  youtube_url: e.target.value,
                })
              }
            />
          </label>

          {getYouTubeId(editing.youtube_url) && (
            <div className="panel">
              <strong>Video Preview</strong>

              <div style={{ marginTop: 12 }}>
                <img
                  src={`https://img.youtube.com/vi/${getYouTubeId(
                    editing.youtube_url
                  )}/hqdefault.jpg`}
                  alt="YouTube video thumbnail"
                  style={{
                    width: '100%',
                    maxWidth: 360,
                    borderRadius: 12,
                  }}
                />
              </div>
            </div>
          )}

          <label>
            Description
            <textarea
              rows={4}
              value={editing.description}
              placeholder="Enter the discourse description"
              onChange={(e) =>
                setEditing({
                  ...editing,
                  description: e.target.value,
                })
              }
            />
          </label>

          <label>
            Language
            <select
              value={editing.language}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  language: e.target.value,
                })
              }
            >
              <option value="Kannada">Kannada</option>
              <option value="Telugu">Telugu</option>
              <option value="English">English</option>
              <option value="Tamil">Tamil</option>
              <option value="Hindi">Hindi</option>
              <option value="Sanskrit">Sanskrit</option>
            </select>
          </label>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <input
              type="checkbox"
              checked={editing.is_published}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  is_published: e.target.checked,
                })
              }
            />
            Publish — Visible to devotees
          </label>

          <div className="actions">
            <button
              type="button"
              disabled={busy}
              onClick={() => setEditing(null)}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="primary"
              disabled={busy}
            >
              {busy
                ? 'Saving...'
                : editing.id
                  ? 'Save Changes'
                  : 'Create Pravachana'}
            </button>
          </div>
        </form>
      )}

      <div className="panel">
        <div
          className="actions"
          style={{
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <input
            placeholder="Search Pravachanas"
            aria-label="Search Pravachanas"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            value={filter}
            onChange={(e) =>
              setFilter(e.target.value as typeof filter)
            }
          >
            <option value="all">All Videos</option>
            <option value="published">Published</option>
            <option value="draft">Drafts</option>
          </select>

          <span>{filtered.length} videos</span>
        </div>
      </div>

      {loading ? (
        <div className="panel">
          Loading Pravachanas...
        </div>
      ) : filtered.length === 0 ? (
        <div className="panel">
          No Pravachana videos found.
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Video</th>
                <th>Title / Description</th>
                <th>Language</th>
                <th>Published Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td>
                    <img
                      src={`https://img.youtube.com/vi/${item.youtube_video_id}/mqdefault.jpg`}
                      alt={item.title}
                      style={{
                        width: 130,
                        borderRadius: 8,
                      }}
                    />
                  </td>

                  <td>
                    <strong>{item.title}</strong>

                    {item.description && (
                      <div>
                        <small>
                          {item.description.slice(0, 110)}
                          {item.description.length > 110
                            ? '…'
                            : ''}
                        </small>
                      </div>
                    )}

                    <div>
                      <a
                        href={item.youtube_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View on YouTube
                      </a>
                    </div>
                  </td>

                  <td>{item.language}</td>

                  <td>
                    {formatDate(item.published_at)}
                  </td>

                  <td>
                    <span className="badge">
                      {item.is_published
                        ? 'Published'
                        : 'Draft'}
                    </span>
                  </td>

                  <td>
                    <div
                      className="actions"
                      style={{ flexWrap: 'wrap' }}
                    >
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => edit(item)}
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void togglePublish(item)
                        }
                      >
                        {item.is_published
                          ? 'Unpublish'
                          : 'Publish'}
                      </button>

                      <button
                        type="button"
                        className="danger"
                        disabled={busy}
                        onClick={() => void remove(item)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
