import React, {
  useEffect,
  useState,
} from 'react';

import { apiRequest } from '../lib/api';

// ========================================
// CONFIGURATION
// ========================================

const MEDIA_BASE_URL =
  'https://hariharapura-temple-api.onrender.com';

const MAROON = '#6B1720';
const GOLD = '#C69A3A';

// ========================================
// TYPES
// ========================================

type DarshanVideo = {
  id: number;
  title: string;
  description?: string | null;
  label: 'live' | 'watch';
  url: string;
  thumbnail_url?: string | null;
  is_active: boolean;
  category_id?: number | null;
  category_name?: string | null;
  created_at?: string;
};

type DarshanCategory = {
  id: number;
  name: string;
  name_en: string;
  name_te?: string | null;
  name_kn?: string | null;
  name_hi?: string | null;
  name_ta?: string | null;
  sort_order: number;
  is_active: boolean;
  video_count?: number;
};

type CategoryLanguageField =
  | 'name_en'
  | 'name_te'
  | 'name_kn'
  | 'name_hi'
  | 'name_ta';

const LANGUAGE_FIELDS: {
  field: CategoryLanguageField;
  label: string;
  placeholder: string;
}[] = [
  {
    field: 'name_en',
    label: 'English',
    placeholder: 'Special Poojas',
  },
  {
    field: 'name_te',
    label: 'Telugu (తెలుగు)',
    placeholder: 'ప్రత్యేక పూజలు',
  },
  {
    field: 'name_kn',
    label: 'Kannada (ಕನ್ನಡ)',
    placeholder: 'ವಿಶೇಷ ಪೂಜೆಗಳು',
  },
  {
    field: 'name_hi',
    label: 'Hindi (हिन्दी)',
    placeholder: 'विशेष पूजाएँ',
  },
  {
    field: 'name_ta',
    label: 'Tamil (தமிழ்)',
    placeholder: 'சிறப்பு பூஜைகள்',
  },
];

// ========================================
// HELPERS
// ========================================

function resolveThumbnail(
  url?: string | null
): string {
  if (!url) return '';

  if (url.startsWith('/uploads/')) {
    return `${MEDIA_BASE_URL}${url}`;
  }

  return url;
}

function errorMessage(
  error: unknown,
  fallback: string
) {
  return error instanceof Error
    ? error.message
    : fallback;
}

// ========================================
// COMPONENT
// ========================================

