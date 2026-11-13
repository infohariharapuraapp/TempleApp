
import React, { useEffect, useState } from 'react';
import { apiRequest } from '../lib/api';

type GuruVaniItem = {
  id: number;
  title: string;
  sloka: string;
  transliteration: string | null;
  meaning: string | null;
  guru_name: string | null;
  is_active: boolean;
  published_at: string;
};

type GuruVaniForm = {
  id?: number;
  title: string;
  sloka: string;
  transliteration: string;
  meaning: string;
  guru_name: string;
  is_active: boolean;
};

const emptyForm: GuruVaniForm = {
  title: '',
  sloka: '',
  transliteration: '',
  meaning: '',
  guru_name: '',
  is_active: true,
};

export default function GuruVani() {
  const [items, setItems] = useState<GuruVaniItem[]>([]);
  const [editing, setEditing] = useState<GuruVaniForm | null>(null);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');

  const [filter, setFilter] =
    useState<'all' | 'active' | 'inactive'>('all');

  const isProcessing = busy || deletingId !== null;

  async function load() {
    try {
      setLoading(true);

      const response = await apiRequest<{
        success: boolean;
        data: GuruVaniItem[];
      }>('/admin/guru-vani');

      setItems(response.data || []);
      setError('');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load Guru Vani'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function openAdd() {
    if (isProcessing) return;

    setEditing({ ...emptyForm });
    setError('');
    setSuccess('');
  }

  function openEdit(item: GuruVaniItem) {
    if (isProcessing) return;

    setEditing({
      id: item.id,
      title: item.title,
      sloka: item.sloka,
      transliteration: item.transliteration || '',
      meaning: item.meaning || '',
      guru_name: item.guru_name || '',
      is_active: item.is_active,
    });

    setError('');
    setSuccess('');

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();

    if (!editing || isProcessing) return;

    if (!editing.title.trim() || !editing.sloka.trim()) {
      setError('Title and sloka are required.');
      return;
    }

    setBusy(true);
    setError('');
    setSuccess('');

    try {
      const isEdit = Boolean(editing.id);

      await apiRequest(
        isEdit
          ? `/admin/guru-vani/${editing.id}`
          : '/admin/guru-vani',
        {
          method: isEdit ? 'PUT' : 'POST',
          body: JSON.stringify({
            title: editing.title.trim(),
            sloka: editing.sloka.trim(),
            transliteration:
              editing.transliteration.trim() || null,
            meaning: editing.meaning.trim() || null,
            guru_name: editing.guru_name.trim() || null,
            ...(!isEdit
              ? { is_active: editing.is_active }
              : {}),
          }),
        }
      );

      // Preserve the existing separate status API.
      if (isEdit) {
        const original = items.find(
          item => item.id === editing.id
        );

        if (
          original &&
          original.is_active !== editing.is_active
        ) {
          await apiRequest(
            `/admin/guru-vani/${editing.id}/status`,
            {
              method: 'PATCH',
              body: JSON.stringify({
                is_active: editing.is_active,
              }),
            }
          );
        }
      }

      setEditing(null);
      await load();

      setSuccess(
        isEdit
          ? 'Guru Vani updated successfully.'
          : 'Guru Vani created successfully.'
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to save Guru Vani'
      );
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(item: GuruVaniItem) {
    if (isProcessing) return;

    const action = item.is_active
      ? 'deactivate'
      : 'activate';

    const confirmed = window.confirm(
      `Do you want to ${action} "${item.title}"?`
    );

    if (!confirmed) return;

    setBusy(true);
    setError('');
    setSuccess('');

    try {
      await apiRequest(
        `/admin/guru-vani/${item.id}/status`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            is_active: !item.is_active,
          }),
        }
      );

      await load();

      setSuccess(
        `Guru Vani ${item.is_active ? 'deactivated' : 'activated'} successfully.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to update Guru Vani status'
      );
    } finally {
      setBusy(false);
    }
  }

  // ==========================================
  // PERMANENT DELETE
  // ==========================================

  async function deleteGuruVani(item: GuruVaniItem) {
    if (isProcessing) return;

    const confirmed = window.confirm(
      `Permanently delete "${item.title}"?\n\n` +
      'This will remove the Guru Vani entry from the database.\n' +
      'This action cannot be undone.\n\n' +
      'Click OK to delete or Cancel to keep it.'
    );

    if (!confirmed) return;

    setDeletingId(item.id);
    setError('');
    setSuccess('');

    try {
      await apiRequest(
        `/admin/guru-vani/${item.id}`,
        {
          method: 'DELETE',
        }
      );

      // Remove from UI only after backend confirms success.
      setItems(previous =>
        previous.filter(entry => entry.id !== item.id)
      );

      if (editing?.id === item.id) {
        setEditing(null);
      }

      setSuccess(
        `"${item.title}" deleted successfully.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to delete Guru Vani'
      );
    } finally {
      setDeletingId(null);
    }
  }

  // ==========================================
  // SEARCH AND FILTER
  // ==========================================

  const filtered = items
    .filter(item => {
      if (filter === 'active' && !item.is_active) {
        return false;
      }

      if (filter === 'inactive' && item.is_active) {
        return false;
      }

      const q = search.trim().toLowerCase();

      return (
        !q ||
        [
          item.title,
          item.sloka,
          item.transliteration,
          item.guru_name,
          item.meaning,
        ].some(value =>
          (value || '').toLowerCase().includes(q)
        )
      );
    })
    .sort(
      (a, b) =>
        new Date(b.published_at).getTime() -
          new Date(a.published_at).getTime() ||
        b.id - a.id
    );

  return (
    <main className="content">
      <div className="page-head">
        <div>
          <h2>Manage Guru Vani</h2>
          <p>
            Manage spiritual slokas and teachings
            displayed in the devotee app.
          </p>
        </div>

        <button
          type="button"
          className="primary"
          onClick={openAdd}
          disabled={isProcessing}
        >
          + Add Guru Vani
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

      {/* ADD / EDIT FORM */}

      {editing && (
        <form className="form-card" onSubmit={save}>
          <h3>
            {editing.id
              ? 'Edit Guru Vani'
              : 'Add New Guru Vani'}
          </h3>

          <label>
            Title *
            <input
              required
              maxLength={255}
              value={editing.title}
              placeholder="Guru Stotram"
              onChange={e =>
                setEditing({
                  ...editing,
                  title: e.target.value,
                })
              }
            />
          </label>

          <label>
            Sloka *
            <textarea
              required
              rows={5}
              value={editing.sloka}
              placeholder="Enter the original sloka"
              onChange={e =>
                setEditing({
                  ...editing,
                  sloka: e.target.value,
                })
              }
            />
          </label>

          <label>
            Transliteration (Optional)
            <textarea
              rows={3}
              value={editing.transliteration}
              placeholder="Enter pronunciation in English letters"
              onChange={e =>
                setEditing({
                  ...editing,
                  transliteration: e.target.value,
                })
              }
            />
          </label>

          <label>
            Meaning (Optional)
            <textarea
              rows={4}
              value={editing.meaning}
              placeholder="Enter meaning if available"
              onChange={e =>
                setEditing({
                  ...editing,
                  meaning: e.target.value,
                })
              }
            />
          </label>

          <label>
            Guru Name (Optional)
            <input
              maxLength={255}
              value={editing.guru_name}
              placeholder="Guru name"
              onChange={e =>
                setEditing({
                  ...editing,
                  guru_name: e.target.value,
                })
              }
            />
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
              checked={editing.is_active}
              onChange={e =>
                setEditing({
                  ...editing,
                  is_active: e.target.checked,
                })
              }
            />
            Active — Visible to devotees
          </label>

          <div className="actions">
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => setEditing(null)}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="primary"
              disabled={isProcessing}
            >
              {busy
                ? 'Saving...'
                : editing.id
                  ? 'Save Changes'
                  : 'Create Guru Vani'}
            </button>
          </div>
        </form>
      )}

      {/* SEARCH AND FILTER */}

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
            placeholder="Search Guru Vani"
            aria-label="Search Guru Vani"
            onChange={e => setSearch(e.target.value)}
          />

          <select
            value={filter}
            onChange={e =>
              setFilter(
                e.target.value as typeof filter
              )
            }
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <span>{filtered.length} slokas</span>
        </div>
      </div>

      {/* GURU VANI TABLE */}

      {loading ? (
        <div className="panel">
          Loading Guru Vani...
        </div>
      ) : filtered.length === 0 ? (
        <div className="panel">
          No Guru Vani slokas found.
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Title / Sloka</th>
                <th>Meaning</th>
                <th>Published</th>
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
                        {item.sloka.length > 110
                          ? item.sloka.slice(0, 110) + '…'
                          : item.sloka}
                      </small>
                    </div>

                    {item.guru_name && (
                      <small>{item.guru_name}</small>
                    )}
                  </td>

                  <td>
                    {item.meaning
                      ? item.meaning.length > 100
                        ? item.meaning.slice(0, 100) + '…'
                        : item.meaning
                      : '—'}
                  </td>

                  <td>
                    {new Date(
                      item.published_at
                    ).toLocaleDateString()}
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
                        disabled={isProcessing}
                        onClick={() => openEdit(item)}
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        disabled={isProcessing}
                        className={
                          item.is_active ? 'danger' : ''
                        }
                        onClick={() =>
                          void changeStatus(item)
                        }
                      >
                        {item.is_active
                          ? 'Deactivate'
                          : 'Activate'}
                      </button>

                      <button
                        type="button"
                        className="danger"
                        disabled={isProcessing}
                        onClick={() =>
                          void deleteGuruVani(item)
                        }
                      >
                        {deletingId === item.id
                          ? 'Deleting...'
                          : 'Delete'}
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
