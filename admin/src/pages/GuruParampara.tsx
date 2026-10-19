import React, { useEffect, useState } from 'react';
import { apiRequest } from '../lib/api';

type Guru = {
  id: number;
  name: string;
  title: string | null;
  image_url: string | null;
  verse: string | null;
  transliteration: string | null;
  translation: string | null;
  display_order: number;
  is_active: boolean;
};

type GuruForm = Omit<Guru, 'id'> & {
  id?: number;
};

type ApiResponse = {
  success: boolean;
  data: Guru[];
};

const emptyForm = (): GuruForm => ({
  name: '',
  title: '',
  image_url: '',
  verse: '',
  transliteration: '',
  translation: '',
  display_order: 0,
  is_active: true,
});

export default function GuruParampara() {
  const [items, setItems] = useState<Guru[]>([]);
  const [editing, setEditing] = useState<GuruForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  async function load() {
    try {
      setError('');

      const response = await apiRequest<ApiResponse>(
        '/admin/guru-parampara'
      );

      setItems(response.data || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load Gurus'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function startAdd() {
    setError('');
    setEditing({
      ...emptyForm(),
      display_order: items.length + 1,
    });
  }

  function startEdit(guru: Guru) {
    setError('');
    setEditing({ ...guru });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();

    if (!editing || busy) return;

    if (!editing.name.trim()) {
      setError('Guru name is required.');
      return;
    }

    if (
      !Number.isSafeInteger(editing.display_order) ||
      editing.display_order < 0
    ) {
      setError('Display order must be a non-negative integer.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      const endpoint = editing.id
        ? `/admin/guru-parampara/${editing.id}`
        : '/admin/guru-parampara';

      await apiRequest(endpoint, {
        method: editing.id ? 'PUT' : 'POST',
        body: JSON.stringify({
          name: editing.name.trim(),
          title: editing.title?.trim() || null,
          image_url: editing.image_url?.trim() || null,
          verse: editing.verse?.trim() || null,
          transliteration:
            editing.transliteration?.trim() || null,
          translation: editing.translation?.trim() || null,
          display_order: editing.display_order,
          is_active: editing.is_active,
        }),
      });

      setEditing(null);
      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to save Guru'
      );
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(guru: Guru) {
    if (busy) return;

    setBusy(true);
    setError('');

    try {
      await apiRequest(
        `/admin/guru-parampara/${guru.id}/status`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            is_active: !guru.is_active,
          }),
        }
      );

      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to update status'
      );
    } finally {
      setBusy(false);
    }
  }

  async function deleteGuru(guru: Guru) {
    if (busy) return;

    if (
      !window.confirm(
        `Permanently delete "${guru.name}"? This cannot be undone.`
      )
    ) {
      return;
    }

    setBusy(true);
    setError('');

    try {
      await apiRequest(
        `/admin/guru-parampara/${guru.id}`,
        { method: 'DELETE' }
      );

      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to delete Guru'
      );
    } finally {
      setBusy(false);
    }
  }

  const filtered = items
    .filter((guru) =>
      `${guru.name} ${guru.title || ''}`
        .toLowerCase()
        .includes(search.toLowerCase())
    )
    .sort(
      (a, b) =>
        a.display_order - b.display_order ||
        a.id - b.id
    );

  return (
  <main className="content guru-parampara-page">
      <div className="page-head">
        <div>
          <h1>Guru Parampara</h1>
          <p>
            Manage the sacred lineage displayed in the devotee app.
          </p>
        </div>

        <button
          type="button"
          className="primary"
          disabled={busy}
          onClick={startAdd}
        >
          + Add Guru
        </button>
      </div>

      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}

      {editing && (
       <form className="form-card guru-parampara-form" onSubmit={save}>
          <h3>
            {editing.id ? 'Edit Guru' : 'Add Guru'}
          </h3>

          <div className="grid2">
            <label>
              Guru Name
              <input
                required
                maxLength={255}
                value={editing.name}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    name: e.target.value,
                  })
                }
              />
            </label>

            <label>
              Guru Title
              <input
                maxLength={150}
                value={editing.title || ''}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    title: e.target.value,
                  })
                }
                placeholder="MAHASWAMIJI"
              />
            </label>
          </div>

          <div className="grid2">
            <label>
              Image URL
              <input
                type="url"
                value={editing.image_url || ''}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    image_url: e.target.value,
                  })
                }
                placeholder="https://example.com/guru.jpg"
              />
            </label>

            <label>
              Display Order
              <input
                type="number"
                min="0"
                step="1"
                value={editing.display_order}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    display_order: Number(e.target.value),
                  })
                }
              />
            </label>
          </div>

          <label>
            Sanskrit Verse
            <textarea
              rows={4}
              value={editing.verse || ''}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  verse: e.target.value,
                })
              }
            />
          </label>

          <label>
            Transliteration
            <textarea
              rows={4}
              value={editing.transliteration || ''}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  transliteration: e.target.value,
                })
              }
            />
          </label>

          <label>
            Translation / Meaning
            <textarea
              rows={5}
              value={editing.translation || ''}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  translation: e.target.value,
                })
              }
            />
          </label>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <input
              type="checkbox"
              checked={editing.is_active}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  is_active: e.target.checked,
                })
              }
            />
            Active
          </label>

          {editing.image_url && (
            <div style={{ marginTop: 12 }}>
              <p>Image Preview</p>
              <img
                src={editing.image_url}
                alt="Guru preview"
                style={{
                  maxWidth: 220,
                  maxHeight: 180,
                  objectFit: 'contain',
                  borderRadius: 12,
                }}
              />
            </div>
          )}

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
                ? 'Saving…'
                : editing.id
                  ? 'Save Changes'
                  : 'Create Guru'}
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
            placeholder="Search Guru"
            aria-label="Search Guru"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <span>{filtered.length} records</span>
        </div>
      </div>

      {loading ? (
        <p>Loading Guru Parampara...</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Image</th>
                <th>Name</th>
                <th>Title</th>
                <th>Order</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((guru) => (
                <tr key={guru.id}>
                  <td>
                    {guru.image_url ? (
                      <img
                        className="thumb"
                        src={guru.image_url}
                        alt={guru.name}
                      />
                    ) : (
                      <div className="thumb empty">—</div>
                    )}
                  </td>

                  <td>
                    <strong>{guru.name}</strong>
                  </td>

                  <td>{guru.title || '—'}</td>

                  <td>{guru.display_order}</td>

                  <td>
                    <span className="badge">
                      {guru.is_active
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
                        onClick={() => startEdit(guru)}
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void changeStatus(guru)
                        }
                      >
                        {guru.is_active
                          ? 'Deactivate'
                          : 'Activate'}
                      </button>

                      <button
                        type="button"
                        className="danger"
                        disabled={busy}
                        onClick={() =>
                          void deleteGuru(guru)
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    No Guru records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
     </main>
  );
}