export default function DarshanVideos() {
  const [activeTab, setActiveTab] =
    useState<'videos' | 'categories'>('videos');

  const [items, setItems] =
    useState<DarshanVideo[]>([]);

  const [categories, setCategories] =
    useState<DarshanCategory[]>([]);

  const [editing, setEditing] =
    useState<Partial<DarshanVideo> | null>(null);

  const [editingCategory, setEditingCategory] =
    useState<Partial<DarshanCategory> | null>(
      null
    );

  const [imageMode, setImageMode] =
    useState<'url' | 'upload'>('url');

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const [previewUrl, setPreviewUrl] =
    useState('');

  const [categoryFilter, setCategoryFilter] =
    useState('all');

  const [search, setSearch] =
    useState('');

  const [labelFilter, setLabelFilter] =
    useState('all');

  const [error, setError] =
    useState('');

  const [success, setSuccess] =
    useState('');

  const [busy, setBusy] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  // ========================================
  // LOAD DATA
  // ========================================

  async function load() {
    setLoading(true);

    try {
      const videoResult =
        await apiRequest<{
          data: DarshanVideo[];
        }>('/admin/darshan-videos');

      setItems(videoResult.data || []);

      const categoryResult =
        await apiRequest<{
          data: DarshanCategory[];
        }>('/admin/darshan-video-categories');

      const loadedCategories =
        categoryResult.data || [];

      setCategories(loadedCategories);

      setCategoryFilter((current) => {
        if (
          current === 'all' ||
          current === 'uncategorized'
        ) {
          return current;
        }

        return loadedCategories.some(
          (category) =>
            String(category.id) === current
        )
          ? current
          : 'all';
      });
    } catch (e) {
      setError(
        errorMessage(e, 'Failed to load data.')
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  // ========================================
  // THUMBNAIL PREVIEW
  // ========================================

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl('');
      return;
    }

    const objectUrl =
      URL.createObjectURL(selectedFile);

    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedFile]);

  // ========================================
  // RESET MESSAGES
  // ========================================

  function clearMessages() {
    setError('');
    setSuccess('');
  }

  // ========================================
  // SWITCH TABS
  // ========================================

  function switchTab(
    tab: 'videos' | 'categories'
  ) {
    setActiveTab(tab);
    setEditing(null);
    setEditingCategory(null);
    setSelectedFile(null);
    clearMessages();
  }

  // ========================================
  // VIDEO FORMS
  // ========================================

  function openAddForm() {
    clearMessages();

    setSelectedFile(null);
    setImageMode('url');

    setEditing({
      title: '',
      description: '',
      label: 'watch',
      url: '',
      thumbnail_url: '',
      category_id: null,
      is_active: true,
    });
  }

  function openEditForm(
    item: DarshanVideo
  ) {
    clearMessages();

    setSelectedFile(null);
    setImageMode('url');

    setEditing({
      ...item,
    });
  }

  function closeVideoForm() {
    setEditing(null);
    setSelectedFile(null);
    setPreviewUrl('');
  }

  // ========================================
  // IMAGE UPLOAD
  // ========================================

  function handleFileChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];

    if (!file) {
      setSelectedFile(null);
      return;
    }

    const validTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
    ];

    if (!validTypes.includes(file.type)) {
      setError(
        'Only JPG, JPEG, PNG and WEBP are allowed.'
      );

      e.target.value = '';
      setSelectedFile(null);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError(
        'Image size must be 5 MB or less.'
      );

      e.target.value = '';
      setSelectedFile(null);
      return;
    }

    setError('');
    setSelectedFile(file);
  }

  // ========================================
  // SAVE VIDEO
  // ========================================

  async function saveVideo(
    e: React.FormEvent
  ) {
    e.preventDefault();

    if (!editing || busy) return;

    if (!editing.title?.trim()) {
      setError('Please enter a title.');
      return;
    }

    if (!editing.url?.trim()) {
      setError(
        'Please enter the YouTube URL.'
      );
      return;
    }

    if (!editing.label) {
      setError(
        'Please select Live or Watch.'
      );
      return;
    }

    if (
      imageMode === 'upload' &&
      !selectedFile &&
      !editing.thumbnail_url
    ) {
      setError(
        'Please select a thumbnail image or use Thumbnail URL mode.'
      );
      return;
    }

    clearMessages();
    setBusy(true);

    try {
      const isEditing =
        Boolean(editing.id);

      const endpoint = isEditing
        ? `/admin/darshan-videos/${editing.id}`
        : '/admin/darshan-videos';

      const method = isEditing
        ? 'PUT'
        : 'POST';

      const payload = {
        title: editing.title.trim(),

        description:
          editing.description?.trim() || null,

        label: editing.label,

        url: editing.url.trim(),

        thumbnail_url:
          editing.thumbnail_url?.trim() ||
          null,

        category_id:
          editing.category_id ?? null,

        is_active:
          editing.is_active !== false,
      };

      // UPLOAD THUMBNAIL

      if (
        imageMode === 'upload' &&
        selectedFile
      ) {
        const formData = new FormData();

        formData.append(
          'thumbnail',
          selectedFile
        );

        formData.append(
          'title',
          payload.title
        );

        formData.append(
          'description',
          payload.description || ''
        );

        formData.append(
          'label',
          payload.label
        );

        formData.append(
          'url',
          payload.url
        );

        formData.append(
          'category_id',
          payload.category_id == null
            ? ''
            : String(payload.category_id)
        );

        formData.append(
          'is_active',
          String(payload.is_active)
        );

        await apiRequest(endpoint, {
          method,
          body: formData,
        });
      } else {
        // JSON REQUEST

        await apiRequest(endpoint, {
          method,
          body: JSON.stringify(payload),
        });
      }

      closeVideoForm();

      setSuccess(
        isEditing
          ? 'Darshan video updated successfully.'
          : 'Darshan video created successfully.'
      );

      await load();
    } catch (e) {
      setError(
        errorMessage(
          e,
          'Failed to save Darshan Video.'
        )
      );
    } finally {
      setBusy(false);
    }
  }

  // ========================================
  // DELETE VIDEO
  // ========================================

  async function removeVideo(
    id: number
  ) {
    if (busy) return;

    if (
      !window.confirm(
        'Are you sure you want to delete this Darshan Video?'
      )
    ) {
      return;
    }

    clearMessages();
    setBusy(true);

    try {
      await apiRequest(
        `/admin/darshan-videos/${id}`,
        {
          method: 'DELETE',
        }
      );

      if (editing?.id === id) {
        closeVideoForm();
      }

      setSuccess(
        'Darshan video deleted successfully.'
      );

      await load();
    } catch (e) {
      setError(
        errorMessage(
          e,
          'Failed to delete Darshan Video.'
        )
      );
    } finally {
      setBusy(false);
    }
  }

  // ========================================
  // CATEGORY FORMS
  // ========================================

  function openAddCategory() {
    clearMessages();

    const nextOrder =
      Math.max(
        0,
        ...categories.map(
          (category) => category.sort_order
        )
      ) + 1;

    setEditingCategory({
      name_en: '',
      name_te: '',
      name_kn: '',
      name_hi: '',
      name_ta: '',
      sort_order: nextOrder,
      is_active: true,
    });
  }

  function openEditCategory(
    category: DarshanCategory
  ) {
    clearMessages();

    setEditingCategory({
      ...category,
    });
  }

  // ========================================
  // SAVE CATEGORY
  // ========================================

  async function saveCategory(
    e: React.FormEvent
  ) {
    e.preventDefault();

    if (!editingCategory || busy) return;

    if (!editingCategory.name_en?.trim()) {
      setError(
        'English category name is required.'
      );
      return;
    }

    const sortOrder =
      Number(editingCategory.sort_order ?? 0);

    if (
      !Number.isInteger(sortOrder) ||
      sortOrder < 0 ||
      sortOrder > 2147483647
    ) {
      setError(
        'Please enter a valid display order.'
      );
      return;
    }

    clearMessages();
    setBusy(true);

    try {
      const isEditing =
        Boolean(editingCategory.id);

      const endpoint = isEditing
        ? `/admin/darshan-video-categories/${editingCategory.id}`
        : '/admin/darshan-video-categories';

      await apiRequest(endpoint, {
        method: isEditing ? 'PUT' : 'POST',

        body: JSON.stringify({
          name_en:
            editingCategory.name_en.trim(),

          name_te:
            editingCategory.name_te?.trim() ||
            null,

          name_kn:
            editingCategory.name_kn?.trim() ||
            null,

          name_hi:
            editingCategory.name_hi?.trim() ||
            null,

          name_ta:
            editingCategory.name_ta?.trim() ||
            null,

          sort_order: sortOrder,

          is_active:
            editingCategory.is_active !== false,
        }),
      });

      setEditingCategory(null);

      setSuccess(
        isEditing
          ? 'Category updated successfully.'
          : 'Category created successfully.'
      );

      await load();
    } catch (e) {
      setError(
        errorMessage(
          e,
          'Failed to save category.'
        )
      );
    } finally {
      setBusy(false);
    }
  }

  // ========================================
  // TOGGLE CATEGORY STATUS
  // ========================================

  async function toggleCategory(
    category: DarshanCategory
  ) {
    if (busy) return;

    clearMessages();
    setBusy(true);

    try {
      await apiRequest(
        `/admin/darshan-video-categories/${category.id}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            is_active: !category.is_active,
          }),
        }
      );

      setSuccess(
        category.is_active
          ? 'Category deactivated successfully.'
          : 'Category activated successfully.'
      );

      await load();
    } catch (e) {
      setError(
        errorMessage(
          e,
          'Failed to update category status.'
        )
      );
    } finally {
      setBusy(false);
    }
  }

  // ========================================
  // DELETE CATEGORY
  // ========================================

  async function removeCategory(
    category: DarshanCategory
  ) {
    if (busy) return;

    const count =
      category.video_count ?? 0;

    const message =
      `Delete "${category.name_en}"?\n\n` +
      `This category contains ${count} video(s).\n` +
      'Videos will NOT be deleted. They will become uncategorized.';

    if (!window.confirm(message)) {
      return;
    }

    clearMessages();
    setBusy(true);

    try {
      await apiRequest(
        `/admin/darshan-video-categories/${category.id}`,
        {
          method: 'DELETE',
        }
      );

      if (editingCategory?.id === category.id) {
        setEditingCategory(null);
      }

      setSuccess(
        'Category deleted successfully.'
      );

      await load();
    } catch (e) {
      setError(
        errorMessage(
          e,
          'Failed to delete category.'
        )
      );
    } finally {
      setBusy(false);
    }
  }

  // ========================================
  // FILTER VIDEOS
  // ========================================

  const filteredItems = items.filter(
    (item) => {
      const query = search
        .trim()
        .toLowerCase();

      const matchesSearch =
        !query ||
        item.title
          .toLowerCase()
          .includes(query) ||
        (item.description || '')
          .toLowerCase()
          .includes(query) ||
        (item.category_name || '')
          .toLowerCase()
          .includes(query);

      const matchesCategory =
        categoryFilter === 'all'
          ? true
          : categoryFilter === 'uncategorized'
            ? item.category_id == null
            : String(item.category_id) ===
              categoryFilter;

      const matchesLabel =
        labelFilter === 'all' ||
        item.label === labelFilter;

      return (
        matchesSearch &&
        matchesCategory &&
        matchesLabel
      );
    }
  );

  // ========================================
  // DASHBOARD STATISTICS
  // ========================================

  const totalVideos = items.length;

  const liveVideos = items.filter(
    (item) =>
      item.label === 'live' &&
      item.is_active
  ).length;

  const activeVideos = items.filter(
    (item) => item.is_active
  ).length;

  const activeCategories = categories.filter(
    (category) => category.is_active
  ).length;

  // ========================================
  // STYLES
  // ========================================

  const statGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '16px',
    marginBottom: '24px',
  };

  const statCardStyle: React.CSSProperties = {
    background: '#FFFFFF',
    padding: '20px',
    borderRadius: '12px',
    border: '1px solid #E8DFD1',
    borderTop: `3px solid ${GOLD}`,
    boxShadow: '0 3px 12px rgba(0,0,0,0.04)',
  };

  const tabContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    padding: '10px',
    background: '#F7EBD7',
    borderRadius: '10px',
    marginBottom: '24px',
  };

  const filterStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(170px, 1fr))',
    gap: '12px',
    marginBottom: '20px',
  };

  const statusBadge = (
    active: boolean
  ): React.CSSProperties => ({
    display: 'inline-block',
    padding: '5px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    color: active ? '#166534' : '#991B1B',
    background: active
      ? '#DCFCE7'
      : '#FEE2E2',
  });

  // ========================================
  // UI
  // ========================================

  return (
    <main className="content">

      {/* PAGE HEADER */}

      <div className="page-head">
        <div>
          <h2>Darshan Videos</h2>

          <p>
            Manage temple videos, live streams
            and multilingual categories.
          </p>
        </div>

        <button
          className="primary"
          disabled={busy || loading}
          onClick={
            activeTab === 'videos'
              ? openAddForm
              : openAddCategory
          }
        >
          {activeTab === 'videos'
            ? '+ Add Video'
            : '+ Add Category'}
        </button>
      </div>

      {/* SUCCESS MESSAGE */}

      {success && (
        <div
          role="status"
          style={{
            padding: '14px 18px',
            background: '#DCFCE7',
            color: '#166534',
            borderRadius: '8px',
            marginBottom: '16px',
          }}
        >
          {success}
        </div>
      )}

      {/* ERROR MESSAGE */}

      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}

      {/* DASHBOARD STATS */}

      <div style={statGridStyle}>
        {[
          {
            title: 'Total Videos',
            value: totalVideos,
          },
          {
            title: 'Active Videos',
            value: activeVideos,
          },
          {
            title: 'Live-labelled Videos',
            value: liveVideos,
          },
          {
            title: 'Active Categories',
            value: activeCategories,
          },
        ].map((stat) => (
          <div
            key={stat.title}
            style={statCardStyle}
          >
            <div
              style={{
                fontSize: '13px',
                color: '#786B60',
                marginBottom: '8px',
              }}
            >
              {stat.title}
            </div>

            <div
              style={{
                fontSize: '30px',
                fontWeight: 700,
                color: MAROON,
              }}
            >
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* MANAGEMENT TABS */}

      <div style={tabContainerStyle}>
        <button
          type="button"
          disabled={busy}
          onClick={() => switchTab('videos')}
          style={{
            flex: 1,
            padding: '12px 20px',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 600,
            background:
              activeTab === 'videos'
                ? MAROON
                : 'transparent',
            color:
              activeTab === 'videos'
                ? '#FFFFFF'
                : MAROON,
          }}
        >
          Manage Videos
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() =>
            switchTab('categories')
          }
          style={{
            flex: 1,
            padding: '12px 20px',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 600,
            background:
              activeTab === 'categories'
                ? MAROON
                : 'transparent',
            color:
              activeTab === 'categories'
                ? '#FFFFFF'
                : MAROON,
          }}
        >
          Manage Categories
        </button>
      </div>

      {loading && (
        <p>Loading Darshan Videos...</p>
      )}

      {/* =================================
          MANAGE VIDEOS
      ================================= */}

      {activeTab === 'videos' && (
        <>

          {/* VIDEO FORM */}

          {editing && (
            <form
              className="form-card"
              onSubmit={saveVideo}
            >
              <h3>
                {editing.id
                  ? 'Edit Darshan Video'
                  : 'Add Darshan Video'}
              </h3>

              <fieldset
                disabled={busy}
                style={{
                  border: 0,
                  padding: 0,
                  margin: 0,
                  minWidth: 0,
                }}
              >
                <div className="grid2">

                  {/* TITLE */}

                  <label>
                    Video Title

                    <input
                      value={editing.title || ''}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          title: e.target.value,
                        })
                      }
                      placeholder="Enter video title"
                      required
                    />
                  </label>

                  {/* LABEL */}

                  <label>
                    Video Type

                    <select
                      value={
                        editing.label || 'watch'
                      }
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          label:
                            e.target.value as
                              | 'live'
                              | 'watch',
                        })
                      }
                    >
                      <option value="watch">
                        Watch Video
                      </option>

                      <option value="live">
                        Live Darshan
                      </option>
                    </select>
                  </label>
                </div>

                {/* CATEGORY */}

                <label>
                  Video Category

                  <select
                    value={
                      editing.category_id ?? ''
                    }
                    onChange={(e) =>
                      setEditing({
                        ...editing,

                        category_id:
                          e.target.value === ''
                            ? null
                            : Number(
                                e.target.value
                              ),
                      })
                    }
                  >
                    <option value="">
                      No Category
                    </option>

                    {categories.map(
                      (category) => (
                        <option
                          key={category.id}
                          value={category.id}
                          disabled={
                            !category.is_active &&
                            editing.category_id !==
                              category.id
                          }
                        >
                          {category.name_en}

                          {!category.is_active
                            ? ' (Inactive)'
                            : ''}
                        </option>
                      )
                    )}
                  </select>

                  <small
                    style={{
                      color: '#786B60',
                      display: 'block',
                      marginTop: '6px',
                    }}
                  >
                    Select where this video should
                    appear in the devotee app.
                  </small>
                </label>

                {/* VIDEO URL */}

                <label>
                  YouTube URL

                  <input
                    type="url"
                    value={editing.url || ''}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        url: e.target.value,
                      })
                    }
                    placeholder="https://www.youtube.com/watch?v=..."
                    required
                  />
                </label>

                {/* DESCRIPTION */}

                <label>
                  Description

                  <textarea
                    value={
                      editing.description || ''
                    }
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        description:
                          e.target.value,
                      })
                    }
                    placeholder="Optional video description"
                    rows={4}
                  />
                </label>

                {/* THUMBNAIL MODE */}

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '10px',
                    marginBottom: '18px',
                  }}
                >
                  <button
                    type="button"
                    className={
                      imageMode === 'url'
                        ? 'primary'
                        : ''
                    }
                    onClick={() => {
                      setImageMode('url');
                      setSelectedFile(null);
                      setError('');
                    }}
                  >
                    Thumbnail URL
                  </button>

                  <button
                    type="button"
                    className={
                      imageMode === 'upload'
                        ? 'primary'
                        : ''
                    }
                    onClick={() => {
                      setImageMode('upload');
                      setError('');
                    }}
                  >
                    Upload Thumbnail
                  </button>
                </div>

                {imageMode === 'url' && (
                  <label>
                    Thumbnail URL

                    <input
                      type="text"
                      value={
                        editing.thumbnail_url ||
                        ''
                      }
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          thumbnail_url:
                            e.target.value,
                        })
                      }
                      placeholder="Leave empty for automatic YouTube thumbnail"
                    />

                    <small
                      style={{
                        display: 'block',
                        marginTop: '6px',
                        color: '#786B60',
                      }}
                    >
                      YouTube thumbnail will be
                      generated automatically
                      when left empty.
                    </small>
                  </label>
                )}

                {/* UPLOAD IMAGE */}

                {imageMode === 'upload' && (
                  <label>
                    Upload Thumbnail

                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                      onChange={
                        handleFileChange
                      }
                    />

                    <small
                      style={{
                        display: 'block',
                        marginTop: '6px',
                      }}
                    >
                      JPG, JPEG, PNG or WEBP ·
                      Maximum 5 MB
                    </small>
                  </label>
                )}

                {/* PREVIEW */}

                {(previewUrl ||
                  editing.thumbnail_url) && (
                  <img
                    className="preview"
                    src={
                      previewUrl ||
                      resolveThumbnail(
                        editing.thumbnail_url
                      )
                    }
                    alt="Thumbnail preview"
                    style={{
                      maxWidth: '320px',
                      width: '100%',
                      aspectRatio: '16 / 9',
                      objectFit: 'cover',
                      borderRadius: '10px',
                    }}
                  />
                )}

                {/* ACTIVE STATUS */}

                <label>
                  <input
                    type="checkbox"
                    checked={
                      editing.is_active !== false
                    }
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        is_active:
                          e.target.checked,
                      })
                    }
                  />{' '}
                  Active
                </label>

                <div className="actions">
                  <button
                    type="button"
                    onClick={closeVideoForm}
                    disabled={busy}
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
                        : 'Add Video'}
                  </button>
                </div>
              </fieldset>
            </form>
          )}

          {/* VIDEO FILTERS */}

          <div style={filterStyle}>
            <input
              type="search"
              placeholder="Search videos..."
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              style={{
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #DDDDDD',
                width: '100%',
              }}
            />

            <select
              value={categoryFilter}
              onChange={(e) =>
                setCategoryFilter(
                  e.target.value
                )
              }
              style={{
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #DDDDDD',
              }}
            >
              <option value="all">
                All Categories
              </option>

              <option value="uncategorized">
                Uncategorized
              </option>

              {categories.map(
                (category) => (
                  <option
                    key={category.id}
                    value={category.id}
                  >
                    {category.name_en}
                  </option>
                )
              )}
            </select>

            <select
              value={labelFilter}
              onChange={(e) =>
                setLabelFilter(e.target.value)
              }
              style={{
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #DDDDDD',
              }}
            >
              <option value="all">
                All Video Types
              </option>

              <option value="live">
                Live Darshan
              </option>

              <option value="watch">
                Watch Videos
              </option>
            </select>

            <button
              type="button"
              onClick={() => {
                setSearch('');
                setCategoryFilter('all');
                setLabelFilter('all');
              }}
            >
              Reset Filters
            </button>
          </div>

          <p
            style={{
              color: '#786B60',
              marginBottom: '12px',
            }}
          >
            Showing {filteredItems.length} of{' '}
            {items.length} videos
          </p>

          {/* VIDEOS TABLE */}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Thumbnail</th>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Type</th>
                  <th>YouTube</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredItems.map(
                  (item) => (
                    <tr key={item.id}>

                      <td>
                        {item.thumbnail_url ? (
                          <img
                            className="thumb"
                            src={resolveThumbnail(
                              item.thumbnail_url
                            )}
                            alt={item.title}
                          />
                        ) : (
                          <div className="thumb empty">
                            —
                          </div>
                        )}
                      </td>

                      <td>
                        <strong>
                          {item.title}
                        </strong>

                        {item.description && (
                          <div
                            style={{
                              color: '#786B60',
                              fontSize: '13px',
                              marginTop: '6px',
                              maxWidth: '300px',
                            }}
                          >
                            {item.description}
                          </div>
                        )}
                      </td>

                      <td>
                        <span
                          style={{
                            display: 'inline-block',
                            background: '#F7EBD7',
                            color: MAROON,
                            borderRadius: '20px',
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: 600,
                          }}
                        >
                          {item.category_name ||
                            'Uncategorized'}
                        </span>
                      </td>

                      <td>
                        <span
                          style={{
                            padding: '5px 10px',
                            borderRadius: '20px',
                            fontWeight: 600,
                            fontSize: '12px',

                            background:
                              item.label === 'live'
                                ? '#FEE2E2'
                                : '#E8EEF9',

                            color:
                              item.label === 'live'
                                ? '#B91C1C'
                                : '#1D4ED8',
                          }}
                        >
                          {item.label === 'live'
                            ? 'LIVE'
                            : 'WATCH'}
                        </span>
                      </td>

                      <td>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open YouTube
                        </a>
                      </td>

                      <td>
                        <span
                          style={statusBadge(
                            item.is_active
                          )}
                        >
                          {item.is_active
                            ? 'Active'
                            : 'Inactive'}
                        </span>
                      </td>

                      <td>
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '7px',
                          }}
                        >
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              openEditForm(item)
                            }
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            className="danger"
                            disabled={busy}
                            onClick={() =>
                              removeVideo(item.id)
                            }
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                )}

                {!loading &&
                  filteredItems.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        style={{
                          textAlign: 'center',
                          padding: '32px',
                          color: '#786B60',
                        }}
                      >
                        No videos found.
                      </td>
                    </tr>
                  )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* =================================
          MANAGE CATEGORIES
      ================================= */}

      {activeTab === 'categories' && (
        <>

          {/* CATEGORY FORM */}

          {editingCategory && (
            <form
              className="form-card"
              onSubmit={saveCategory}
            >
              <h3>
                {editingCategory.id
                  ? 'Edit Category'
                  : 'Add Category'}
              </h3>

              <p
                style={{
                  color: '#786B60',
                  marginBottom: '20px',
                }}
              >
                Enter category names in all
                supported languages. English is
                required. Missing translations
                will use the English name.
              </p>

              <fieldset
                disabled={busy}
                style={{
                  border: 0,
                  padding: 0,
                  margin: 0,
                  minWidth: 0,
                }}
              >
                <div className="grid2">
                  {LANGUAGE_FIELDS.map(
                    ({
                      field,
                      label,
                      placeholder,
                    }) => (
                      <label key={field}>
                        {label}

                        {field === 'name_en'
                          ? ' *'
                          : ''}

                        <input
                          value={
                            editingCategory[
                              field
                            ] || ''
                          }
                          onChange={(e) =>
                            setEditingCategory({
                              ...editingCategory,

                              [field]:
                                e.target.value,
                            })
                          }
                          placeholder={
                            placeholder
                          }
                          required={
                            field === 'name_en'
                          }
                          maxLength={100}
                        />
                      </label>
                    )
                  )}

                  {/* DISPLAY ORDER */}

                  <label>
                    Display Order

                    <input
                      type="number"
                      min={0}
                      max={2147483647}
                      step={1}
                      required
                      value={
                        editingCategory.sort_order ??
                        0
                      }
                      onChange={(e) =>
                        setEditingCategory({
                          ...editingCategory,

                          sort_order:
                            e.target.value === ''
                              ? undefined
                              : Number(
                                  e.target.value
                                ),
                        })
                      }
                    />

                    <small
                      style={{
                        display: 'block',
                        color: '#786B60',
                        marginTop: '6px',
                      }}
                    >
                      Lower numbers appear first
                      in the mobile application.
                    </small>
                  </label>
                </div>

                {/* ACTIVE STATUS */}

                <label>
                  <input
                    type="checkbox"
                    checked={
                      editingCategory.is_active !==
                      false
                    }
                    onChange={(e) =>
                      setEditingCategory({
                        ...editingCategory,

                        is_active:
                          e.target.checked,
                      })
                    }
                  />{' '}
                  Active Category
                </label>

                <div className="actions">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      setEditingCategory(null)
                    }
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
                      : editingCategory.id
                        ? 'Save Changes'
                        : 'Add Category'}
                  </button>
                </div>
              </fieldset>
            </form>
          )}

          {/* CATEGORY INFORMATION */}

          <div
            style={{
              padding: '15px 18px',
              background: '#FFF9EB',
              border: '1px solid #E9D6A8',
              borderRadius: '10px',
              marginBottom: '20px',
              color: '#715928',
              fontSize: '14px',
              lineHeight: 1.6,
            }}
          >
            All Videos and Live Darshan are
            automatic filters in the mobile app.
            They do not need separate categories.
            Deleting a category will not delete
            its videos.
          </div>

          {/* CATEGORIES TABLE */}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Category</th>
                  <th>Translations</th>
                  <th>Videos</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {categories.map(
                  (category) => (
                    <tr key={category.id}>

                      <td>
                        <span
                          style={{
                            background: '#F7EBD7',
                            color: MAROON,
                            padding: '7px 12px',
                            borderRadius: '8px',
                            fontWeight: 700,
                          }}
                        >
                          {category.sort_order}
                        </span>
                      </td>

                      <td>
                        <strong
                          style={{
                            color: MAROON,
                          }}
                        >
                          {category.name_en}
                        </strong>
                      </td>

                      <td>
                        <div
                          style={{
                            display: 'grid',
                            gap: '5px',
                            fontSize: '13px',
                          }}
                        >
                          <div>
                            TE:{' '}
                            {category.name_te ||
                              '—'}
                          </div>

                          <div>
                            KN:{' '}
                            {category.name_kn ||
                              '—'}
                          </div>

                          <div>
                            HI:{' '}
                            {category.name_hi ||
                              '—'}
                          </div>

                          <div>
                            TA:{' '}
                            {category.name_ta ||
                              '—'}
                          </div>
                        </div>
                      </td>

                      <td>
                        <strong>
                          {category.video_count ??
                            0}
                        </strong>
                      </td>

                      <td>
                        <span
                          style={statusBadge(
                            category.is_active
                          )}
                        >
                          {category.is_active
                            ? 'Active'
                            : 'Inactive'}
                        </span>
                      </td>

                      <td>
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '7px',
                          }}
                        >
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              openEditCategory(
                                category
                              )
                            }
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              toggleCategory(
                                category
                              )
                            }
                          >
                            {category.is_active
                              ? 'Deactivate'
                              : 'Activate'}
                          </button>

                          <button
                            type="button"
                            className="danger"
                            disabled={busy}
                            onClick={() =>
                              removeCategory(
                                category
                              )
                            }
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                )}

                {!loading &&
                  categories.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        style={{
                          textAlign: 'center',
                          padding: '32px',
                          color: '#786B60',
                        }}
                      >
                        No categories found.
                      </td>
                    </tr>
                  )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}