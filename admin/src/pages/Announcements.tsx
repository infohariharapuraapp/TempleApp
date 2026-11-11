
import { useEffect, useMemo, useState } from 'react';
import type {
  CSSProperties,
  ChangeEvent,
  FormEvent,
} from 'react';

import { apiRequest } from '../lib/api';

// ========================================
// TYPES
// ========================================

type Announcement = {
  id: number;
  title: string;
  message: string;
  image_url: string | null;
  category: string;
  is_pinned: boolean;
  expires_at: string | null;
  attachment_url: string | null;
  is_active: boolean;
  publish_at: string | null;
  created_at: string;
  updated_at: string;
};

type AnnouncementForm = {
  title: string;
  message: string;
  image_url: string;
  category: string;
  is_pinned: boolean;
  expires_at: string;
  attachment_url: string;
  is_active: boolean;
  publish_at: string;
  send_notification: boolean;
};

type UploadResponse = {
  success: boolean;
  message?: string;
  data: {
    image_url?: string;
    attachment_url?: string;
    public_id?: string;
  };
};

type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data: T;
};

// ========================================
// CONSTANTS
// ========================================

const CATEGORIES = [
  'General',
  'Festivals',
  'Poojas',
  'Sevas',
  'Important Notices',
  'Special Events',
];

const emptyForm: AnnouncementForm = {
  title: '',
  message: '',
  image_url: '',
  category: 'General',
  is_pinned: false,
  expires_at: '',
  attachment_url: '',
  is_active: true,
  publish_at: '',
  send_notification: false,
};

const C = {
  maroon: '#6B1720',
  maroonDark: '#541018',
  gold: '#C69A3A',
  goldLight: '#F7EBD7',
  cream: '#FFFDF8',
  border: '#E8DCCB',
  text: '#342725',
  muted: '#88766B',
  white: '#FFFFFF',
  green: '#166534',
  red: '#B42318',
};

const inputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '12px 14px',
  border: `1px solid ${C.border}`,
  borderRadius: 10,
  background: C.white,
  color: C.text,
  fontSize: 14,
  outlineColor: C.gold,
};

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 700,
  marginBottom: 8,
  color: C.text,
};

const cardStyle: CSSProperties = {
  background: C.white,
  border: `1px solid ${C.border}`,
  borderRadius: 18,
  padding: 22,
  boxShadow: '0 8px 30px rgba(80,35,20,0.05)',
};

const primaryButton: CSSProperties = {
  background: C.maroon,
  color: C.white,
  border: 'none',
  borderRadius: 10,
  padding: '11px 17px',
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
};

const secondaryButton: CSSProperties = {
  background: C.white,
  color: C.maroon,
  border: `1px solid ${C.border}`,
  borderRadius: 10,
  padding: '10px 14px',
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
};

// ========================================
// HELPERS
// ========================================

function toLocalInput(value?: string | null) {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  const pad = (n: number) =>
    String(n).padStart(2, '0');

  return (
    `${date.getFullYear()}-` +
    `${pad(date.getMonth() + 1)}-` +
    `${pad(date.getDate())}T` +
    `${pad(date.getHours())}:` +
    `${pad(date.getMinutes())}`
  );
}

function formatDate(value?: string | null) {
  if (!value) return 'Not scheduled';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Invalid date';
  }

  return date.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function validUrl(value: string) {
  if (!value.trim()) return true;

  try {
    const url = new URL(value);

    return (
      url.protocol === 'https:' ||
      url.protocol === 'http:'
    );
  } catch {
    return false;
  }
}

function isExpired(item: Announcement) {
  return Boolean(
    item.expires_at &&
    new Date(item.expires_at).getTime() <= Date.now()
  );
}

function isScheduled(item: Announcement) {
  return Boolean(
    item.publish_at &&
    new Date(item.publish_at).getTime() > Date.now()
  );
}

function getStatus(item: Announcement) {
  if (!item.is_active) return 'Inactive';
  if (isExpired(item)) return 'Expired';
  if (isScheduled(item)) return 'Scheduled';

  return 'Published';
}

// ========================================
// MAIN COMPONENT
// ========================================

