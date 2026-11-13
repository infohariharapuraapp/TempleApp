
import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useRef,
  useState,
} from 'react';

import { apiRequest } from '../lib/api';

// ========================================
// TYPES
// ========================================

type Activity = {
  id: number;
  title: string;
  description?: string;
  image_url?: string;
  activity_date?: string;
  location?: string;
  section_id?: number;
  section_name?: string;
  display_order: number;
  is_active: boolean;
};

type ActivitySection = {
  id: number;
  name: string;
  description?: string;
  icon?: string;
  image_url?: string;
  display_order: number;
  is_active: boolean;
};

type ActivitySectionForm = {
  name: string;
  description: string;
  icon: string;
  image_url: string;
  display_order: number;
  is_active: boolean;
};

type ActivityForm = {
  title: string;
  description: string;
  image_url: string;
  activity_date: string;
  location: string;
  section_id: number | '';
  display_order: number;
  is_active: boolean;
};

const emptyForm: ActivityForm = {
  title: '',
  description: '',
  image_url: '',
  activity_date: '',
  location: '',
  section_id: '',
  display_order: 0,
  is_active: true,
};

const emptySectionForm: ActivitySectionForm = {
  name: '',
  description: '',
  icon: '',
  image_url: '',
  display_order: 0,
  is_active: true,
};

const deleteButtonStyle = {
  backgroundColor: '#dc2626',
  color: '#ffffff',
  border: 'none',
  borderRadius: 6,
  padding: '9px 14px',
  cursor: 'pointer',
};

// ========================================
// ACTIVITIES ADMIN PAGE
// ========================================

