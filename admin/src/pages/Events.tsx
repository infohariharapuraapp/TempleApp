
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { apiRequest } from '../lib/api';

type EventVideo = {
  id?: number;
  title?: string | null;
  youtube_url: string;
  youtube_video_id?: string;
  display_order?: number;
};

type EventVideoDraft = {
  key: string;
  title: string;
  youtube_url: string;
};

type EventItem = {
  id: number;
  title: string;
  description?: string | null;
  image_url?: string | null;
  event_date?: string | null;
  event_end_date?: string | null;
  images?: Array<string | { image_url: string }>;
  videos?: EventVideo[];
  start_time?: string | null;
  end_time?: string | null;
  location?: string | null;
  category_id?: number | null;
  category_name?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

type EventCategory = {
  id: number;
  name: string;
  name_en?: string | null;
  name_te?: string | null;
  name_kn?: string | null;
  name_hi?: string | null;
  name_ta?: string | null;
  is_active: boolean;
};

type ApiList<T> = {
  success: boolean;
  data: T[];
};

type StatusFilter = 'all' | 'published' | 'unpublished';
type SortOrder = 'upcoming' | 'newest' | 'oldest';

const messageOf = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const datePart = (value?: string | null) =>
  value?.substring(0, 10) || '';

const timePart = (value?: string | null) =>
  value?.substring(0, 5) || '';

const displayTime = (
  start?: string | null,
  end?: string | null
) => {
  const a = timePart(start);
  const b = timePart(end);

  return a && b
    ? `${a} – ${b}`
    : a
      ? `Starts at ${a}`
      : b
        ? `Ends at ${b}`
        : '—';
};

const IMAGE_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.webp', '.gif',
  '.bmp', '.tif', '.tiff', '.heic', '.heif', '.avif',
];

const IMAGE_ACCEPT = IMAGE_EXTENSIONS.join(',');
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const MAX_EVENT_VIDEOS = 10;

let nextVideoKey = 0;

function createVideoKey() {
  nextVideoKey += 1;
  return 'video-' + nextVideoKey;
}

function extractEventYouTubeId(
  value: string
): string | null {
  try {
    const url = new URL(value.trim());

    if (
      !['https:', 'http:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.port
    ) {
      return null;
    }

    const host = url.hostname.toLowerCase();

    const parts = url.pathname
      .split('/')
      .filter(Boolean);

    let id: string | null = null;

    if (host === 'youtu.be') {
      id = parts[0] || null;
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
      } else if (
        ['embed', 'shorts', 'live', 'v']
          .includes(parts[0])
      ) {
        id = parts[1] || null;
      }
    }

    return id && /^[A-Za-z0-9_-]{11}$/.test(id)
      ? id
      : null;
  } catch {
    return null;
  }
}

const filterControlStyle: React.CSSProperties = {
  width: '100%',
  minWidth: 0,
  padding: '11px 12px',
  border: '1px solid #E5D9C9',
  borderRadius: 8,
  backgroundColor: '#FFFFFF',
  color: '#392D27',
  fontSize: 14,
  boxSizing: 'border-box',
};

const filterLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  marginBottom: 7,
  color: '#6B5C50',
};