export default function Announcements() {
  const [items, setItems] = useState<Announcement[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [uploadingPoster, setUploadingPoster] =
    useState(false);

  const [uploadingPdf, setUploadingPdf] =
    useState(false);

  const [posterUploadError, setPosterUploadError] =
    useState('');

  const [pdfUploadError, setPdfUploadError] =
    useState('');

  const [actionId, setActionId] =
    useState<number | null>(null);
  const [deletingId, setDeletingId] =
  useState<number | null>(null);

  const [showForm, setShowForm] = useState(false);

  const [editingId, setEditingId] =
    useState<number | null>(null);

  const [form, setForm] =
    useState<AnnouncementForm>(emptyForm);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] =
    useState('All');

  const [statusFilter, setStatusFilter] =
    useState('All');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const uploading = uploadingPoster || uploadingPdf;
  const formBusy = saving || uploading;

  // ========================================
  // LOAD ANNOUNCEMENTS
  // ========================================

  async function loadAnnouncements() {
    try {
      setLoading(true);

      const response = await apiRequest<
        ApiResponse<Announcement[]>
      >('/admin/announcements');

      if (!response.success) {
        throw new Error(
          response.message ||
          'Failed to load announcements'
        );
      }
      console.log(
  'Saved PDF URLs:',
  (response.data || []).map(item => ({
    id: item.id,
    title: item.title,
    attachment_url: item.attachment_url,
  }))
);

      setItems(response.data || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load announcements'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAnnouncements();
  }, []);

  // ========================================
  // DASHBOARD STATISTICS
  // ========================================

  const stats = useMemo(() => {
    return {
      total: items.length,

      published: items.filter(
        item => getStatus(item) === 'Published'
      ).length,

      scheduled: items.filter(
        item => getStatus(item) === 'Scheduled'
      ).length,

      pinned: items.filter(
        item => item.is_pinned
      ).length,
    };
  }, [items]);

  // ========================================
  // SEARCH AND FILTER
  // ========================================

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return items
      .filter(item => {
        const matchesSearch =
          !keyword ||
          item.title.toLowerCase().includes(keyword) ||
          item.message.toLowerCase().includes(keyword);

        const matchesCategory =
          categoryFilter === 'All' ||
          item.category === categoryFilter;

        const matchesStatus =
          statusFilter === 'All' ||
          getStatus(item) === statusFilter;

        return (
          matchesSearch &&
          matchesCategory &&
          matchesStatus
        );
      })
      .sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) {
          return a.is_pinned ? -1 : 1;
        }

        return (
          new Date(
            b.publish_at || b.created_at
          ).getTime() -
          new Date(
            a.publish_at || a.created_at
          ).getTime()
        );
      });
  }, [
    items,
    search,
    categoryFilter,
    statusFilter,
  ]);

  // ========================================
  // FORM HELPERS
  // ========================================

  function updateField<K extends keyof AnnouncementForm>(
    field: K,
    value: AnnouncementForm[K]
  ) {
    setForm(previous => ({
      ...previous,
      [field]: value,
    }));
  }

  function closeForm() {
    if (formBusy) return;

    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setPosterUploadError('');
    setPdfUploadError('');
  }

  function openCreate() {
    if (formBusy) return;

    setError('');
    setSuccess('');
    setPosterUploadError('');
    setPdfUploadError('');

    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  function openEdit(item: Announcement) {
    if (formBusy) return;

    setError('');
    setSuccess('');
    setPosterUploadError('');
    setPdfUploadError('');

    setEditingId(item.id);

    setForm({
      title: item.title || '',
      message: item.message || '',
      image_url: item.image_url || '',
      category: item.category || 'General',
      is_pinned: Boolean(item.is_pinned),
      expires_at: toLocalInput(item.expires_at),
      attachment_url: item.attachment_url || '',
      is_active: item.is_active,
      publish_at: toLocalInput(item.publish_at),
      send_notification: false,
    });

    setShowForm(true);

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  // ========================================
  // CLOUDINARY POSTER UPLOAD
  // ========================================

  async function handlePosterUpload(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file || uploading || saving) return;

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
    ];

    if (!allowedTypes.includes(file.type)) {
      setPosterUploadError(
        'Only JPG, PNG and WebP images are allowed.'
      );
      event.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setPosterUploadError(
        'Poster must be smaller than 5 MB.'
      );
      event.target.value = '';
      return;
    }

    try {
      setUploadingPoster(true);
      setPosterUploadError('');
      setError('');

      const data = new FormData();

      data.append('image', file);

      const result = await apiRequest<UploadResponse>(
        '/admin/announcements/upload',
        {
          method: 'POST',
          body: data,
        }
      );

      if (!result.success || !result.data?.image_url) {
        throw new Error(
          result.message || 'Poster upload failed'
        );
      }

      updateField(
        'image_url',
        result.data.image_url
      );

      setSuccess(
        'Poster uploaded. Save the update to attach it.'
      );
    } catch (err) {
      setPosterUploadError(
        err instanceof Error
          ? err.message
          : 'Unable to upload poster'
      );
    } finally {
      setUploadingPoster(false);
      event.target.value = '';
    }
  }

  // ========================================
  // CLOUDINARY PDF UPLOAD
  // ========================================

  async function handlePdfUpload(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file || uploading || saving) return;

    if (
      file.type !== 'application/pdf' ||
      !file.name.toLowerCase().endsWith('.pdf')
    ) {
      setPdfUploadError(
        'Only PDF documents are allowed.'
      );
      event.target.value = '';
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setPdfUploadError(
        'PDF must be smaller than 10 MB.'
      );
      event.target.value = '';
      return;
    }

    try {
      setUploadingPdf(true);
      setPdfUploadError('');
      setError('');

      const data = new FormData();

      data.append('file', file);

      const result = await apiRequest<UploadResponse>(
        '/admin/announcements/upload-pdf',
        {
          method: 'POST',
          body: data,
        }
      );

      if (
        !result.success ||
        !result.data?.attachment_url
      ) {
        throw new Error(
          result.message || 'PDF upload failed'
        );
      }

      updateField(
        'attachment_url',
        result.data.attachment_url
      );

      setSuccess(
        'PDF uploaded. Save the update to attach it.'
      );
    } catch (err) {
      setPdfUploadError(
        err instanceof Error
          ? err.message
          : 'Unable to upload PDF'
      );
    } finally {
      setUploadingPdf(false);
      event.target.value = '';
    }
  }

  // ========================================
  // CREATE / EDIT ANNOUNCEMENT
  // ========================================

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (formBusy) {
      setError(
        'Please wait for the current operation to finish.'
      );
      return;
    }

    setError('');
    setSuccess('');

    if (!form.title.trim()) {
      setError('Announcement title is required.');
      return;
    }

    if (!form.message.trim()) {
      setError('Announcement description is required.');
      return;
    }

    if (
      !validUrl(form.image_url) ||
      !validUrl(form.attachment_url)
    ) {
      setError('An attachment contains an invalid URL.');
      return;
    }

    const publishAt = form.publish_at
      ? new Date(form.publish_at)
      : null;

    const expiresAt = form.expires_at
      ? new Date(form.expires_at)
      : null;

    if (
      (publishAt && Number.isNaN(publishAt.getTime())) ||
      (expiresAt && Number.isNaN(expiresAt.getTime()))
    ) {
      setError('Please enter valid dates.');
      return;
    }

    if (
      expiresAt &&
      expiresAt <= (publishAt || new Date())
    ) {
      setError(
        'Expiry date must be later than the publishing date.'
      );
      return;
    }

    if (
      editingId === null &&
      publishAt &&
      publishAt <= new Date()
    ) {
      setError(
        'Scheduled publishing requires a future date.'
      );
      return;
    }

    if (
      editingId === null &&
      publishAt &&
      !form.is_active
    ) {
      setError(
        'Activate the announcement before scheduling.'
      );
      return;
    }

    if (
      editingId === null &&
      form.send_notification &&
      !form.is_active
    ) {
      setError(
        'Activate the announcement before sending.'
      );
      return;
    }


    const payload = {
      
      title: form.title.trim(),
      message: form.message.trim(),
      image_url: form.image_url.trim() || null,
      category: form.category,
      is_pinned: form.is_pinned,
      expires_at:
        expiresAt?.toISOString() || null,
      attachment_url:
        form.attachment_url.trim() || null,
      is_active: form.is_active,
      publish_at:
        publishAt?.toISOString() || null,
    };
    console.log('Saving announcement:', {
  editingId,
  attachment_url: payload.attachment_url,
});

    try {
      setSaving(true);

      if (editingId === null) {
        const created = await apiRequest<
          ApiResponse<Announcement>
        >('/admin/announcements', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        if (!created.success || !created.data?.id) {
          throw new Error(
            created.message ||
            'Failed to create announcement'
          );
        }

        const id = created.data.id;

        // The announcement is created first.
        // Notification actions use existing endpoints.

        try {
          if (publishAt) {
            await apiRequest(
              `/admin/announcements/${id}/schedule`,
              {
                method: 'POST',
                body: JSON.stringify({
                  publish_at: publishAt.toISOString(),
                }),
              }
            );

            setSuccess(
              'Update created and notification scheduled.'
            );
          } else if (form.send_notification) {
            await apiRequest(
              `/admin/announcements/${id}/send`,
              {
                method: 'POST',
              }
            );

            setSuccess(
              'Update created and notification submitted.'
            );
          } else {
            setSuccess(
              'Divyakshetra Update created successfully.'
            );
          }
        } catch (notificationError) {
          setError(
            'The update was created, but notification ' +
            'processing failed: ' +
            (
              notificationError instanceof Error
                ? notificationError.message
                : 'Unknown error'
            ) +
            '. Check before retrying.'
          );
        }
      } else {
        const updated = await apiRequest<{
          success: boolean;
          message?: string;
        }>(
          `/admin/announcements/${editingId}`,
          {
            method: 'PUT',
            body: JSON.stringify(payload),
          }
        );

        if (!updated.success) {
          throw new Error(
            updated.message || 'Update failed'
          );
        }

        setSuccess(
          'Divyakshetra Update saved successfully.'
        );
      }

      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);

      await loadAnnouncements();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save announcement'
      );
    } finally {
      setSaving(false);
    }
  }

  // ========================================
  // ACTIVATE / DEACTIVATE
  // ========================================

  async function toggleActive(item: Announcement) {
    if (actionId !== null || formBusy) return;

    const nextStatus = !item.is_active;

    const confirmed = window.confirm(
      `${nextStatus ? 'Activate' : 'Deactivate'} "${item.title}"?`
    );

    if (!confirmed) return;

    try {
      setActionId(item.id);
      setError('');
      setSuccess('');

      await apiRequest(
        `/admin/announcements/${item.id}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            is_active: nextStatus,
          }),
        }
      );

      setSuccess(
        nextStatus
          ? 'Announcement activated.'
          : 'Announcement deactivated.'
      );

      await loadAnnouncements();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to change status'
      );
    } finally {
      setActionId(null);
    }
  }

  // ========================================
  // PIN / UNPIN
  // ========================================

  async function togglePin(item: Announcement) {
    if (actionId !== null || formBusy) return;

    try {
      setActionId(item.id);
      setError('');
      setSuccess('');

      await apiRequest(
        `/admin/announcements/${item.id}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            is_pinned: !item.is_pinned,
          }),
        }
      );

      setSuccess(
        item.is_pinned
          ? 'Announcement unpinned.'
          : 'Announcement pinned.'
      );

      await loadAnnouncements();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to change pin status'
      );
    } finally {
      setActionId(null);
    }
  }

  // ========================================
  // SEND NOTIFICATION NOW
  // ========================================

  async function sendNow(item: Announcement) {
    if (actionId !== null || formBusy) return;

    if (!item.is_active || isExpired(item)) {
      setError(
        'Announcement must be active and not expired.'
      );
      return;
    }

    const confirmed = window.confirm(
      `Send "${item.title}" notification to all devotees now?`
    );

    if (!confirmed) return;

    try {
      setActionId(item.id);
      setError('');
      setSuccess('');

      const response = await apiRequest<{
        success: boolean;
        message?: string;
      }>(
        `/admin/announcements/${item.id}/send`,
        {
          method: 'POST',
        }
      );

      if (!response.success) {
        throw new Error(
          response.message || 'Notification failed'
        );
      }

      setSuccess(
        response.message ||
        'Notification submitted successfully.'
      );

      await loadAnnouncements();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to send notification'
      );
    } finally {
      setActionId(null);
    }
  }



  // ========================================
  // DELETE ANNOUNCEMENT
  // ========================================

  async function deleteAnnouncement(item: Announcement) {
    if (actionId !== null || formBusy || deletingId !== null) {
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to permanently delete "${item.title}"?\n\n` +
      'This announcement will disappear from the temple app. ' +
      'Any pending scheduled notifications will be cancelled.\n\n' +
      'This action cannot be undone.'
    );

    if (!confirmed) return;

    try {
      setDeletingId(item.id);
      setActionId(item.id);
      setError('');
      setSuccess('');

      const response = await apiRequest<{
        success: boolean;
        message?: string;
      }>(
        `/admin/announcements/${item.id}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.success) {
        throw new Error(
          response.message || 'Unable to delete announcement'
        );
      }

      if (editingId === item.id) {
        setShowForm(false);
        setEditingId(null);
        setForm(emptyForm);
      }

      setItems(previous =>
        previous.filter(existing => existing.id !== item.id)
      );

      setSuccess(
        `"${item.title}" was deleted successfully.`
      );

      await loadAnnouncements();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to delete announcement'
      );
    } finally {
      setDeletingId(null);
      setActionId(null);
    }
  }


  // ========================================
  // RENDER
  // ========================================

  return (
    <div
      className="page"
      style={{
        color: C.text,
        paddingBottom: 40,
      }}
    >
      {/* HEADER */}

      <div
        style={{
          background:
            `linear-gradient(125deg, ${C.maroonDark}, ${C.maroon})`,
          borderRadius: 20,
          padding: '28px 26px',
          marginBottom: 22,
          color: C.white,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div>
            <div
              style={{
                color: '#E8C980',
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: 2,
                marginBottom: 8,
              }}
            >
              DIVYAKSHETRA HARIHARAPURA
            </div>

            <h1
              style={{
                margin: '0 0 8px',
                color: C.white,
                fontSize: 'clamp(24px, 3vw, 34px)',
              }}
            >
              Divyakshetra Updates
            </h1>

            <p
              style={{
                margin: 0,
                color: '#F3DDD5',
                fontSize: 14,
              }}
            >
              Temple announcements, festivals,
              programmes and important notices
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
              onClick={() => void loadAnnouncements()}
              disabled={loading}
              style={{
                ...secondaryButton,
                background: 'transparent',
                color: C.white,
                borderColor: '#AC7C76',
              }}
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>

            <button
              type="button"
              onClick={openCreate}
              disabled={formBusy}
              style={{
                ...primaryButton,
                background: C.gold,
                color: '#321B12',
              }}
            >
              + New Update
            </button>
          </div>
        </div>
      </div>

      {/* STATISTICS */}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 14,
          marginBottom: 22,
        }}
      >
        {[
          ['Total Updates', stats.total],
          ['Published', stats.published],
          ['Scheduled', stats.scheduled],
          ['Pinned', stats.pinned],
        ].map(([label, value]) => (
          <div key={label} style={cardStyle}>
            <div
              style={{
                color: C.muted,
                fontSize: 12,
                marginBottom: 8,
              }}
            >
              {label}
            </div>

            <div
              style={{
                color: C.maroon,
                fontSize: 30,
                fontWeight: 800,
              }}
            >
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* ALERTS */}

      {error && (
        <div
          role="alert"
          style={{
            padding: 14,
            marginBottom: 16,
            borderRadius: 10,
            background: '#FFF0F0',
            color: C.red,
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          style={{
            padding: 14,
            marginBottom: 16,
            borderRadius: 10,
            background: '#EAF8ED',
            color: C.green,
          }}
        >
          {success}
        </div>
      )}

      {/* CREATE / EDIT FORM */}

      {showForm && (
        <div
          style={{
            ...cardStyle,
            background: C.cream,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              marginBottom: 22,
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  color: C.maroon,
                }}
              >
                {editingId === null
                  ? 'Create Divyakshetra Update'
                  : 'Edit Divyakshetra Update'}
              </h2>

              <p
                style={{
                  color: C.muted,
                  fontSize: 13,
                }}
              >
                Publish information for temple devotees.
              </p>
            </div>

            <button
              type="button"
              onClick={closeForm}
              disabled={formBusy}
              style={secondaryButton}
            >
              Close
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {/* TITLE */}

            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>
                Update Title *
              </label>

              <input
                type="text"
                required
                style={inputStyle}
                value={form.title}
                onChange={e =>
                  updateField('title', e.target.value)
                }
                placeholder="Example: Annual Brahmotsavam Celebrations"
              />
            </div>

            {/* DESCRIPTION */}

            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>
                Description *
              </label>

              <textarea
                required
                rows={6}
                style={{
                  ...inputStyle,
                  resize: 'vertical',
                }}
                value={form.message}
                onChange={e =>
                  updateField('message', e.target.value)
                }
                placeholder="Enter complete details for devotees..."
              />
            </div>

            {/* CATEGORY AND POSTER */}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(230px, 1fr))',
                gap: 18,
                marginBottom: 20,
              }}
            >
              <div>
                <label style={labelStyle}>
                  Announcement Category
                </label>

                <select
                  style={inputStyle}
                  value={form.category}
                  onChange={e =>
                    updateField('category', e.target.value)
                  }
                >
                  {CATEGORIES.map(category => (
                    <option
                      key={category}
                      value={category}
                    >
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>
                  Upload Announcement Poster
                </label>

                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePosterUpload}
                  disabled={formBusy}
                  style={{
                    ...inputStyle,
                    padding: 10,
                  }}
                />

                <p
                  style={{
                    color: C.muted,
                    fontSize: 12,
                    marginTop: 7,
                  }}
                >
                  JPG, PNG or WebP — Maximum 5 MB
                </p>

                {uploadingPoster && (
                  <p
                    role="status"
                    style={{
                      color: C.maroon,
                      fontWeight: 700,
                    }}
                  >
                    Uploading poster to Cloudinary...
                  </p>
                )}

                {posterUploadError && (
                  <p
                    role="alert"
                    style={{ color: C.red }}
                  >
                    {posterUploadError}
                  </p>
                )}
              </div>
            </div>

            {/* POSTER PREVIEW */}

            {form.image_url && (
              <div
                style={{
                  marginBottom: 20,
                  padding: 15,
                  background: C.white,
                  border: `1px solid ${C.border}`,
                  borderRadius: 14,
                }}
              >
                <label style={labelStyle}>
                  Poster Preview
                </label>

                {validUrl(form.image_url) && (
                  <img
                    src={form.image_url}
                    alt="Announcement poster"
                    style={{
                      display: 'block',
                      width: '100%',
                      maxWidth: 420,
                      maxHeight: 320,
                      objectFit: 'contain',
                      borderRadius: 10,
                      marginBottom: 12,
                    }}
                  />
                )}

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <span
                    style={{
                      color: C.green,
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    Poster attached
                  </span>

                  <button
                    type="button"
                    style={secondaryButton}
                    disabled={formBusy}
                    onClick={() =>
                      updateField('image_url', '')
                    }
                  >
                    Remove Poster
                  </button>
                </div>
              </div>
            )}

            {/* PDF UPLOAD */}

            <div
              style={{
                padding: 18,
                border: `1px solid ${C.border}`,
                background: C.white,
                borderRadius: 14,
                marginBottom: 20,
              }}
            >
              <label style={labelStyle}>
                PDF Attachment
              </label>

              <input
                type="file"
                accept="application/pdf,.pdf"
                onChange={handlePdfUpload}
                disabled={formBusy}
                style={{
                  ...inputStyle,
                  padding: 10,
                }}
              />

              <p
                style={{
                  color: C.muted,
                  fontSize: 12,
                  marginTop: 8,
                }}
              >
                Upload an invitation, festival notice,
                programme schedule or other PDF.
                Maximum 10 MB.
              </p>

              {uploadingPdf && (
                <p
                  role="status"
                  style={{
                    color: C.maroon,
                    fontWeight: 700,
                  }}
                >
                  Uploading PDF to Cloudinary...
                </p>
              )}

              {pdfUploadError && (
                <p
                  role="alert"
                  style={{ color: C.red }}
                >
                  {pdfUploadError}
                </p>
              )}

              {form.attachment_url && (
                <div
                  style={{
                    marginTop: 14,
                    padding: 14,
                    background: C.cream,
                    border: `1px solid ${C.border}`,
                    borderRadius: 12,
                  }}
                >
                  <p
                    style={{
                      margin: '0 0 12px',
                      fontSize: 13,
                      color: C.green,
                      fontWeight: 700,
                    }}
                  >
                    PDF attached
                  </p>

                  <div
                    style={{
                      display: 'flex',
                      gap: 10,
                      flexWrap: 'wrap',
                    }}
                  >
                    {validUrl(form.attachment_url) && (
                      <a
                        href={form.attachment_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          ...secondaryButton,
                          textDecoration: 'none',
                        }}
                      >
                        View PDF
                      </a>
                    )}

                    <button
                      type="button"
                      style={secondaryButton}
                      disabled={formBusy}
                      onClick={() => {
                        updateField(
                          'attachment_url',
                          ''
                        );
                        setPdfUploadError('');
                      }}
                    >
                      Remove PDF
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* PUBLISH AND EXPIRY */}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(230px, 1fr))',
                gap: 18,
                marginBottom: 20,
              }}
            >
              <div>
                <label style={labelStyle}>
                  Publish Date & Time
                </label>

                <input
                  type="datetime-local"
                  style={inputStyle}
                  value={form.publish_at}
                  onChange={e =>
                    updateField(
                      'publish_at',
                      e.target.value
                    )
                  }
                />

                <small style={{ color: C.muted }}>
                  Leave empty to publish immediately.
                </small>
              </div>

              <div>
                <label style={labelStyle}>
                  Expiry Date & Time
                </label>

                <input
                  type="datetime-local"
                  style={inputStyle}
                  value={form.expires_at}
                  onChange={e =>
                    updateField(
                      'expires_at',
                      e.target.value
                    )
                  }
                />

                <small style={{ color: C.muted }}>
                  Optional. Expired updates are hidden
                  automatically.
                </small>
              </div>
            </div>

            {/* ACTIVE AND PINNED */}

            <div
              style={{
                display: 'flex',
                gap: 24,
                flexWrap: 'wrap',
                marginBottom: 20,
              }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontWeight: 600,
                }}
              >
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={e =>
                    updateField(
                      'is_active',
                      e.target.checked
                    )
                  }
                />

                Active Announcement
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontWeight: 600,
                }}
              >
                <input
                  type="checkbox"
                  checked={form.is_pinned}
                  onChange={e =>
                    updateField(
                      'is_pinned',
                      e.target.checked
                    )
                  }
                />

                Pin Important Update
              </label>
            </div>

            {/* NOTIFICATION OPTIONS */}

            {editingId === null && !form.publish_at && (
              <div
                style={{
                  padding: 15,
                  background: '#FFF5E3',
                  border: '1px solid #EAD6AC',
                  borderRadius: 12,
                  marginBottom: 20,
                }}
              >
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    fontWeight: 700,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.send_notification}
                    onChange={e =>
                      updateField(
                        'send_notification',
                        e.target.checked
                      )
                    }
                  />

                  Send Push Notification Now
                </label>

                <p
                  style={{
                    margin: '8px 0 0',
                    fontSize: 12,
                    color: C.muted,
                  }}
                >
                  Send this announcement to registered
                  devotees after creating it.
                </p>
              </div>
            )}

            {editingId === null && form.publish_at && (
              <div
                style={{
                  padding: 15,
                  background: '#F1F5FF',
                  color: '#304E89',
                  borderRadius: 12,
                  fontSize: 13,
                  marginBottom: 20,
                }}
              >
                The announcement will be published at
                the selected time, and its notification
                will be scheduled using the backend.
              </div>
            )}

            {/* FORM ACTIONS */}

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                onClick={closeForm}
                disabled={formBusy}
                style={secondaryButton}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={formBusy}
                style={{
                  ...primaryButton,
                  opacity: formBusy ? 0.6 : 1,
                }}
              >
                {saving
                  ? 'Saving...'
                  : uploading
                  ? 'Uploading...'
                  : editingId === null
                  ? 'Publish Update'
                  : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* FILTERS */}

      <div
        style={{
          ...cardStyle,
          marginBottom: 20,
        }}
      >
        <h2
          style={{
            margin: '0 0 16px',
            color: C.maroon,
          }}
        >
          Manage Updates
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(190px, 1fr))',
            gap: 12,
          }}
        >
          <input
            style={inputStyle}
            placeholder="Search updates..."
            value={search}
            onChange={e =>
              setSearch(e.target.value)
            }
          />

          <select
            style={inputStyle}
            value={categoryFilter}
            onChange={e =>
              setCategoryFilter(e.target.value)
            }
          >
            <option value="All">
              All Categories
            </option>

            {CATEGORIES.map(category => (
              <option
                key={category}
                value={category}
              >
                {category}
              </option>
            ))}
          </select>

          <select
            style={inputStyle}
            value={statusFilter}
            onChange={e =>
              setStatusFilter(e.target.value)
            }
          >
            {[
              'All',
              'Published',
              'Scheduled',
              'Inactive',
              'Expired',
            ].map(status => (
              <option
                key={status}
                value={status}
              >
                {status}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ANNOUNCEMENT CARDS */}

      {loading && items.length === 0 ? (
        <div style={cardStyle}>
          Loading announcements...
        </div>
      ) : filteredItems.length === 0 ? (
        <div style={cardStyle}>
          No announcements found.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
            gap: 18,
          }}
        >
          {filteredItems.map(item => {
            const busy =
              actionId !== null || formBusy;

            const status = getStatus(item);

            return (
              <article
                key={item.id}
                style={{
                  ...cardStyle,
                  padding: 0,
                  overflow: 'hidden',
                }}
              >
                {/* POSTER */}

                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.title}
                    style={{
                      width: '100%',
                      height: 190,
                      objectFit: 'cover',
                      background: C.cream,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      height: 135,
                      background:
                        `linear-gradient(135deg, ${C.maroon}, ${C.maroonDark})`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#F1D59A',
                      fontWeight: 800,
                      letterSpacing: 1,
                    }}
                  >
                    DIVYAKSHETRA
                  </div>
                )}

                <div style={{ padding: 19 }}>
                  {/* BADGES */}

                  <div
                    style={{
                      display: 'flex',
                      gap: 7,
                      flexWrap: 'wrap',
                      marginBottom: 12,
                    }}
                  >
                    <span
                      style={{
                        padding: '5px 10px',
                        borderRadius: 20,
                        background: C.goldLight,
                        color: '#80591C',
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      {item.category || 'General'}
                    </span>

                    {item.is_pinned && (
                      <span
                        style={{
                          padding: '5px 10px',
                          borderRadius: 20,
                          background: '#FFF0D1',
                          color: '#9A610B',
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        Pinned
                      </span>
                    )}

                    <span
                      style={{
                        padding: '5px 10px',
                        borderRadius: 20,
                        background:
                          status === 'Published'
                            ? '#E7F6E9'
                            : '#F1F1F1',
                        color:
                          status === 'Published'
                            ? C.green
                            : '#666666',
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      {status}
                    </span>
                  </div>

                  {/* TITLE */}

                  <h3
                    style={{
                      margin: '0 0 10px',
                      color: C.maroon,
                      fontSize: 18,
                    }}
                  >
                    {item.title}
                  </h3>

                  {/* DESCRIPTION */}

                  <p
                    style={{
                      color: C.muted,
                      fontSize: 13,
                      lineHeight: 1.65,
                      whiteSpace: 'pre-wrap',
                      overflowWrap: 'anywhere',
                      maxHeight: 90,
                      overflow: 'hidden',
                    }}
                  >
                    {item.message}
                  </p>

                  {/* DATES */}

                  <div
                    style={{
                      fontSize: 12,
                      color: C.muted,
                      marginBottom: 15,
                      lineHeight: 1.9,
                    }}
                  >
                    <div>
                      {isScheduled(item)
                        ? 'Scheduled'
                        : 'Published'}
                      :{' '}
                      {formatDate(
                        item.publish_at ||
                        item.created_at
                      )}
                    </div>

                    {item.expires_at && (
                      <div>
                        Expires:{' '}
                        {formatDate(item.expires_at)}
                      </div>
                    )}

                    {item.attachment_url && (
                      <div>
                        <a
                          href={item.attachment_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: C.maroon,
                            fontWeight: 700,
                          }}
                        >
                          View PDF Attachment
                        </a>
                      </div>
                    )}
                  </div>

                  {/* ACTIONS */}

                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      flexWrap: 'wrap',
                      borderTop:
                        `1px solid ${C.border}`,
                      paddingTop: 14,
                    }}
                  >
                    <button
                      type="button"
                      style={secondaryButton}
                      disabled={busy}
                      onClick={() => openEdit(item)}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      style={secondaryButton}
                      disabled={busy}
                      onClick={() =>
                        void togglePin(item)
                      }
                    >
                      {item.is_pinned
                        ? 'Unpin'
                        : 'Pin'}
                    </button>

                    <button
                      type="button"
                      style={secondaryButton}
                      disabled={busy}
                      onClick={() =>
                        void toggleActive(item)
                      }
                    >
                      {item.is_active
                        ? 'Deactivate'
                        : 'Activate'}
                    </button>

                    <button
                      type="button"
                      style={{
                        ...primaryButton,
                        opacity:
                          busy ||
                          !item.is_active ||
                          isExpired(item)
                            ? 0.5
                            : 1,
                      }}
                      disabled={
                        busy ||
                        !item.is_active ||
                        isExpired(item)
                      }
                      onClick={() =>
                        void sendNow(item)
                      }
                    >
                      {actionId === item.id
                        ? 'Please wait...'
                        : 'Send Now'}
                    </button>

<button
  type="button"
  disabled={busy || deletingId !== null}
  onClick={() => void deleteAnnouncement(item)}
  style={{
    ...secondaryButton,
    background: '#FFF1F0',
    border: '1px solid #F2B8B5',
    color: C.red,
    opacity: busy || deletingId !== null ? 0.55 : 1,
    cursor: busy || deletingId !== null
      ? 'not-allowed'
      : 'pointer',
  }}
>
  {deletingId === item.id
    ? 'Deleting...'
    : '🗑 Delete'}
</button>

                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
