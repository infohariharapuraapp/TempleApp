
import React, { useEffect, useState } from 'react';
import { apiRequest } from '../lib/api';

type Status = 'upcoming' | 'ongoing' | 'completed';

type Programme = {
  id: number;
  title: string;
  description: string;
  image_url: string | null;
  youtube_url: string | null;
  start_date: string | null;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  venue: string | null;
  status: Status;
  is_published: boolean;
  created_at: string;
};

type ProgrammeForm = {
  id?: number;
  title: string;
  description: string;
  image_url: string;
  youtube_url: string;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  venue: string;
  status: Status;
  is_published: boolean;
};

const emptyForm: ProgrammeForm = {
  title: '',
  description: '',
  image_url: '',
  youtube_url: '',
  start_date: '',
  start_time: '',
  end_date: '',
  end_time: '',
  venue: '',
  status: 'upcoming',
  is_published: false,
};

const optional = (value: string) => value.trim() || null;

function youtubeId(url: string): string | null {
  if (!url.trim()) return null;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    let id: string | null | undefined = null;

    if (['youtu.be', 'www.youtu.be'].includes(host)) {
      id = parsed.pathname.split('/')[1];
    } else if (
      ['youtube.com', 'www.youtube.com', 'm.youtube.com']
        .includes(host)
    ) {
      id = parsed.pathname === '/watch'
        ? parsed.searchParams.get('v')
        : parsed.pathname.match(
            /^\/(?:shorts|embed|live)\/([^/]+)/
          )?.[1];
    }

    return id && /^[a-zA-Z0-9_-]{11}$/.test(id)
      ? id
      : null;
  } catch {
    return null;
  }
}

function getPoster(
  imageUrl: string | null,
  videoUrl: string | null
) {
  if (imageUrl?.trim()) return imageUrl.trim();

  const id = youtubeId(videoUrl || '');

  return id
    ? `https://img.youtube.com/vi/${id}/hqdefault.jpg`
    : null;
}

function dateInput(value: string | null) {
  return value?.slice(0, 10) || '';
}

function timeInput(value: string | null) {
  return value?.slice(0, 5) || '';
}

function displayDate(value: string | null) {
  if (!value) return 'Not specified';

  const parts = value.slice(0, 10).split('-');

  return parts.length === 3
    ? `${parts[2]}/${parts[1]}/${parts[0]}`
    : value;
}

