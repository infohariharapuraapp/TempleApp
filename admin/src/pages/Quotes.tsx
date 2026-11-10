
import React, { useEffect, useState } from 'react';
import { apiRequest } from '../lib/api';

type Quote = {
  id: number;
  title: string | null;
  quote_text: string;
  author: string | null;
  language: string;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
};

type QuoteForm = {
  id?: number;
  title: string;
  quote_text: string;
  author: string;
  language: string;
  is_published: boolean;
};

type ApiResponse = {
  success: boolean;
  data: Quote[];
};

const emptyForm: QuoteForm = {
  title: '',
  quote_text: '',
  author: '',
  language: 'Kannada',
  is_published: false,
};

function formatDate(value: string | null) {
  if (!value) return 'Not published';

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? 'Unknown'
    : date.toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
}

export default function Quotes() {
  const [items, setItems] = useState<Quote[]>([]);
  const [editing, setEditing] = useState<QuoteForm | null>(null);
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

      const response = await apiRequest<ApiResponse>(
        '/admin/quotes'
      );

      if (!response.success || !Array.isArray(response.data)) {
        throw new Error('Invalid Quotes API response.');
      }

      setItems(response.data);
      setError('');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load quotes.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function openAdd() {
    setEditing({ ...emptyForm });
    setError('');
    setSuccess('');
  }

  function openEdit(item: Quote) {
    setEditing({
      id: item.id,
      title: item.title || '',
      quote_text: item.quote_text,
      author: item.author || '',
      language: item.language || 'Kannada',
      is_published: item.is_published,
    });

    setError('');
    setSuccess('');
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();

    if (!editing || busy) return;

    if (!editing.quote_text.trim()) {
      setError('Quote text is required.');
      return;
    }

    setBusy(true);
    setError('');
    setSuccess('');

    try {
      const isEdit = editing.id !== undefined;

      await apiRequest(
        isEdit
          ? `/admin/quotes/${editing.id}`
          : '/admin/quotes',
        {
          method: isEdit ? 'PUT' : 'POST',
          body: JSON.stringify({
            title: editing.title.trim() || null,
            quote_text: editing.quote_text.trim(),
            author: editing.author.trim() || null,
            language: editing.language,
            is_published: editing.is_published,
          }),
        }
      );

      setEditing(null);
      await load();

      setSuccess(
        isEdit
          ? 'Quote updated successfully.'
          : 'Quote created successfully.'
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to save quote.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function togglePublish(item: Quote) {
    if (busy) return;

    const nextStatus = !item.is_published;
    const action = nextStatus ? 'publish' : 'unpublish';

    if (
      !window.confirm(
        `Are you sure you want to ${action} this quote?`
      )
    ) {
      return;
    }

    setBusy(true);
    setError('');
    setSuccess('');

    try {
      await apiRequest(`/admin/quotes/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          is_published: nextStatus,
        }),
      });

      await load();

      setSuccess(
        nextStatus
          ? 'Quote published successfully.'
          : 'Quote unpublished successfully.'
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to update quote status.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function deleteQuote(item: Quote) {
    if (busy) return;

    if (
      !window.confirm(
        'Permanently delete this quote?\n\nThis action cannot be undone.'
      )
    ) {
      return;
    }

    setBusy(true);
    setError('');
    setSuccess('');

    try {
      await apiRequest(`/admin/quotes/${item.id}`, {
        method: 'DELETE',
      });

      await load();
      setSuccess('Quote deleted successfully.');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to delete quote.'
      );
    } finally {
      setBusy(false);
    }
  }

  const filtered = [...items]
    .filter((item) => {
      if (filter === 'published' && !item.is_published) {
        return false;
      }

      if (filter === 'draft' && item.is_published) {
        return false;
      }

      const query = search.trim().toLowerCase();

      return (
        !query ||
        [
          item.title,
          item.quote_text,
          item.author,
          item.language,
        ].some((value) =>
          (value || '').toLowerCase().includes(query)
        )
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

  const publishedCount = items.filter(
    (item) => item.is_published
  ).length;

  return (
    <main className="content">
      <div className="page-head">
        <div>
          <h2>Manage Spiritual Quotes</h2>
          <p>
            Add and publish spiritual messages displayed
            in the Pravachana & Quotes section of the app.
          </p>
        </div>

        <button
          type="button"
          className="primary"
          onClick={openAdd}
          disabled={busy}
        >
          + Add Quote
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

      <div
        className="stats"
        style={{ marginBottom: 20 }}
      >
        <div className="stat">
          <span>Total Quotes</span>
          <strong>{items.length}</strong>
        </div>

        <div className="stat">
          <span>Published</span>
          <strong>{publishedCount}</strong>
        </div>

        <div className="stat">
          <span>Drafts</span>
          <strong>{items.length - publishedCount}</strong>
        </div>
      </div>

      {editing && (
        <form className="form-card" onSubmit={save}>
          <h3>
            {editing.id
              ? 'Edit Spiritual Quote'
              : 'Add New Spiritual Quote'}
          </h3>

          <label>
            Quote Title (Optional)
            <input
              maxLength={255}
              value={editing.title}
              placeholder="The Path of Dharma"
              onChange={(e) =>
                setEditing({
                  ...editing,
                  title: e.target.value,
                })
              }
            />
          </label>

          <label>
            Quote Text *
            <textarea
              required
              rows={5}
              maxLength={5000}
              value={editing.quote_text}
              placeholder="Enter the spiritual quote..."
              onChange={(e) =>
                setEditing({
                  ...editing,
                  quote_text: e.target.value,
                })
              }
            />
          </label>

          <div className="grid2">
            <label>
              Guru / Author Name
              <input
                maxLength={255}
                value={editing.author}
                placeholder="Sri Sri Mahaswamiji"
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    author: e.target.value,
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
          </div>

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

          <div className="panel">
            <h3>Mobile App Preview</h3>

            <div
              style={{
                marginTop: 12,
                padding: 24,
                borderRadius: 16,
                background:
                  'linear-gradient(135deg, #71321F, #9B512B, #63251E)',
                color: '#FFFFFF',
                textAlign: 'center',
                maxWidth: 440,
              }}
            >
              <div
                style={{
                  fontSize: 46,
                  color: '#F1C477',
                  textAlign: 'left',
                  lineHeight: 1,
                }}
              >
                “
              </div>

              <p
                style={{
                  fontSize: 17,
                  lineHeight: 1.7,
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'anywhere',
                }}
              >
                {editing.quote_text ||
                  'Your spiritual quote will appear here.'}
              </p>

              <p
                style={{
                  color: '#F1C477',
                  fontWeight: 700,
                  marginTop: 15,
                }}
              >
                — {editing.author || 'Temple Teachings'}
              </p>
            </div>
          </div>

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
                  : 'Create Quote'}
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
            placeholder="Search quotes"
            aria-label="Search quotes"
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            value={filter}
            onChange={(e) =>
              setFilter(e.target.value as typeof filter)
            }
          >
            <option value="all">All Quotes</option>
            <option value="published">Published</option>
            <option value="draft">Drafts</option>
          </select>

          <span>{filtered.length} quotes</span>
        </div>
      </div>

      {loading ? (
        <div className="panel">Loading quotes...</div>
      ) : filtered.length === 0 ? (
        <div className="panel">
          No quotes found. Add your first spiritual quote.
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Quote / Title</th>
                <th>Author</th>
                <th>Language</th>
                <th>Published</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td>
                    {item.title && (
                      <strong>{item.title}</strong>
                    )}

                    <div>
                      <small>
                        {item.quote_text.length > 160
                          ? `${item.quote_text.slice(0, 160)}…`
                          : item.quote_text}
                      </small>
                    </div>
                  </td>

                  <td>{item.author || '—'}</td>
                  <td>{item.language}</td>
                  <td>{formatDate(item.published_at)}</td>

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
                        onClick={() => openEdit(item)}
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
                        onClick={() =>
                          void deleteQuote(item)
                        }
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