export default function Events() {
  const [items, setItems] = useState<EventItem[]>([]);
  const [categories, setCategories] = useState<EventCategory[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] =
    useState<EventItem | null>(null);

  const [manageCategories, setManageCategories] = useState(false);

  const [categoryNames, setCategoryNames] = useState({
    name_en: '',
    name_te: '',
    name_kn: '',
    name_hi: '',
    name_ta: '',
  });

  const categoryLanguages = [
    {
      key: 'name_en',
      label: 'English',
      placeholder: 'e.g. Festivals',
      required: true,
    },
    {
      key: 'name_te',
      label: 'Telugu',
      placeholder: 'ఉదా. పండుగలు',
    },
    {
      key: 'name_kn',
      label: 'Kannada',
      placeholder: 'ಉದಾ. ಹಬ್ಬಗಳು',
    },
    {
      key: 'name_hi',
      label: 'Hindi',
      placeholder: 'जैसे त्योहार',
    },
    {
      key: 'name_ta',
      label: 'Tamil',
      placeholder: 'எ.கா. திருவிழாக்கள்',
    },
  ] as const;

  const [editingCategory, setEditingCategory] =
    useState<EventCategory | null>(null);

  const [categoryBusy, setCategoryBusy] = useState(false);
  const [statusBusy, setStatusBusy] = useState<number | null>(null);
  const [deleteBusy, setDeleteBusy] = useState<number | null>(null);

  // Search, filters and sorting
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortOrder, setSortOrder] =
    useState<SortOrder>('upcoming');

  async function loadEvents() {
    const result = await apiRequest<ApiList<EventItem>>(
      '/admin/events'
    );

    setItems(result.data || []);
  }

  async function loadCategories() {
    const result = await apiRequest<ApiList<EventCategory>>(
      '/admin/event-categories'
    );

    setCategories(result.data || []);
  }

  async function refresh() {
    try {
      setLoading(true);
      setError('');

      await Promise.all([
        loadEvents(),
        loadCategories(),
      ]);
    } catch (err) {
      setError(
        messageOf(err, 'Failed to load events or categories')
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function openAddForm() {
    setEditingEvent(null);
    setShowForm(true);
    setManageCategories(false);
  }

  function openEditForm(event: EventItem) {
    setEditingEvent(event);
    setShowForm(true);
    setManageCategories(false);
  }

  async function toggleStatus(event: EventItem) {
    try {
      setStatusBusy(event.id);
      setError('');

      await apiRequest(`/admin/events/${event.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          is_active: !event.is_active,
        }),
      });

      await loadEvents();
    } catch (err) {
      setError(
        messageOf(err, 'Failed to update event status')
      );
    } finally {
      setStatusBusy(null);
    }
  }

  async function handleDeleteEvent(event: EventItem) {
    const confirmed = window.confirm(
      `Permanently delete "${event.title}"?\n\n` +
      'This event will be removed from the admin dashboard ' +
      'and devotee app.\n\n' +
      'This action cannot be undone.'
    );

    if (!confirmed) return;

    try {
      setDeleteBusy(event.id);
      setError('');

      await apiRequest(`/admin/events/${event.id}`, {
        method: 'DELETE',
      });

      if (editingEvent?.id === event.id) {
        setEditingEvent(null);
        setShowForm(false);
      }

      setItems(previous =>
        previous.filter(item => item.id !== event.id)
      );
    } catch (err) {
      setError(
        messageOf(err, 'Failed to delete event')
      );
    } finally {
      setDeleteBusy(null);
    }
  }

  function startAddCategory() {
    setEditingCategory(null);

    setCategoryNames({
      name_en: '',
      name_te: '',
      name_kn: '',
      name_hi: '',
      name_ta: '',
    });
  }

  function startEditCategory(category: EventCategory) {
    setEditingCategory(category);

    setCategoryNames({
      name_en: category.name_en || category.name,
      name_te: category.name_te || '',
      name_kn: category.name_kn || '',
      name_hi: category.name_hi || '',
      name_ta: category.name_ta || '',
    });
  }

  async function saveCategory(e: FormEvent) {
    e.preventDefault();

    const name = categoryNames.name_en.trim();

    const translations = Object.fromEntries(
      Object.entries(categoryNames).map(([key, value]) => [
        key,
        value.trim() || null,
      ])
    );

    if (!name) {
      setError('Category name is required');
      return;
    }

    if (
      Object.values(categoryNames).some(
        value => value.trim().length > 100
      )
    ) {
      setError(
        'Each category translation must be 100 characters or fewer'
      );
      return;
    }

    try {
      setCategoryBusy(true);
      setError('');

      if (editingCategory) {
        await apiRequest(
          `/admin/event-categories/${editingCategory.id}`,
          {
            method: 'PUT',
            body: JSON.stringify({
              ...translations,
              is_active: editingCategory.is_active,
            }),
          }
        );
      } else {
        await apiRequest('/admin/event-categories', {
          method: 'POST',
          body: JSON.stringify(translations),
        });
      }

      startAddCategory();

      await Promise.all([
        loadCategories(),
        loadEvents(),
      ]);
    } catch (err) {
      setError(
        messageOf(err, 'Failed to save category')
      );
    } finally {
      setCategoryBusy(false);
    }
  }

  async function toggleCategory(category: EventCategory) {
    const affected = items.filter(
      event =>
        event.category_id === category.id &&
        event.is_active
    ).length;

    if (
      category.is_active &&
      affected > 0 &&
      !window.confirm(
        `Deactivating "${category.name}" will hide ` +
        `${affected} published event(s) from devotees ` +
        'until the category is reactivated. Continue?'
      )
    ) {
      return;
    }

    try {
      setCategoryBusy(true);
      setError('');

      await apiRequest(
        `/admin/event-categories/${category.id}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            name: category.name,
            is_active: !category.is_active,
          }),
        }
      );

      await loadCategories();
    } catch (err) {
      setError(
        messageOf(err, 'Failed to change category status')
      );
    } finally {
      setCategoryBusy(false);
    }
  }

  // Use temple timezone for upcoming/past classification.
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const filteredEvents = items
    .filter(event => {
      const query = search.trim().toLowerCase();

      const matchesSearch =
        !query ||
        [
          event.title,
          event.description,
          event.location,
          event.category_name,
        ].some(value =>
          (value || '').toLowerCase().includes(query)
        );

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'published' && event.is_active) ||
        (statusFilter === 'unpublished' && !event.is_active);

      const matchesCategory =
        categoryFilter === 'all' ||
        String(event.category_id) === categoryFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesCategory
      );
    })
    .sort((a, b) => {
      const aDate = datePart(a.event_date);
      const bDate = datePart(b.event_date);

      if (sortOrder === 'newest') {
        return (
          bDate.localeCompare(aDate) ||
          b.id - a.id
        );
      }

      if (sortOrder === 'oldest') {
        return (
          aDate.localeCompare(bDate) ||
          a.id - b.id
        );
      }

      const aEndDate =
        datePart(a.event_end_date) || aDate;

      const bEndDate =
        datePart(b.event_end_date) || bDate;

      const aUpcoming = aEndDate >= today;
      const bUpcoming = bEndDate >= today;

      if (aUpcoming !== bUpcoming) {
        return aUpcoming ? -1 : 1;
      }

      // Upcoming: nearest first.
      // Past: most recent first.
      const dateComparison = aUpcoming
        ? aDate.localeCompare(bDate)
        : bDate.localeCompare(aDate);

      return (
        dateComparison ||
        timePart(a.start_time).localeCompare(
          timePart(b.start_time)
        ) ||
        a.id - b.id
      );
    });

  const activeFilters =
    Boolean(search.trim()) ||
    statusFilter !== 'all' ||
    categoryFilter !== 'all' ||
    sortOrder !== 'upcoming';

  function resetFilters() {
    setSearch('');
    setStatusFilter('all');
    setCategoryFilter('all');
    setSortOrder('upcoming');
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Events</h1>
          <p>
            Manage temple events and categories
            displayed to devotees
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>

          <button
            type="button"
            onClick={() => {
              setManageCategories(!manageCategories);
              setShowForm(false);
              startAddCategory();
            }}
          >
            {manageCategories
              ? 'Close Categories'
              : 'Manage Categories'}
          </button>

          <button
            type="button"
            className="primary-button"
            onClick={openAddForm}
            disabled={!categories.some(c => c.is_active)}
          >
            + Add Event
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}

      {manageCategories && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="section-header">
            <div>
              <h2>Manage Event Categories</h2>
              <p>
                New active categories appear in the app
                through the API, without an app release.
              </p>
            </div>
          </div>

          <form
            onSubmit={saveCategory}
            style={{ marginBottom: 20 }}
          >
            <p
              style={{
                marginBottom: 12,
                color: '#81776d',
              }}
            >
              Enter category names in the languages you
              support. English is required; other languages
              fall back to English when left blank.
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 14,
              }}
            >
              {categoryLanguages.map(language => (
                <label key={language.key}>
                  {language.label}
                  {language.key === 'name_en'
                    ? ' *'
                    : ' (optional)'}

                  <input
                    value={categoryNames[language.key]}
                    maxLength={100}
                    required={language.key === 'name_en'}
                    placeholder={language.placeholder}
                    onChange={e =>
                      setCategoryNames(previous => ({
                        ...previous,
                        [language.key]: e.target.value,
                      }))
                    }
                  />
                </label>
              ))}
            </div>

            <div
              style={{
                display: 'flex',
                gap: 10,
                marginTop: 16,
                flexWrap: 'wrap',
              }}
            >
              <button
                type="submit"
                className="primary-button"
                disabled={
                  categoryBusy ||
                  !categoryNames.name_en.trim()
                }
              >
                {categoryBusy
                  ? 'Saving...'
                  : editingCategory
                    ? 'Save Changes'
                    : '+ Add Category'}
              </button>

              {editingCategory && (
                <button
                  type="button"
                  disabled={categoryBusy}
                  onClick={startAddCategory}
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </form>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Events</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {categories.map(category => (
                  <tr key={category.id}>
                    <td>
                      <strong>
                        {category.name_en || category.name}
                      </strong>

                      {(
                        [
                          'name_te',
                          'name_kn',
                          'name_hi',
                          'name_ta',
                        ] as const
                      ).some(key => category[key]) && (
                        <small
                          style={{
                            display: 'block',
                            color: '#81776d',
                            marginTop: 4,
                          }}
                        >
                          {(
                            [
                              'name_te',
                              'name_kn',
                              'name_hi',
                              'name_ta',
                            ] as const
                          )
                            .map(key => category[key])
                            .filter(Boolean)
                            .join(' · ')}
                        </small>
                      )}
                    </td>

                    <td>
                      {
                        items.filter(
                          event =>
                            event.category_id === category.id
                        ).length
                      }
                    </td>

                    <td>
                      <span className="badge">
                        {category.is_active
                          ? 'Active'
                          : 'Inactive'}
                      </span>
                    </td>

                    <td>
                      <div
                        style={{
                          display: 'flex',
                          gap: 8,
                          flexWrap: 'wrap',
                        }}
                      >
                        <button
                          type="button"
                          disabled={categoryBusy}
                          onClick={() =>
                            startEditCategory(category)
                          }
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          disabled={categoryBusy}
                          onClick={() =>
                            void toggleCategory(category)
                          }
                        >
                          {category.is_active
                            ? 'Deactivate'
                            : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {categories.length === 0 && (
              <p>
                No categories yet. Add your first category
                above.
              </p>
            )}
          </div>
        </div>
      )}

      {showForm && (
        <EventForm
          key={editingEvent?.id ?? 'new'}
          event={editingEvent}
          categories={categories}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            void refresh();
          }}
        />
      )}

      {/* ======================================
          TEMPLE EVENTS
      ====================================== */}

      <div className="card">
        <div className="section-header">
          <div>
            <h2>Temple Events</h2>
            <p>
              Published events in active categories are
              visible to devotees
            </p>
          </div>
        </div>

        {/* SEARCH AND FILTERS */}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(190px, 1fr))',
            gap: 14,
            marginBottom: 18,
          }}
        >
          <div>
            <label
              htmlFor="event-search"
              style={filterLabelStyle}
            >
              Search Events
            </label>

            <input
              id="event-search"
              type="search"
              placeholder="Search name, location..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={filterControlStyle}
            />
          </div>

          <div>
            <label
              htmlFor="event-status"
              style={filterLabelStyle}
            >
              Publication Status
            </label>

            <select
              id="event-status"
              value={statusFilter}
              onChange={e =>
                setStatusFilter(
                  e.target.value as StatusFilter
                )
              }
              style={filterControlStyle}
            >
              <option value="all">All Statuses</option>
              <option value="published">Published</option>
              <option value="unpublished">Unpublished</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="event-category"
              style={filterLabelStyle}
            >
              Event Category
            </label>

            <select
              id="event-category"
              value={categoryFilter}
              onChange={e =>
                setCategoryFilter(e.target.value)
              }
              style={filterControlStyle}
            >
              <option value="all">All Categories</option>

              {categories.map(category => (
                <option
                  key={category.id}
                  value={String(category.id)}
                >
                  {category.name_en || category.name}
                  {!category.is_active
                    ? ' (Inactive)'
                    : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="event-sort"
              style={filterLabelStyle}
            >
              Sort Events
            </label>

            <select
              id="event-sort"
              value={sortOrder}
              onChange={e =>
                setSortOrder(e.target.value as SortOrder)
              }
              style={filterControlStyle}
            >
              <option value="upcoming">
                Upcoming First
              </option>
              <option value="newest">
                Newest Date First
              </option>
              <option value="oldest">
                Oldest Date First
              </option>
            </select>
          </div>
        </div>

        {/* RESULT COUNT */}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
            marginBottom: 16,
          }}
        >
          <span
            style={{
              fontSize: 13,
              color: '#81776d',
            }}
          >
            Showing <strong>{filteredEvents.length}</strong>
            {' '}of <strong>{items.length}</strong> events
          </span>

          {activeFilters && (
            <button
              type="button"
              onClick={resetFilters}
              style={{
                backgroundColor: '#FFF8EC',
                color: '#6B1720',
                border: '1px solid #E9D6B7',
                borderRadius: 7,
                padding: '8px 12px',
                cursor: 'pointer',
              }}
            >
              Clear Filters
            </button>
          )}
        </div>

        {loading && items.length === 0 ? (
          <p>Loading events...</p>
        ) : items.length === 0 ? (
          <p>No events found. Add your first event.</p>
        ) : filteredEvents.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '30px 16px',
              color: '#81776d',
            }}
          >
            <p>No events match your search or filters.</p>
            <button
              type="button"
              onClick={resetFilters}
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Category</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredEvents.map(event => (
                  <tr key={event.id}>
                    <td>
                      <strong>{event.title}</strong>

                      {Boolean(event.videos?.length) && (
                        <small
                          style={{
                            display: 'block',
                            color: '#6B1720',
                            marginTop: 5,
                            fontWeight: 600,
                          }}
                        >
                          {event.videos?.length}
                          {' YouTube video(s)'}
                        </small>
                      )}

                      {event.description && (
                        <small
                          style={{
                            display: 'block',
                            marginTop: 4,
                            color: '#81776d',
                            maxWidth: 300,
                          }}
                        >
                          {event.description}
                        </small>
                      )}
                    </td>

                    <td>
                      {event.category_name || 'Unassigned'}
                    </td>

                    <td>
                      {datePart(event.event_date) || '—'}

                      {event.event_end_date &&
                      datePart(event.event_end_date) !==
                        datePart(event.event_date)
                        ? ` – ${datePart(event.event_end_date)}`
                        : ''}
                    </td>

                    <td>
                      {displayTime(
                        event.start_time,
                        event.end_time
                      )}
                    </td>

                    <td>
                      {event.location || '—'}
                    </td>

                    <td>
                      <span className="badge">
                        {event.is_active
                          ? 'Published'
                          : 'Unpublished'}
                      </span>
                    </td>

                    <td>
                      <div
                        style={{
                          display: 'flex',
                          gap: 8,
                          flexWrap: 'wrap',
                        }}
                      >
                        <button
                          type="button"
                          disabled={
                            deleteBusy === event.id ||
                            statusBusy === event.id
                          }
                          onClick={() =>
                            openEditForm(event)
                          }
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          disabled={
                            statusBusy === event.id ||
                            deleteBusy === event.id
                          }
                          onClick={() =>
                            void toggleStatus(event)
                          }
                        >
                          {statusBusy === event.id
                            ? 'Updating...'
                            : event.is_active
                              ? 'Unpublish'
                              : 'Publish'}
                        </button>

                        <button
                          type="button"
                          disabled={
                            deleteBusy !== null ||
                            statusBusy === event.id
                          }
                          onClick={() =>
                            void handleDeleteEvent(event)
                          }
                          style={{
                            color: '#B42318',
                            border: '1px solid #F2C5C0',
                            backgroundColor: '#FFF5F4',
                            borderRadius: 6,
                            padding: '7px 12px',
                            cursor:
                              deleteBusy === event.id
                                ? 'wait'
                                : 'pointer',
                          }}
                        >
                          {deleteBusy === event.id
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
      </div>
    </div>
  );
}

/* =========================================================
   EVENT ADD / EDIT FORM
========================================================= */

function EventForm({
  event,
  categories,
  onClose,
  onSaved,
}: {
  event: EventItem | null;
  categories: EventCategory[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const existingImages = (event?.images ?? [])
    .map(item =>
      typeof item === 'string'
        ? item
        : item.image_url
    )
    .filter(Boolean);

  const [title, setTitle] = useState(event?.title || '');
  const [description, setDescription] =
    useState(event?.description || '');

  const [eventDate, setEventDate] =
    useState(datePart(event?.event_date));

  const [eventEndDate, setEventEndDate] =
    useState(datePart(event?.event_end_date));

  const [startTime, setStartTime] =
    useState(timePart(event?.start_time));

  const [endTime, setEndTime] =
    useState(timePart(event?.end_time));

  const [location, setLocation] =
    useState(event?.location || '');

  const [categoryId, setCategoryId] = useState(
    event?.category_id
      ? String(event.category_id)
      : ''
  );

  const [images, setImages] = useState<string[]>(
    existingImages.length
      ? existingImages
      : event?.image_url
        ? [event.image_url]
        : []
  );

  const [pendingFiles, setPendingFiles] =
    useState<File[]>([]);

  const [videos, setVideos] =
    useState<EventVideoDraft[]>(() =>
      [...(event?.videos ?? [])]
        .sort(
          (a, b) =>
            (a.display_order ?? 0) -
            (b.display_order ?? 0)
        )
        .map(video => ({
          key: createVideoKey(),
          title: video.title || '',
          youtube_url: video.youtube_url || '',
        }))
    );

  const [videosChanged, setVideosChanged] =
    useState(false);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const selectedCategory = categories.find(
    category => category.id === Number(categoryId)
  );

  function addFiles(files: FileList | null) {
    if (!files) return;

    const incoming = Array.from(files);

    if (
      images.length +
      pendingFiles.length +
      incoming.length > 10
    ) {
      setFormError('Maximum 10 images per event');
      return;
    }

    if (
      incoming.some(
        file =>
          !IMAGE_EXTENSIONS.some(ext =>
            file.name.toLowerCase().endsWith(ext)
          ) ||
          file.size > MAX_IMAGE_BYTES ||
          file.size === 0
      )
    ) {
      setFormError(
        'Use JPG, JPEG, PNG, WebP, GIF, BMP, TIFF, ' +
        'HEIC, HEIF or AVIF images up to 10 MB each'
      );
      return;
    }

    setFormError('');

    setPendingFiles(previous => [
      ...previous,
      ...incoming,
    ]);
  }

  function moveImage(index: number, direction: number) {
    const target = index + direction;

    if (
      target < 0 ||
      target >= images.length
    ) {
      return;
    }

    setImages(previous => {
      const next = [...previous];

      [next[index], next[target]] = [
        next[target],
        next[index],
      ];

      return next;
    });
  }

  function addVideo() {
    if (videos.length >= MAX_EVENT_VIDEOS) {
      setFormError('Maximum 10 videos per event');
      return;
    }

    const key = createVideoKey();

    setVideos(previous => [
      ...previous,
      {
        key,
        title: '',
        youtube_url: '',
      },
    ]);

    setVideosChanged(true);
    setFormError('');
  }

  function updateVideo(
    key: string,
    field: 'title' | 'youtube_url',
    value: string
  ) {
    setVideos(previous =>
      previous.map(video =>
        video.key === key
          ? { ...video, [field]: value }
          : video
      )
    );

    setVideosChanged(true);
    setFormError('');
  }

  function removeVideo(key: string) {
    setVideos(previous =>
      previous.filter(video => video.key !== key)
    );

    setVideosChanged(true);
    setFormError('');
  }

  function moveVideo(
    index: number,
    direction: number
  ) {
    setVideos(previous => {
      const target = index + direction;

      if (
        index < 0 ||
        index >= previous.length ||
        target < 0 ||
        target >= previous.length
      ) {
        return previous;
      }

      const next = [...previous];

      [next[index], next[target]] = [
        next[target],
        next[index],
      ];

      return next;
    });

    setVideosChanged(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!title.trim()) {
      setFormError('Event title is required');
      return;
    }

    if (!eventDate) {
      setFormError('Event date is required');
      return;
    }

    if (
      eventEndDate &&
      eventEndDate < eventDate
    ) {
      setFormError(
        'Event end date cannot be earlier than event date'
      );
      return;
    }

    if (
      !selectedCategory ||
      !selectedCategory.is_active
    ) {
      setFormError(
        'Please select an active event category'
      );
      return;
    }

    if (
      startTime &&
      endTime &&
      endTime < startTime &&
      (!eventEndDate || eventEndDate === eventDate)
    ) {
      setFormError(
        'End time cannot be earlier than start time ' +
        'for a single-day event'
      );
      return;
    }

    if (
      images.length +
      pendingFiles.length > 10
    ) {
      setFormError('Maximum 10 images per event');
      return;
    }

    if (videos.length > MAX_EVENT_VIDEOS) {
      setFormError('Maximum 10 videos per event');
      return;
    }

    const seenVideoIds = new Set<string>();

    const allVideos: {
      title: string | null;
      youtube_url: string;
    }[] = [];

    for (const [index, video] of videos.entries()) {
      const url = video.youtube_url.trim();
      const title = video.title.trim();

      if (url.length > 2048) {
        setFormError(
          'YouTube URL is too long for video ' +
          (index + 1)
        );
        return;
      }

      const videoId = extractEventYouTubeId(url);

      if (!videoId) {
        setFormError(
          'Enter a valid YouTube URL for video ' +
          (index + 1)
        );
        return;
      }

      if (title.length > 255) {
        setFormError(
          'Video title cannot exceed 255 characters'
        );
        return;
      }

      if (seenVideoIds.has(videoId)) {
        setFormError(
          'Duplicate YouTube videos are not allowed'
        );
        return;
      }

      seenVideoIds.add(videoId);

      allVideos.push({
        title: title || null,
        youtube_url:
          'https://www.youtube.com/watch?v=' +
          videoId,
      });
    }

    try {
      setSaving(true);
      setFormError('');

      let allImages = [...images];

      if (pendingFiles.length) {
        const formData = new FormData();

        pendingFiles.forEach(file =>
          formData.append('images', file)
        );

        const uploaded = await apiRequest<{
          success: boolean;
          data: Array<{
            image_url: string;
            public_id: string;
          }>;
        }>(
          '/admin/events/upload-images',
          {
            method: 'POST',
            body: formData,
          }
        );

        allImages = [
          ...allImages,
          ...uploaded.data.map(
            item => item.image_url
          ),
        ];
      }

      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        image_url: allImages[0] || null,
        images: allImages,
        ...(!event || videosChanged
          ? { videos: allVideos }
          : {}),
        event_date: eventDate,
        event_end_date: eventEndDate || null,
        start_time:
          startTime && startTime !== '00:00'
            ? startTime
            : null,
        end_time:
          endTime && endTime !== '00:00'
            ? endTime
            : null,
        location: location.trim() || null,
        category_id: Number(categoryId),
      };

      await apiRequest(
        event
          ? `/admin/events/${event.id}`
          : '/admin/events',
        {
          method: event ? 'PUT' : 'POST',
          body: JSON.stringify(payload),
        }
      );

      onSaved();
    } catch (err) {
      setFormError(
        messageOf(err, 'Failed to save event')
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="card"
      style={{ marginBottom: 20 }}
    >
      <div className="section-header">
        <div>
          <h2>
            {event ? 'Edit Event' : 'Add Event'}
          </h2>

          <p>
            {event
              ? 'Update temple event details'
              : 'Create and publish a temple event'}
          </p>
        </div>
      </div>

      {formError && (
        <div
          className="error-message"
          role="alert"
        >
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
          }}
        >
          <label>
            Title
            <input
              value={title}
              onChange={e =>
                setTitle(e.target.value)
              }
              placeholder="Temple Festival"
              required
            />
          </label>

          <label>
            Event Category
            <select
              value={categoryId}
              onChange={e =>
                setCategoryId(e.target.value)
              }
              required
            >
              <option value="">
                Select category
              </option>

              {categories
                .filter(
                  category =>
                    category.is_active ||
                    category.id === event?.category_id
                )
                .map(category => (
                  <option
                    key={category.id}
                    value={category.id}
                    disabled={!category.is_active}
                  >
                    {category.name}
                    {!category.is_active
                      ? ' (Inactive)'
                      : ''}
                  </option>
                ))}
            </select>
          </label>

          <label>
            Event Date *
            <input
              type="date"
              value={eventDate}
              onChange={e =>
                setEventDate(e.target.value)
              }
              required
            />
          </label>

          <label>
            Event End Date (Optional)
            <input
              type="date"
              min={eventDate || undefined}
              value={eventEndDate}
              onChange={e =>
                setEventEndDate(e.target.value)
              }
            />
          </label>

          <label>
            Start Time (Optional)
            <input
              type="time"
              value={startTime}
              onChange={e =>
                setStartTime(e.target.value)
              }
            />
          </label>

          <label>
            End Time (Optional)
            <input
              type="time"
              value={endTime}
              onChange={e =>
                setEndTime(e.target.value)
              }
            />
          </label>

          <label>
            Location
            <input
              value={location}
              onChange={e =>
                setLocation(e.target.value)
              }
              placeholder="Temple Main Hall"
            />
          </label>

          <label
            style={{
              gridColumn: '1 / -1',
            }}
          >
            Description
            <textarea
              value={description}
              onChange={e =>
                setDescription(e.target.value)
              }
              rows={4}
              placeholder="Event description"
            />
          </label>
        </div>

        {/* EVENT IMAGES */}

        <div style={{ marginTop: 18 }}>
          <label>
            Event Photos (maximum 10, 10 MB each)
            <input
              type="file"
              accept={IMAGE_ACCEPT}
              multiple
              disabled={
                saving ||
                images.length +
                  pendingFiles.length >= 10
              }
              onChange={e => {
                addFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </label>

          <p
            style={{
              fontSize: 13,
              color: '#81776d',
            }}
          >
            {images.length + pendingFiles.length}/10
            {' '}selected. The first saved photo is
            the cover. Use arrows to reorder saved photos.
          </p>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              marginTop: 12,
            }}
          >
            {images.map((url, index) => (
              <div
                key={`${url}-${index}`}
                style={{
                  width: 150,
                  border: '1px solid #e8dccb',
                  padding: 8,
                  borderRadius: 8,
                }}
              >
                <img
                  src={url}
                  alt={`Event photo ${index + 1}`}
                  style={{
                    width: '100%',
                    height: 110,
                    objectFit: 'cover',
                    borderRadius: 5,
                  }}
                />

                <small
                  style={{ display: 'block' }}
                >
                  {index === 0
                    ? 'Cover photo'
                    : `Photo ${index + 1}`}
                </small>

                <div
                  style={{
                    display: 'flex',
                    gap: 4,
                    marginTop: 5,
                  }}
                >
                  <button
                    type="button"
                    disabled={
                      saving || index === 0
                    }
                    onClick={() =>
                      moveImage(index, -1)
                    }
                  >
                    ↑
                  </button>

                  <button
                    type="button"
                    disabled={
                      saving ||
                      index === images.length - 1
                    }
                    onClick={() =>
                      moveImage(index, 1)
                    }
                  >
                    ↓
                  </button>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      setImages(previous =>
                        previous.filter(
                          (_, i) => i !== index
                        )
                      )
                    }
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}

            {pendingFiles.map((file, index) => (
              <PendingImagePreview
                key={`${file.name}-${file.lastModified}-${index}`}
                file={file}
                index={index}
                disabled={saving}
                onRemove={() =>
                  setPendingFiles(previous =>
                    previous.filter(
                      (_, i) => i !== index
                    )
                  )
                }
              />
            ))}
          </div>
        </div>


        {/* EVENT VIDEOS */}

        <section
          style={{
            marginTop: 24,
            padding: 18,
            border: '1px solid #E8DCCB',
            borderRadius: 12,
            backgroundColor: '#FFFDF8',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <div>
              <h3
                style={{
                  margin: 0,
                  color: '#6B1720',
                  fontSize: 18,
                }}
              >
                Event Videos
              </h3>

              <p
                style={{
                  color: '#81776D',
                  fontSize: 13,
                  marginTop: 6,
                }}
              >
                Add YouTube videos related to this event.
                Devotees can watch them inside the app.
              </p>
            </div>

            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: '#6B1720',
              }}
            >
              {videos.length}/{MAX_EVENT_VIDEOS}
              {' videos'}
            </span>
          </div>

          {videos.length === 0 && (
            <div
              style={{
                padding: '24px 12px',
                textAlign: 'center',
                border: '1px dashed #D8C7AD',
                borderRadius: 10,
                color: '#81776D',
                marginTop: 12,
                backgroundColor: '#FFFFFF',
              }}
            >
              <strong>No videos added</strong>

              <p style={{ fontSize: 13 }}>
                Videos are optional. You can add them
                now or after publishing the event.
              </p>
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gap: 14,
              marginTop: 14,
            }}
          >
            {videos.map((video, index) => {
              const videoId =
                extractEventYouTubeId(
                  video.youtube_url
                );

              return (
                <div
                  key={video.key}
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E8DCCB',
                    borderRadius: 10,
                    padding: 14,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 8,
                      marginBottom: 12,
                    }}
                  >
                    <strong
                      style={{ color: '#6B1720' }}
                    >
                      Video {index + 1}
                    </strong>

                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 6,
                      }}
                    >
                      <button
                        type="button"
                        title="Move video up"
                        disabled={
                          saving || index === 0
                        }
                        onClick={() =>
                          moveVideo(index, -1)
                        }
                      >
                        Up
                      </button>

                      <button
                        type="button"
                        title="Move video down"
                        disabled={
                          saving ||
                          index === videos.length - 1
                        }
                        onClick={() =>
                          moveVideo(index, 1)
                        }
                      >
                        Down
                      </button>

                      <button
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          removeVideo(video.key)
                        }
                        style={{
                          color: '#B42318',
                          border: '1px solid #F2C5C0',
                          backgroundColor: '#FFF5F4',
                          borderRadius: 6,
                          padding: '7px 12px',
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
                      gap: 16,
                      alignItems: 'start',
                    }}
                  >
                    <div
                      style={{
                        display: 'grid',
                        gap: 12,
                      }}
                    >
                      <label>
                        Video Title (Optional)

                        <input
                          value={video.title}
                          maxLength={255}
                          disabled={saving}
                          placeholder="e.g. Special Mahapooja"
                          onChange={e =>
                            updateVideo(
                              video.key,
                              'title',
                              e.target.value
                            )
                          }
                        />
                      </label>

                      <label>
                        YouTube URL *

                        <input
                          type="url"
                          value={video.youtube_url}
                          maxLength={2048}
                          disabled={saving}
                          required
                          placeholder="https://www.youtube.com/watch?v=..."
                          onChange={e =>
                            updateVideo(
                              video.key,
                              'youtube_url',
                              e.target.value
                            )
                          }
                        />
                      </label>

                      {video.youtube_url.trim() &&
                        !videoId && (
                          <small
                            style={{
                              color: '#B42318',
                            }}
                          >
                            Enter a valid YouTube URL
                          </small>
                        )}

                      {videoId && (
                        <small
                          style={{
                            color: '#247A42',
                            fontWeight: 600,
                          }}
                        >
                          Valid YouTube URL format
                        </small>
                      )}
                    </div>

                    <div>
                      {videoId ? (
                        <>
                          <div
                            style={{
                              position: 'relative',
                              width: '100%',
                              maxWidth: 320,
                              aspectRatio: '16 / 9',
                              backgroundColor: '#222222',
                              borderRadius: 9,
                              overflow: 'hidden',
                            }}
                          >
                            <img
                              key={videoId}
                              src={
                                'https://i.ytimg.com/vi/' +
                                videoId +
                                '/hqdefault.jpg'
                              }
                              alt={
                                video.title ||
                                'YouTube video thumbnail'
                              }
                              loading="lazy"
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                              }}
                            />

                            <span
                              style={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform:
                                  'translate(-50%, -50%)',
                                backgroundColor: '#E62117',
                                color: '#FFFFFF',
                                padding: '8px 20px',
                                borderRadius: 9,
                                fontSize: 20,
                              }}
                            >
                              {'\u25B6'}
                            </span>
                          </div>

                          <a
                            href={
                              'https://www.youtube.com/watch?v=' +
                              videoId
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-block',
                              color: '#6B1720',
                              marginTop: 8,
                              fontSize: 13,
                            }}
                          >
                            Preview on YouTube
                          </a>
                        </>
                      ) : (
                        <div
                          style={{
                            width: '100%',
                            maxWidth: 320,
                            aspectRatio: '16 / 9',
                            backgroundColor: '#F5F0E8',
                            borderRadius: 9,
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            color: '#81776D',
                            fontSize: 13,
                          }}
                        >
                          Thumbnail Preview
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            disabled={
              saving ||
              videos.length >= MAX_EVENT_VIDEOS
            }
            onClick={addVideo}
            style={{
              width: '100%',
              padding: 12,
              marginTop: 16,
              border: '1px dashed #C69A3A',
              borderRadius: 9,
              backgroundColor: '#FFF8EC',
              color: '#6B1720',
              fontWeight: 600,
              cursor:
                saving ||
                videos.length >= MAX_EVENT_VIDEOS
                  ? 'not-allowed'
                  : 'pointer',
            }}
          >
            + Add YouTube Video
          </button>

          <p
            style={{
              marginBottom: 0,
              color: '#81776D',
              fontSize: 12,
              marginTop: 10,
            }}
          >
            Supports regular YouTube links, Shorts,
            live streams and shortened links.
            Playback depends on YouTube embedding
            permissions.
          </p>
        </section>

        <p
          style={{
            fontSize: 13,
            marginTop: 12,
          }}
        >
          New events are published immediately and
          trigger your existing event notification
          workflow. You can unpublish an event from
          the events table.
        </p>

        <div
          style={{
            display: 'flex',
            gap: 10,
            marginTop: 20,
          }}
        >
          <button
            type="submit"
            className="primary-button"
            disabled={saving}
          >
            {saving
              ? 'Uploading / Saving...'
              : event
                ? 'Update Event'
                : 'Publish Event'}
          </button>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

/* =========================================================
   PENDING IMAGE PREVIEW
========================================================= */

function PendingImagePreview({
  file,
  index,
  disabled,
  onRemove,
}: {
  file: File;
  index: number;
  disabled: boolean;
  onRemove: () => void;
}) {
  const [preview, setPreview] = useState('');

  useEffect(() => {
    const url = URL.createObjectURL(file);

    setPreview(url);

    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div
      style={{
        width: 150,
        border: '1px dashed #c69a3a',
        padding: 8,
        borderRadius: 8,
      }}
    >
      {preview && (
        <img
          src={preview}
          alt={`New photo ${index + 1}`}
          style={{
            width: '100%',
            height: 110,
            objectFit: 'cover',
            borderRadius: 5,
          }}
        />
      )}

      <small
        style={{
          display: 'block',
        }}
      >
        New photo {index + 1}
      </small>

      <button
        type="button"
        disabled={disabled}
        onClick={onRemove}
      >
        Remove
      </button>
    </div>
  );
}
