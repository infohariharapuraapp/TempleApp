
import React, { useEffect, useState } from 'react';
import { apiRequest } from '../lib/api';

type Slokam = {
  id: number;
  title: string;
  audio_url: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type SlokamForm = {
  id?: number;
  title: string;
  audio_url: string;
};

const MAX_AUDIO_SIZE = 15 * 1024 * 1024;

export default function WelcomeSlokams() {
  const [items, setItems] = useState<Slokam[]>([]);
  const [editing, setEditing] = useState<SlokamForm | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');

  async function load() {
    try {
      const response = await apiRequest<{
        success: boolean;
        data: Slokam[];
      }>('/admin/welcome-slokams');

      setItems(response.data || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load Slokam Library'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function openAdd() {
    setEditing({
      title: '',
      audio_url: '',
    });
    setSelectedFile(null);
    setError('');
    setSuccess('');
  }

  function openEdit(item: Slokam) {
    setEditing({
      id: item.id,
      title: item.title,
      audio_url: item.audio_url,
    });
    setSelectedFile(null);
    setError('');
    setSuccess('');
  }

  function selectAudio(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (
      !file.name.toLowerCase().endsWith('.mp3') ||
      !['audio/mpeg', 'audio/mp3', ''].includes(file.type)
    ) {
      setError('Please select an MP3 audio file.');
      event.target.value = '';
      return;
    }

    if (file.size > MAX_AUDIO_SIZE) {
      setError('MP3 must be 15 MB or smaller.');
      event.target.value = '';
      return;
    }

    setSelectedFile(file);
    setError('');
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();

    if (!editing || busy) return;

    if (!editing.title.trim()) {
      setError('Slokam title is required.');
      return;
    }

    if (!selectedFile && !editing.audio_url.trim()) {
      setError('Please select an MP3 or enter an audio URL.');
      return;
    }

    setBusy(true);
    setError('');
    setSuccess('');

    try {
      let audioUrl = editing.audio_url.trim();

      if (selectedFile) {
        const formData = new FormData();
        formData.append('audio', selectedFile);

        const upload = await apiRequest<{
          success: boolean;
          data: {
            audio_url: string;
            public_id: string;
          };
        }>('/admin/welcome-slokams/upload', {
          method: 'POST',
          body: formData,
        });

        audioUrl = upload.data.audio_url;
      }

      const isEdit = Boolean(editing.id);

      await apiRequest(
        isEdit
          ? `/admin/welcome-slokams/${editing.id}`
          : '/admin/welcome-slokams',
        {
          method: isEdit ? 'PUT' : 'POST',
          body: JSON.stringify({
            title: editing.title.trim(),
            audio_url: audioUrl,
          }),
        }
      );

      setEditing(null);
      setSelectedFile(null);

      await load();

      setSuccess(
        isEdit
          ? 'Slokam updated successfully.'
          : 'Slokam added to the library.'
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save Slokam'
      );
    } finally {
      setBusy(false);
    }
  }

  async function activate(item: Slokam) {
    if (busy || item.is_active) return;

    if (
      !window.confirm(
        `Set "${item.title}" as the Welcome Slokam?`
      )
    ) {
      return;
    }

    setBusy(true);
    setError('');
    setSuccess('');

    try {
      await apiRequest(
        `/admin/welcome-slokams/${item.id}/activate`,
        { method: 'PATCH' }
      );

      await load();

      setSuccess(
        `"${item.title}" is now the active Welcome Slokam.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to activate Slokam'
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: Slokam) {
    if (busy) return;

    if (
      !window.confirm(
        `Delete "${item.title}" from the library?`
      )
    ) {
      return;
    }

    setBusy(true);
    setError('');
    setSuccess('');

    try {
      await apiRequest(
        `/admin/welcome-slokams/${item.id}`,
        { method: 'DELETE' }
      );

      await load();

      setSuccess(
        'Slokam removed from the library.'
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to delete Slokam'
      );
    } finally {
      setBusy(false);
    }
  }

  const active = items.find(item => item.is_active);

  const filtered = items.filter(item =>
    item.title
      .toLowerCase()
      .includes(search.trim().toLowerCase())
  );

  return (
    <main className="content">
      <div className="page-head">
        <div>
          <h2>Welcome Slokam Library</h2>
          <p>
            Manage the audio Slokam played when devotees
            open the Temple App Home screen.
          </p>
        </div>

        <button
          type="button"
          className="primary"
          onClick={openAdd}
          disabled={busy}
        >
          + Add Slokam
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

      <div className="panel">
        <h3>Currently Selected Slokam</h3>

        {active ? (
          <>
            <strong>{active.title}</strong>

            <div style={{ marginTop: 14 }}>
              <audio
                controls
                preload="none"
                src={active.audio_url}
                style={{
                  width: '100%',
                  maxWidth: 500,
                }}
              />
            </div>

            <p>
              This is the Slokam selected for the
              devotee app.
            </p>
          </>
        ) : (
          <p>
            No active Slokam selected yet.
          </p>
        )}
      </div>

      {editing && (
        <form className="form-card" onSubmit={save}>
          <h3>
            {editing.id
              ? 'Edit Welcome Slokam'
              : 'Add Welcome Slokam'}
          </h3>

          <label>
            Slokam Title *
            <input
              required
              maxLength={255}
              value={editing.title}
              placeholder="Shiv Rudrashtakam"
              onChange={event =>
                setEditing({
                  ...editing,
                  title: event.target.value,
                })
              }
            />
          </label>

          <label>
            Upload MP3 Audio
            <input
              type="file"
              accept=".mp3,audio/mpeg"
              onChange={selectAudio}
            />
          </label>

          {selectedFile && (
            <p>
              Selected: {selectedFile.name}
            </p>
          )}

          <label>
            Audio URL
            <input
              type="url"
              value={editing.audio_url}
              placeholder="https://res.cloudinary.com/..."
              onChange={event =>
                setEditing({
                  ...editing,
                  audio_url: event.target.value,
                })
              }
            />
          </label>

          <p>
            Upload an MP3 file or provide an existing
            HTTPS audio URL. Uploading a new file will
            replace the URL in this Slokam entry.
          </p>

          {editing.audio_url && !selectedFile && (
            <audio
              controls
              preload="none"
              src={editing.audio_url}
              style={{ width: '100%', maxWidth: 500 }}
            />
          )}

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
                ? 'Saving...'
                : editing.id
                  ? 'Save Changes'
                  : 'Add to Library'}
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
            value={search}
            placeholder="Search Slokams"
            aria-label="Search Slokams"
            onChange={event =>
              setSearch(event.target.value)
            }
          />

          <span>
            {filtered.length} Slokams
          </span>
        </div>
      </div>

      {loading ? (
        <div className="panel">
          Loading Slokam Library...
        </div>
      ) : filtered.length === 0 ? (
        <div className="panel">
          No Slokams found. Click Add Slokam to begin.
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Slokam</th>
                <th>Audio Preview</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map(item => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.title}</strong>
                    <div>
                      <small>
                        Added:{' '}
                        {new Date(
                          item.created_at
                        ).toLocaleDateString()}
                      </small>
                    </div>
                  </td>

                  <td>
                    <audio
                      controls
                      preload="none"
                      src={item.audio_url}
                      style={{
                        width: '100%',
                        maxWidth: 260,
                      }}
                    />
                  </td>

                  <td>
                    <span className="badge">
                      {item.is_active
                        ? 'Active'
                        : 'Inactive'}
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
                        onClick={() => openEdit(item)}
                      >
                        Edit
                      </button>

                      {!item.is_active && (
                        <button
                          type="button"
                          className="primary"
                          disabled={busy}
                          onClick={() => void activate(item)}
                        >
                          Set Active
                        </button>
                      )}

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