export default function Activities() {
  const [items, setItems] = useState<Activity[]>([]);
  const [form, setForm] = useState<ActivityForm>({
    ...emptyForm,
  });

  const [editing, setEditing] = useState<number | null>(null);

  const [imageMode, setImageMode] =
    useState<'url' | 'upload'>('url');

  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');

  const previewRef = useRef<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [deletingActivityId, setDeletingActivityId] =
    useState<number | null>(null);

  // ========================================
  // ACTIVITY SECTION STATES
  // ========================================

  const [sections, setSections] =
    useState<ActivitySection[]>([]);

  const [sectionForm, setSectionForm] =
    useState<ActivitySectionForm>({
      ...emptySectionForm,
    });

  const [editingSection, setEditingSection] =
    useState<number | null>(null);

  const [sectionLoading, setSectionLoading] =
    useState(false);

  const [sectionError, setSectionError] = useState('');
  const [sectionSuccess, setSectionSuccess] = useState('');

  const [deletingSectionId, setDeletingSectionId] =
    useState<number | null>(null);

  const isProcessing =
    loading ||
    sectionLoading ||
    uploading ||
    deletingActivityId !== null ||
    deletingSectionId !== null;

  // ========================================
  // LOAD ACTIVITIES
  // ========================================

  async function loadActivities() {
    try {
      setLoading(true);
      setError('');

      const result = await apiRequest<{
        success: boolean;
        data: Activity[];
      }>('/admin/activities');

      setItems(result.data || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load activities'
      );
    } finally {
      setLoading(false);
    }
  }

  // ========================================
  // LOAD ACTIVITY SECTIONS
  // ========================================

  async function loadSections() {
    try {
      setSectionLoading(true);
      setSectionError('');

      const result = await apiRequest<{
        success: boolean;
        data: ActivitySection[];
      }>('/activity-sections/admin/all');

      setSections(result.data || []);
    } catch (err) {
      setSectionError(
        err instanceof Error
          ? err.message
          : 'Failed to load activity sections'
      );
    } finally {
      setSectionLoading(false);
    }
  }

  useEffect(() => {
    void loadActivities();
    void loadSections();

    return () => {
      if (previewRef.current) {
        URL.revokeObjectURL(previewRef.current);
      }
    };
  }, []);

  // ========================================
  // ACTIVITY FORM HELPERS
  // ========================================

  function updateField(
    field: keyof ActivityForm,
    value: string | number | boolean
  ) {
    setForm(current => ({
      ...current,
      [field]: value,
    }));
  }

  function clearPreview() {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }

    setPreviewUrl('');
  }

  function startEdit(activity: Activity) {
    if (isProcessing) return;

    clearPreview();

    setEditing(activity.id);

    setForm({
      title: activity.title || '',
      description: activity.description || '',
      image_url: activity.image_url || '',
      activity_date: activity.activity_date
        ? activity.activity_date.substring(0, 10)
        : '',
      location: activity.location || '',
      section_id: activity.section_id ?? '',
      display_order: activity.display_order ?? 0,
      is_active: activity.is_active,
    });

    setImageMode('url');
    setError('');
    setSuccess('');

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  function cancelEdit() {
    clearPreview();

    setEditing(null);
    setForm({ ...emptyForm });
    setImageMode('url');
    setError('');
  }

  // ========================================
  // CREATE / UPDATE ACTIVITY
  // ========================================

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (isProcessing) return;

    if (!form.title.trim()) {
      setError('Activity title is required.');
      return;
    }

    if (!form.section_id) {
      setError('Activity section is required.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const payload = {
        ...form,
        title: form.title.trim(),
        description: form.description.trim(),
        location: form.location.trim(),
        image_url: form.image_url.trim(),
      };

      if (editing !== null) {
        await apiRequest(`/admin/activities/${editing}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest('/admin/activities', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      const message =
        editing !== null
          ? 'Activity updated successfully.'
          : 'Activity created successfully.';

      cancelEdit();
      await loadActivities();

      setSuccess(message);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to save activity'
      );
    } finally {
      setLoading(false);
    }
  }

  // ========================================
  // ACTIVATE / DEACTIVATE ACTIVITY
  // ========================================

  async function toggleActivity(activity: Activity) {
    if (isProcessing) return;

    if (!activity.section_id) {
      setError(
        'This activity does not have a section. ' +
        'Please edit it and select a section.'
      );
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      await apiRequest(`/admin/activities/${activity.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: activity.title,
          description: activity.description || '',
          image_url: activity.image_url || '',
          activity_date: activity.activity_date
            ? activity.activity_date.substring(0, 10)
            : '',
          location: activity.location || '',
          section_id: activity.section_id,
          display_order: activity.display_order ?? 0,
          is_active: !activity.is_active,
        }),
      });

      await loadActivities();

      setSuccess(
        `Activity ${
          activity.is_active ? 'deactivated' : 'activated'
        } successfully.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to update activity'
      );
    } finally {
      setLoading(false);
    }
  }

  // ========================================
  // PERMANENTLY DELETE ACTIVITY
  // ========================================

  async function deleteActivity(activity: Activity) {
    if (isProcessing) return;

    const confirmed = window.confirm(
      `Permanently delete "${activity.title}"?\n\n` +
      'This activity will be removed from the database.\n' +
      'This action cannot be undone.'
    );

    if (!confirmed) return;

    setDeletingActivityId(activity.id);
    setError('');
    setSuccess('');

    try {
      await apiRequest(
        `/admin/activities/${activity.id}`,
        {
          method: 'DELETE',
        }
      );

      setItems(previous =>
        previous.filter(item => item.id !== activity.id)
      );

      if (editing === activity.id) {
        cancelEdit();
      }

      setSuccess(
        `"${activity.title}" deleted successfully.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to delete activity'
      );
    } finally {
      setDeletingActivityId(null);
    }
  }

  // ========================================
  // ACTIVITY SECTION FORM HELPERS
  // ========================================

  function updateSectionField(
    field: keyof ActivitySectionForm,
    value: string | number | boolean
  ) {
    setSectionForm(current => ({
      ...current,
      [field]: value,
    }));
  }

  function startEditSection(section: ActivitySection) {
    if (isProcessing) return;

    setEditingSection(section.id);

    setSectionForm({
      name: section.name || '',
      description: section.description || '',
      icon: section.icon || '',
      image_url: section.image_url || '',
      display_order: section.display_order ?? 0,
      is_active: section.is_active,
    });

    setSectionError('');
    setSectionSuccess('');
  }

  function cancelSectionEdit() {
    setEditingSection(null);
    setSectionForm({ ...emptySectionForm });
    setSectionError('');
  }

  // ========================================
  // CREATE / UPDATE ACTIVITY SECTION
  // ========================================

  async function handleSectionSubmit(event: FormEvent) {
    event.preventDefault();

    if (isProcessing) return;

    if (!sectionForm.name.trim()) {
      setSectionError('Section name is required.');
      return;
    }

    try {
      setSectionLoading(true);
      setSectionError('');
      setSectionSuccess('');

      const payload = {
        ...sectionForm,
        name: sectionForm.name.trim(),
        description: sectionForm.description.trim(),
        icon: sectionForm.icon.trim(),
        image_url: sectionForm.image_url.trim(),
      };

      if (editingSection !== null) {
        await apiRequest(
          `/activity-sections/admin/${editingSection}`,
          {
            method: 'PUT',
            body: JSON.stringify(payload),
          }
        );
      } else {
        await apiRequest(
          '/activity-sections/admin',
          {
            method: 'POST',
            body: JSON.stringify(payload),
          }
        );
      }

      const message =
        editingSection !== null
          ? 'Activity section updated successfully.'
          : 'Activity section created successfully.';

      cancelSectionEdit();
      await loadSections();

      setSectionSuccess(message);
    } catch (err) {
      setSectionError(
        err instanceof Error
          ? err.message
          : 'Failed to save activity section'
      );
    } finally {
      setSectionLoading(false);
    }
  }

  // ========================================
  // ACTIVATE / DEACTIVATE SECTION
  // ========================================

  async function toggleSection(section: ActivitySection) {
    if (isProcessing) return;

    try {
      setSectionLoading(true);
      setSectionError('');
      setSectionSuccess('');

      await apiRequest(
        `/activity-sections/admin/${section.id}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            name: section.name,
            description: section.description || '',
            icon: section.icon || '',
            image_url: section.image_url || '',
            display_order: section.display_order ?? 0,
            is_active: !section.is_active,
          }),
        }
      );

      await loadSections();

      setSectionSuccess(
        `Section ${
          section.is_active ? 'deactivated' : 'activated'
        } successfully.`
      );
    } catch (err) {
      setSectionError(
        err instanceof Error
          ? err.message
          : 'Failed to update activity section'
      );
    } finally {
      setSectionLoading(false);
    }
  }

  // ========================================
  // PERMANENTLY DELETE ACTIVITY SECTION
  // ========================================

  async function deleteActivitySection(
    section: ActivitySection
  ) {
    if (isProcessing) return;

    const activitiesInSection = items.filter(
      activity =>
        Number(activity.section_id) === section.id
    );

    if (activitiesInSection.length > 0) {
      setSectionError(
        `Cannot delete "${section.name}". ` +
        `It contains ${activitiesInSection.length} ` +
        'activities. Move or delete those activities first.'
      );
      return;
    }

    const confirmed = window.confirm(
      `Permanently delete section "${section.name}"?\n\n` +
      'This action cannot be undone.'
    );

    if (!confirmed) return;

    setDeletingSectionId(section.id);
    setSectionError('');
    setSectionSuccess('');

    try {
      await apiRequest(
        `/activity-sections/admin/${section.id}`,
        {
          method: 'DELETE',
        }
      );

      setSections(previous =>
        previous.filter(item => item.id !== section.id)
      );

      if (editingSection === section.id) {
        cancelSectionEdit();
      }

      setSectionSuccess(
        `"${section.name}" deleted successfully.`
      );
    } catch (err) {
      setSectionError(
        err instanceof Error
          ? err.message
          : 'Failed to delete activity section'
      );
    } finally {
      setDeletingSectionId(null);
    }
  }

  // ========================================
  // IMAGE SELECTION / PREVIEW
  // ========================================

  function handleImageUpload(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    clearPreview();
    setUploading(true);
    setError('');

    try {
      if (!file.type.startsWith('image/')) {
        throw new Error('Please select an image file.');
      }

      const url = URL.createObjectURL(file);

      previewRef.current = url;
      setPreviewUrl(url);

      // Preview only.
      // No upload endpoint was present in the
      // original Activities.tsx.
      // Do not save blob URLs to PostgreSQL.
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to select image'
      );
    } finally {
      setUploading(false);
    }
  }

  // ========================================
  // UI
  // ========================================

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Activities</h1>
          <p>
            Manage activity sections and activities
            shown in the devotee app.
          </p>
        </div>
      </div>

      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}

      {success && (
        <div className="card" role="status">
          {success}
        </div>
      )}

      {/* =====================================
          ACTIVITY SECTIONS
      ===================================== */}

      <div className="card">
        <div className="section-header">
          <div>
            <h2>Activity Sections</h2>
            <p>
              Create and manage categories for activities.
            </p>
          </div>
        </div>

        {sectionError && (
          <div className="error-message" role="alert">
            {sectionError}
          </div>
        )}

        {sectionSuccess && (
          <div className="card" role="status">
            {sectionSuccess}
          </div>
        )}

        <form onSubmit={handleSectionSubmit}>
          <div className="form-grid">
            <div className="form-field">
              <label>Section Name *</label>
              <input
                type="text"
                value={sectionForm.name}
                onChange={event =>
                  updateSectionField(
                    'name',
                    event.target.value
                  )
                }
                placeholder="Example: Yearly Activities"
                required
              />
            </div>

            <div className="form-field">
              <label>Icon</label>
              <input
                type="text"
                value={sectionForm.icon}
                onChange={event =>
                  updateSectionField(
                    'icon',
                    event.target.value
                  )
                }
                placeholder="Example: 📅"
              />
            </div>

            <div className="form-field">
              <label>Display Order</label>
              <input
                type="number"
                min="0"
                value={sectionForm.display_order}
                onChange={event =>
                  updateSectionField(
                    'display_order',
                    Number(event.target.value)
                  )
                }
              />
            </div>

            <div className="form-field">
              <label>Status</label>
              <select
                value={
                  sectionForm.is_active
                    ? 'active'
                    : 'inactive'
                }
                onChange={event =>
                  updateSectionField(
                    'is_active',
                    event.target.value === 'active'
                  )
                }
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="form-field">
            <label>Short Description</label>
            <textarea
              value={sectionForm.description}
              onChange={event =>
                updateSectionField(
                  'description',
                  event.target.value
                )
              }
              placeholder="Enter short section description"
              rows={3}
            />
          </div>

          <div className="form-field">
            <label>Section Image URL</label>
            <input
              type="text"
              value={sectionForm.image_url}
              onChange={event =>
                updateSectionField(
                  'image_url',
                  event.target.value
                )
              }
              placeholder="https://example.com/section-image.jpg"
            />
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="primary-button"
              disabled={isProcessing}
            >
              {sectionLoading
                ? 'Saving...'
                : editingSection !== null
                  ? 'Update Section'
                  : 'Add Section'}
            </button>

            {editingSection !== null && (
              <button
                type="button"
                className="secondary-button"
                disabled={isProcessing}
                onClick={cancelSectionEdit}
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        {/* EXISTING SECTIONS */}

        <div style={{ marginTop: 24 }}>
          <h3>Existing Sections</h3>

          {sectionLoading && sections.length === 0 ? (
            <p>Loading sections...</p>
          ) : sections.length === 0 ? (
            <p>No activity sections found.</p>
          ) : (
            <div className="items-list">
              {sections.map(section => (
                <div
                  className="item-row"
                  key={section.id}
                >
                  <div className="item-image">
                    {section.image_url ? (
                      <img
                        src={section.image_url}
                        alt={section.name}
                        loading="lazy"
                      />
                    ) : (
                      <div className="no-image">
                        {section.icon || '📂'}
                      </div>
                    )}
                  </div>

                  <div className="item-content">
                    <h3>
                      {section.icon
                        ? `${section.icon} `
                        : ''}
                      {section.name}
                    </h3>

                    {section.description && (
                      <p>{section.description}</p>
                    )}

                    <span>
                      Display Order:{' '}
                      {section.display_order}
                    </span>

                    <span>
                      Status:{' '}
                      {section.is_active
                        ? 'Active'
                        : 'Inactive'}
                    </span>
                  </div>

                  <div
                    className="item-actions"
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 8,
                    }}
                  >
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() =>
                        startEditSection(section)
                      }
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() =>
                        void toggleSection(section)
                      }
                    >
                      {section.is_active
                        ? 'Deactivate'
                        : 'Activate'}
                    </button>

                    <button
                      type="button"
                      className="danger"
                      style={deleteButtonStyle}
                      disabled={isProcessing}
                      onClick={() =>
                        void deleteActivitySection(section)
                      }
                    >
                      {deletingSectionId === section.id
                        ? 'Deleting...'
                        : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* =====================================
          ACTIVITY FORM
      ===================================== */}

      <div className="card">
        <h2>
          {editing !== null
            ? 'Edit Activity'
            : 'Add Activity'}
        </h2>

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-field">
              <label>Title *</label>
              <input
                type="text"
                value={form.title}
                onChange={event =>
                  updateField(
                    'title',
                    event.target.value
                  )
                }
                placeholder="Enter activity title"
                required
              />
            </div>

            <div className="form-field">
              <label>Activity Section *</label>
              <select
                value={form.section_id}
                onChange={event =>
                  updateField(
                    'section_id',
                    event.target.value
                      ? Number(event.target.value)
                      : ''
                  )
                }
                required
              >
                <option value="">
                  Select Activity Section
                </option>

                {sections
                  .filter(
                    section =>
                      section.is_active ||
                      section.id === form.section_id
                  )
                  .map(section => (
                    <option
                      key={section.id}
                      value={section.id}
                    >
                      {section.icon
                        ? `${section.icon} `
                        : ''}
                      {section.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="form-field">
              <label>Display Order</label>
              <input
                type="number"
                min="0"
                value={form.display_order}
                onChange={event =>
                  updateField(
                    'display_order',
                    Number(event.target.value)
                  )
                }
              />
            </div>

            <div className="form-field">
              <label>Activity Date</label>
              <input
                type="date"
                value={form.activity_date}
                onChange={event =>
                  updateField(
                    'activity_date',
                    event.target.value
                  )
                }
              />
            </div>

            <div className="form-field">
              <label>Location</label>
              <input
                type="text"
                value={form.location}
                onChange={event =>
                  updateField(
                    'location',
                    event.target.value
                  )
                }
                placeholder="Enter location"
              />
            </div>
          </div>

          <div className="form-field">
            <label>Description</label>
            <textarea
              value={form.description}
              onChange={event =>
                updateField(
                  'description',
                  event.target.value
                )
              }
              placeholder="Enter activity description"
              rows={5}
            />
          </div>

          {/* IMAGE INPUT */}

          <div className="form-field">
            <label>Activity Image</label>

            <div className="image-mode-buttons">
              <button
                type="button"
                className={
                  imageMode === 'url'
                    ? 'mode-button active'
                    : 'mode-button'
                }
                onClick={() =>
                  setImageMode('url')
                }
              >
                Image URL
              </button>

              <button
                type="button"
                className={
                  imageMode === 'upload'
                    ? 'mode-button active'
                    : 'mode-button'
                }
                onClick={() =>
                  setImageMode('upload')
                }
              >
                Upload Image
              </button>
            </div>

            {imageMode === 'url' && (
              <input
                type="text"
                value={form.image_url}
                onChange={event => {
                  clearPreview();
                  updateField(
                    'image_url',
                    event.target.value
                  );
                }}
                placeholder="https://example.com/activity-image.jpg"
              />
            )}

            {imageMode === 'upload' && (
              <>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploading}
                />

                <small>
                  Image selection provides a preview only.
                  Use a hosted image URL to save the image.
                </small>
              </>
            )}

            {(previewUrl || form.image_url) && (
              <div className="image-preview">
                <img
                  src={previewUrl || form.image_url}
                  alt="Activity preview"
                  onError={event => {
                    event.currentTarget.style.display =
                      'none';
                  }}
                />
              </div>
            )}
          </div>

          <div className="form-field">
            <label>Status</label>
            <select
              value={
                form.is_active
                  ? 'active'
                  : 'inactive'
              }
              onChange={event =>
                updateField(
                  'is_active',
                  event.target.value === 'active'
                )
              }
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="primary-button"
              disabled={isProcessing}
            >
              {loading
                ? 'Saving...'
                : editing !== null
                  ? 'Update Activity'
                  : 'Add Activity'}
            </button>

            {editing !== null && (
              <button
                type="button"
                className="secondary-button"
                disabled={isProcessing}
                onClick={cancelEdit}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* =====================================
          ACTIVITIES LIST
      ===================================== */}

      <div className="card">
        <div className="section-header">
          <div>
            <h2>Activities</h2>
            <p>Activities managed by the admin.</p>
          </div>
        </div>

        {loading && items.length === 0 ? (
          <p>Loading activities...</p>
        ) : items.length === 0 ? (
          <p>No activities found.</p>
        ) : (
          <div className="items-list">
            {items.map(activity => (
              <div
                className="item-row"
                key={activity.id}
              >
                <div className="item-image">
                  {activity.image_url ? (
                    <img
                      src={activity.image_url}
                      alt={activity.title}
                      loading="lazy"
                    />
                  ) : (
                    <div className="no-image">
                      No Image
                    </div>
                  )}
                </div>

                <div className="item-content">
                  <h3>{activity.title}</h3>

                  {activity.section_name && (
                    <span>
                      Section:{' '}
                      {activity.section_name}
                    </span>
                  )}

                  {activity.description && (
                    <p>{activity.description}</p>
                  )}

                  {activity.activity_date && (
                    <span>
                      Date:{' '}
                      {activity.activity_date.substring(
                        0,
                        10
                      )}
                    </span>
                  )}

                  {activity.location && (
                    <span>
                      Location:{' '}
                      {activity.location}
                    </span>
                  )}

                  <span>
                    Display Order:{' '}
                    {activity.display_order}
                  </span>

                  <span>
                    Status:{' '}
                    {activity.is_active
                      ? 'Active'
                      : 'Inactive'}
                  </span>
                </div>

                <div
                  className="item-actions"
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() =>
                      startEdit(activity)
                    }
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() =>
                      void toggleActivity(activity)
                    }
                  >
                    {activity.is_active
                      ? 'Deactivate'
                      : 'Activate'}
                  </button>

                  <button
                    type="button"
                    className="danger"
                    style={deleteButtonStyle}
                    disabled={isProcessing}
                    onClick={() =>
                      void deleteActivity(activity)
                    }
                  >
                    {deletingActivityId === activity.id
                      ? 'Deleting...'
                      : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