export default function MahaswamijiProgrammes() {
  const [items, setItems] = useState<Programme[]>([]);
  const [editing, setEditing] =
    useState<ProgrammeForm | null>(null);

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const [previewUrl, setPreviewUrl] =
    useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] =
    useState<'all' | Status>('all');

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  async function load() {
    try {
      setLoading(true);

      const response = await apiRequest<{
        success: boolean;
        data: Programme[];
      }>('/admin/mahaswamiji-programmes');

      setItems(response.data || []);
      setError('');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load programmes'
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
    setSelectedFile(null);
    setError('');
    setSuccess('');
  }

  function edit(item: Programme) {
    setEditing({
      id: item.id,
      title: item.title,
      description: item.description,
      image_url: item.image_url || '',
      youtube_url: item.youtube_url || '',
      start_date: dateInput(item.start_date),
      start_time: timeInput(item.start_time),
      end_date: dateInput(item.end_date),
      end_time: timeInput(item.end_time),
      venue: item.venue || '',
      status: item.status,
      is_published: item.is_published,
    });

    setSelectedFile(null);
    setError('');
    setSuccess('');

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  function update<K extends keyof ProgrammeForm>(
    key: K,
    value: ProgrammeForm[K]
  ) {
    setEditing((current) =>
      current ? { ...current, [key]: value } : null
    );
  }

  function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    const allowed = [
      'image/jpeg',
      'image/png',
      'image/webp',
    ];

    if (!allowed.includes(file.type)) {
      setError('Select a JPG, PNG or WebP image.');
      event.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be 5 MB or smaller.');
      event.target.value = '';
      return;
    }

    setSelectedFile(file);
    setError('');
    setSuccess('');
  }

  function removePoster() {
    setSelectedFile(null);
    update('image_url', '');
    setError('');
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();

    if (!editing || busy) return;

    if (!editing.title.trim()) {
      setError('Programme title is required.');
      return;
    }

    if (!editing.description.trim()) {
      setError('Programme description is required.');
      return;
    }

    if (
      editing.youtube_url.trim() &&
      !youtubeId(editing.youtube_url.trim())
    ) {
      setError('Enter a valid YouTube video link.');
      return;
    }

    if (editing.image_url.trim()) {
      try {
        const url = new URL(editing.image_url.trim());

        if (!['http:', 'https:'].includes(url.protocol)) {
          throw new Error('Invalid image URL');
        }
      } catch {
        setError('Enter a valid image URL.');
        return;
      }
    }

    if (
      editing.start_date &&
      editing.end_date &&
      editing.end_date < editing.start_date
    ) {
      setError('End date cannot be before start date.');
      return;
    }

    if (
      editing.start_date &&
      editing.end_date &&
      editing.start_date === editing.end_date &&
      editing.start_time &&
      editing.end_time &&
      editing.end_time < editing.start_time
    ) {
      setError('End time cannot be before start time.');
      return;
    }

    setBusy(true);
    setError('');
    setSuccess('');

    try {
      let imageUrl = editing.image_url.trim() || null;

      // Upload selected poster before saving programme.
      if (selectedFile) {
        const formData = new FormData();
        formData.append('image', selectedFile);

        const uploaded = await apiRequest<{
          success: boolean;
          data: {
            image_url: string;
            public_id: string;
          };
        }>('/admin/mahaswamiji-programmes/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploaded.success || !uploaded.data?.image_url) {
          throw new Error('Image upload failed');
        }

        imageUrl = uploaded.data.image_url;
      }

      const isEdit = editing.id !== undefined;

      await apiRequest(
        isEdit
          ? `/admin/mahaswamiji-programmes/${editing.id}`
          : '/admin/mahaswamiji-programmes',
        {
          method: isEdit ? 'PUT' : 'POST',
          body: JSON.stringify({
            title: editing.title.trim(),
            description: editing.description.trim(),
            image_url: imageUrl,
            youtube_url: optional(editing.youtube_url),
            start_date: optional(editing.start_date),
            start_time: optional(editing.start_time),
            end_date: optional(editing.end_date),
            end_time: optional(editing.end_time),
            venue: optional(editing.venue),
            status: editing.status,
            is_published: editing.is_published,
          }),
        }
      );

      setEditing(null);
      setSelectedFile(null);

      await load();

      setSuccess(
        isEdit
          ? 'Programme updated successfully.'
          : 'Programme created successfully.'
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to save programme'
      );
    } finally {
      setBusy(false);
    }
  }

  async function togglePublish(item: Programme) {
    if (busy) return;

    const action = item.is_published
      ? 'unpublish'
      : 'publish';

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
      await apiRequest(
        `/admin/mahaswamiji-programmes/${item.id}/publish`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            is_published: !item.is_published,
          }),
        }
      );

      await load();

      setSuccess(
        item.is_published
          ? 'Programme unpublished successfully.'
          : 'Programme published successfully.'
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to change publication status'
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: Programme) {
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
      await apiRequest(
        `/admin/mahaswamiji-programmes/${item.id}`,
        { method: 'DELETE' }
      );

      await load();
      setSuccess('Programme deleted successfully.');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to delete programme'
      );
    } finally {
      setBusy(false);
    }
  }

  const filtered = items.filter((item) => {
    if (filter !== 'all' && item.status !== filter) {
      return false;
    }

    const q = search.trim().toLowerCase();

    return (
      !q ||
      item.title.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      (item.venue || '').toLowerCase().includes(q)
    );
  });

  const counts = {
    total: items.length,
    upcoming: items.filter(
      (item) => item.status === 'upcoming'
    ).length,
    ongoing: items.filter(
      (item) => item.status === 'ongoing'
    ).length,
    completed: items.filter(
      (item) => item.status === 'completed'
    ).length,
  };

  const posterPreview = editing
    ? previewUrl ||
      getPoster(editing.image_url, editing.youtube_url)
    : null;

  return (
    <main className="content">
      <div className="page-head">
        <div>
          <h2>Mahaswamiji Programmes</h2>
          <p>
            Manage spiritual programmes, schedules,
            posters and YouTube videos for devotees.
          </p>
        </div>

        <button
          className="primary"
          type="button"
          onClick={add}
          disabled={busy}
        >
          + Add Programme
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

      <div className="stats">
        {[
          ['Total Programmes', counts.total],
          ['Upcoming', counts.upcoming],
          ['Ongoing', counts.ongoing],
          ['Completed', counts.completed],
        ].map(([label, count]) => (
          <div className="stat" key={String(label)}>
            <span>{label}</span>
            <strong>{count}</strong>
          </div>
        ))}
      </div>

      {editing && (
        <form className="form-card" onSubmit={save}>
          <h3>
            {editing.id
              ? 'Edit Programme'
              : 'Create New Programme'}
          </h3>

          <label>
            Programme Title *
            <input
              required
              maxLength={255}
              value={editing.title}
              placeholder="Mahaswamiji Special Programme"
              onChange={(e) =>
                update('title', e.target.value)
              }
            />
          </label>

          <label>
            Programme Description *
            <textarea
              required
              rows={5}
              value={editing.description}
              placeholder="Enter programme information"
              onChange={(e) =>
                update('description', e.target.value)
              }
            />
          </label>

          <div className="grid2">
            <label>
              Programme Status
              <select
                value={editing.status}
                onChange={(e) =>
                  update('status', e.target.value as Status)
                }
              >
                <option value="upcoming">Upcoming</option>
                <option value="ongoing">Ongoing</option>
                <option value="completed">Completed</option>
              </select>
            </label>

            <label>
              Venue / Location (Optional)
              <input
                value={editing.venue}
                placeholder="Sri Math, Hariharapura"
                onChange={(e) =>
                  update('venue', e.target.value)
                }
              />
            </label>
          </div>

          <div className="grid2">
            <label>
              Start Date (Optional)
              <input
                type="date"
                value={editing.start_date}
                onChange={(e) =>
                  update('start_date', e.target.value)
                }
              />
            </label>

            <label>
              Start Time (Optional)
              <input
                type="time"
                value={editing.start_time}
                onChange={(e) =>
                  update('start_time', e.target.value)
                }
              />
            </label>

            <label>
              End Date (Optional)
              <input
                type="date"
                value={editing.end_date}
                onChange={(e) =>
                  update('end_date', e.target.value)
                }
              />
            </label>

            <label>
              End Time (Optional)
              <input
                type="time"
                value={editing.end_time}
                onChange={(e) =>
                  update('end_time', e.target.value)
                }
              />
            </label>
          </div>

          <div
            className="panel"
            style={{ marginTop: 20, marginBottom: 20 }}
          >
            <h3>Programme Poster</h3>

            <p style={{ fontSize: 13 }}>
              Upload a poster or enter an image URL.
              If neither is provided, the YouTube
              thumbnail will be displayed automatically.
            </p>

            <label>
              Upload Image (Optional)
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                disabled={busy}
                onChange={handleFileChange}
              />
              <small>
                JPG, PNG or WebP. Maximum 5 MB.
              </small>
            </label>

            {selectedFile && (
              <p style={{ fontSize: 13 }}>
                Selected: {selectedFile.name}
              </p>
            )}

            <label>
              Or Enter Image URL (Optional)
              <input
                type="url"
                value={editing.image_url}
                placeholder="https://example.com/poster.jpg"
                disabled={busy}
                onChange={(e) => {
                  update('image_url', e.target.value);
                  setSelectedFile(null);
                }}
              />
            </label>

            {posterPreview ? (
              <div style={{ marginTop: 16 }}>
                <strong>Programme Poster Preview</strong>

                <div style={{ marginTop: 12 }}>
                  <img
                    src={posterPreview}
                    alt="Programme poster preview"
                    style={{
                      width: '100%',
                      maxWidth: 420,
                      aspectRatio: '16 / 9',
                      objectFit: 'cover',
                      borderRadius: 14,
                      border: '1px solid #E8DCCB',
                    }}
                  />
                </div>

                {(selectedFile || editing.image_url) && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={removePoster}
                    style={{ marginTop: 12 }}
                  >
                    Remove Poster
                  </button>
                )}
              </div>
            ) : (
              <p style={{ marginTop: 12 }}>
                No poster selected. A devotional
                placeholder will be shown.
              </p>
            )}
          </div>

          <label>
            YouTube Video URL (Optional)
            <input
              type="url"
              value={editing.youtube_url}
              placeholder="https://www.youtube.com/watch?v=..."
              onChange={(e) =>
                update('youtube_url', e.target.value)
              }
            />
          </label>

          {youtubeId(editing.youtube_url) && (
            <div className="panel">
              <strong>YouTube Video Preview</strong>

              <div style={{ marginTop: 12 }}>
                <img
                  src={`https://img.youtube.com/vi/${youtubeId(
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

              <p style={{ fontSize: 13 }}>
                This thumbnail will be used as the
                programme poster if no image is saved.
              </p>
            </div>
          )}

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginTop: 20,
            }}
          >
            <input
              type="checkbox"
              checked={editing.is_published}
              onChange={(e) =>
                update('is_published', e.target.checked)
              }
            />
            Publish — Visible to Devotees
          </label>

          <div className="actions">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setEditing(null);
                setSelectedFile(null);
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="primary"
              disabled={busy}
            >
              {busy
                ? 'Uploading / Saving...'
                : editing.id
                  ? 'Save Changes'
                  : 'Create Programme'}
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
            placeholder="Search programmes"
            aria-label="Search programmes"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            value={filter}
            onChange={(e) =>
              setFilter(e.target.value as typeof filter)
            }
          >
            <option value="all">All Programmes</option>
            <option value="upcoming">Upcoming</option>
            <option value="ongoing">Ongoing</option>
            <option value="completed">Completed</option>
          </select>

          <span>{filtered.length} programmes</span>
        </div>
      </div>

      {loading ? (
        <div className="panel">
          Loading programmes...
        </div>
      ) : filtered.length === 0 ? (
        <div className="panel">
          No programmes found.
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Poster</th>
                <th>Programme</th>
                <th>Date / Venue</th>
                <th>Programme Status</th>
                <th>Publication</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((item) => {
                const thumbnail = getPoster(
                  item.image_url,
                  item.youtube_url
                );

                return (
                  <tr key={item.id}>
                    <td>
                      {thumbnail ? (
                        <img
                          src={thumbnail}
                          alt={item.title}
                          style={{
                            width: 120,
                            borderRadius: 8,
                          }}
                        />
                      ) : (
                        <span>No Image</span>
                      )}
                    </td>

                    <td>
                      <strong>{item.title}</strong>

                      <div>
                        <small>
                          {item.description.slice(0, 110)}
                          {item.description.length > 110
                            ? '…'
                            : ''}
                        </small>
                      </div>

                      {item.youtube_url && (
                        <div>
                          <a
                            href={item.youtube_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            View YouTube Video
                          </a>
                        </div>
                      )}
                    </td>

                    <td>
                      <div>
                        {displayDate(item.start_date)}
                      </div>

                      {item.start_time && (
                        <small>
                          {timeInput(item.start_time)}
                        </small>
                      )}

                      {item.venue && (
                        <div>
                          <small>{item.venue}</small>
                        </div>
                      )}
                    </td>

                    <td>
                      <span className="badge">
                        {item.status.charAt(0).toUpperCase() +
                          item.status.slice(1)}
                      </span>
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
