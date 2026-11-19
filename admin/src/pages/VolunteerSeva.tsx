import React, {
  useEffect,
  useRef,
  useState,
} from 'react';
import Assignments from './volunteer/Assignments';
import Attendance from './volunteer/Attendance';

import Completion from './volunteer/Completion';
import Certificates from './volunteer/Certificates';

import IdCards from './volunteer/IdCards';
import Accommodation from './volunteer/Accommodation';

import Duties from './volunteer/Duties';
import Shifts from './volunteer/Shifts';
import Requirements from './volunteer/Requirements';
import Registrations from './volunteer/Registrations';

import {
  uploadVolunteerImage,
} from '../lib/volunteerApi';

import { apiRequest } from '../lib/api';

// ========================================
// API CONFIGURATION
// ========================================

const BASE = '/admin/volunteer';

type RegistrationStatus =
  | 'draft'
  | 'upcoming'
  | 'open'
  | 'closed';

// ========================================
// TYPES
// ========================================

type OpportunityForm = {
  title: string;
  description: string;
  instructions: string;
  image_url: string;

  registration_start_at: string;
  registration_end_at: string;

  service_start_date: string;
  service_end_date: string;

  required_volunteers: number;

  allow_individual: boolean;
  allow_group: boolean;

  minimum_group_size: number;
  maximum_group_size: number;
};

type Opportunity = OpportunityForm & {
  id: number;

  is_published: boolean;
  registration_enabled: boolean;

  registration_status: RegistrationStatus;

  total_registrations: number;
  registered_volunteers: number;
  approved_volunteers: number;
};

type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data: T;
};

type Section =
  | 'overview'
  | 'opportunities'
  | 'registrations'
  | 'duties'
  | 'shifts'
  | 'requirements'
  | 'assignments'
  | 'attendance'
  | 'id-cards'
  | 'accommodation'
  | 'completion'
  | 'certificates';

// ========================================
// DEFAULT FORM
// ========================================

const emptyForm: OpportunityForm = {
  title: '',
  description: '',
  instructions: '',
  image_url: '',

  registration_start_at: '',
  registration_end_at: '',

  service_start_date: '',
  service_end_date: '',

  required_volunteers: 100,

  allow_individual: true,
  allow_group: true,

  minimum_group_size: 10,
  maximum_group_size: 100,
};

// ========================================
// DATE AND TIME HELPERS
// ========================================

function toISTInput(
  value: string | null | undefined
): string {
  if (!value) return '';

  const time = Date.parse(value);

  if (!Number.isFinite(time)) return '';

  return new Date(
    time + 330 * 60 * 1000
  )
    .toISOString()
    .slice(0, 16);
}

function toISTTimestamp(
  value: string
): string {
  if (!value) return '';

  return `${value}:00+05:30`;
}

function formatDateTime(
  value: string
): string {
  const time = new Date(value);

  if (Number.isNaN(time.getTime())) {
    return '—';
  }

  return time.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function formatDate(value: string): string {
  if (!value) return '—';

  const parts = value.slice(0, 10).split('-');

  return parts.length === 3
    ? `${parts[2]}/${parts[1]}/${parts[0]}`
    : value;
}

function errorMessage(
  error: unknown,
  fallback: string
): string {
  return error instanceof Error
    ? error.message
    : fallback;
}

// ========================================
// REQUEST HELPER
// ========================================

async function volunteerRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const controller = new AbortController();

  const timer = window.setTimeout(() => {
    controller.abort();
  }, 45000);

  try {
    const response =
      await apiRequest<ApiResponse<T>>(
        `${BASE}${endpoint}`,
        {
          ...options,
          signal: controller.signal,
        }
      );

    if (!response.success) {
      throw new Error(
        response.message ||
          'Volunteer request failed.'
      );
    }

    return response;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(
        'Request timed out. Refresh the records before retrying a change.'
      );
    }

    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

// ========================================
// MAIN COMPONENT
// ========================================

export default function VolunteerSeva() {
  const [section, setSection] =
    useState<Section>('overview');

  const [items, setItems] =
    useState<Opportunity[]>([]);

  const [editing, setEditing] =
    useState<OpportunityForm | null>(null);

  const [editingId, setEditingId] =
    useState<number | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [busy, setBusy] =
    useState(false);

    const [uploadingImage, setUploadingImage] =
  useState(false);

const imageUploadLock = useRef(false);

  const [error, setError] =
    useState('');

  const [success, setSuccess] =
    useState('');

  const [search, setSearch] =
    useState('');

  const [filter, setFilter] =
    useState('all');

  const [loaded, setLoaded] =
    useState(false);

  const [requiresRefresh, setRequiresRefresh] =
    useState(false);

  const [extension, setExtension] =
    useState<{
      id: number;
      title: string;
      deadline: string;
    } | null>(null);

  const mutationRunning = useRef(false);
  const loadVersion = useRef(0);

  // ========================================
  // LOAD OPPORTUNITIES
  // ========================================

  async function load(): Promise<boolean> {
    const version = ++loadVersion.current;

    setLoading(true);
    setError('');

    try {
      const response =
        await volunteerRequest<Opportunity[]>(
          '/opportunities',
          { cache: 'no-store' }
        );

      if (!Array.isArray(response.data)) {
        throw new Error(
          'Invalid opportunity response.'
        );
      }

      if (version !== loadVersion.current) {
        return false;
      }

      setItems(response.data);
      setLoaded(true);
      setRequiresRefresh(false);

      return true;
    } catch (err) {
      if (version === loadVersion.current) {
        setError(
          errorMessage(
            err,
            'Unable to load opportunities.'
          )
        );
      }

      return false;
    } finally {
      if (version === loadVersion.current) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    void load();

    return () => {
      loadVersion.current++;
    };
  }, []);

  // ========================================
  // MUTATION HANDLER
  // ========================================

  async function mutate(
    task: () => Promise<unknown>,
    message: string,
    onSuccess?: () => void
  ) {
    if (
      mutationRunning.current ||
      requiresRefresh ||
      loading
    ) {
      return;
    }

    mutationRunning.current = true;

    setBusy(true);
    setError('');
    setSuccess('');

    try {
      await task();

      onSuccess?.();

      setSuccess(message);

      const refreshed = await load();

      if (!refreshed) {
        setRequiresRefresh(true);
      }
    } catch (err) {
      setError(
        errorMessage(err, 'Operation failed.')
      );

      setRequiresRefresh(true);
    } finally {
      mutationRunning.current = false;
      setBusy(false);
    }
  }

  // ========================================
  // CREATE AND EDIT
  // ========================================

  function add() {
    setSection('opportunities');
    setEditingId(null);
    setEditing({ ...emptyForm });
    setExtension(null);
    setError('');
    setSuccess('');
  }

  function edit(item: Opportunity) {
    setSection('opportunities');
    setEditingId(item.id);
    setExtension(null);

    setEditing({
      title: item.title,
      description: item.description || '',
      instructions: item.instructions || '',
      image_url: item.image_url || '',

      registration_start_at:
        toISTInput(item.registration_start_at),

      registration_end_at:
        toISTInput(item.registration_end_at),

      service_start_date:
        item.service_start_date.slice(0, 10),

      service_end_date:
        item.service_end_date.slice(0, 10),

      required_volunteers:
        item.required_volunteers,

      allow_individual:
        item.allow_individual,

      allow_group:
        item.allow_group,

      minimum_group_size:
        item.minimum_group_size,

      maximum_group_size:
        item.maximum_group_size,
    });

    setError('');
    setSuccess('');

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  function update<K extends keyof OpportunityForm>(
    key: K,
    value: OpportunityForm[K]
  ) {
    setEditing((current) =>
      current
        ? { ...current, [key]: value }
        : null
    );
  }

  // ========================================
  // FORM VALIDATION
  // ========================================

  function validate(
    form: OpportunityForm
  ): string | null {
    if (
      !form.title.trim() ||
      form.title.trim().length > 255
    ) {
      return 'Enter a valid opportunity title.';
    }

    const start = Date.parse(
      toISTTimestamp(form.registration_start_at)
    );

    const end = Date.parse(
      toISTTimestamp(form.registration_end_at)
    );

    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end)
    ) {
      return 'Registration dates are required.';
    }

    if (end <= start) {
      return 'Registration end must be after start.';
    }

    if (
      !form.service_start_date ||
      !form.service_end_date
    ) {
      return 'Service dates are required.';
    }

    if (
      form.service_end_date <
      form.service_start_date
    ) {
      return 'Service end cannot be before start.';
    }

    const serviceEnd = Date.parse(
      `${form.service_end_date}T23:59:59.999+05:30`
    );

    if (end > serviceEnd) {
      return 'Registration must end within the service period.';
    }

    if (
      !Number.isInteger(form.required_volunteers) ||
      form.required_volunteers < 1 ||
      form.required_volunteers > 2147483647
    ) {
      return 'Required volunteers must be a positive integer.';
    }

    if (
      !form.allow_individual &&
      !form.allow_group
    ) {
      return 'Enable at least one registration type.';
    }

    if (
      !Number.isInteger(form.minimum_group_size) ||
      !Number.isInteger(form.maximum_group_size) ||
      form.minimum_group_size < 2 ||
      form.maximum_group_size > 2147483647 ||
      form.maximum_group_size <
        form.minimum_group_size
    ) {
      return 'Enter valid minimum and maximum group sizes.';
    }

    if (form.image_url.trim()) {
      try {
        const url = new URL(form.image_url);

        if (
          !['https:', 'http:'].includes(url.protocol)
        ) {
          throw new Error('Invalid protocol');
        }
      } catch {
        return 'Enter a valid image URL.';
      }
    }

    return null;
  }


  async function uploadCoverImage(file: File) {
  if (
    imageUploadLock.current ||
    busy ||
    loading ||
    requiresRefresh ||
    !editing
  ) {
    return;
  }

  imageUploadLock.current = true;

  setUploadingImage(true);
  setError('');

  try {
    const imageUrl =
      await uploadVolunteerImage(
        file,
        'opportunity'
      );

    setEditing(current =>
      current
        ? {
            ...current,
            image_url: imageUrl,
          }
        : null
    );
  } catch (error) {
    setError(
      error instanceof Error
        ? error.message
        : 'Unable to upload cover image.'
    );
  } finally {
    imageUploadLock.current = false;
    setUploadingImage(false);
  }
}

  // ========================================
  // SAVE OPPORTUNITY
  // ========================================

  async function save(
    event: React.FormEvent
  ) {
    event.preventDefault();

    if (!editing || busy) return;

    const validation = validate(editing);

    if (validation) {
      setError(validation);
      return;
    }

    const id = editingId;

    const body = {
      ...editing,

      title: editing.title.trim(),

      description:
        editing.description.trim() || null,

      instructions:
        editing.instructions.trim() || null,

      image_url:
        editing.image_url.trim() || null,

      registration_start_at:
        toISTTimestamp(
          editing.registration_start_at
        ),

      registration_end_at:
        toISTTimestamp(
          editing.registration_end_at
        ),
    };

    await mutate(
      () =>
        volunteerRequest(
          id
            ? `/opportunities/${id}`
            : '/opportunities',
          {
            method: id ? 'PUT' : 'POST',
            body: JSON.stringify(body),
          }
        ),

      id
        ? 'Opportunity updated successfully.'
        : 'Opportunity created as a draft.',

      () => {
        setEditing(null);
        setEditingId(null);
      }
    );
  }

  // ========================================
  // PUBLISH / UNPUBLISH
  // ========================================

  async function togglePublish(
    item: Opportunity
  ) {
    const published = !item.is_published;

    const message = published
      ? `Publish "${item.title}"?`
      : `Unpublish "${item.title}"? Registration will also be disabled.`;

    if (!window.confirm(message)) return;

    await mutate(
      () =>
        volunteerRequest(
          `/opportunities/${item.id}/publish`,
          {
            method: 'PATCH',

            body: JSON.stringify({
              is_published: published,
            }),
          }
        ),

      published
        ? 'Opportunity published.'
        : 'Opportunity unpublished.'
    );
  }

  // ========================================
  // ENABLE / CLOSE REGISTRATION
  // ========================================

  async function toggleRegistration(
    item: Opportunity
  ) {
    const enabled =
      !item.registration_enabled;

    if (enabled && !item.is_published) {
      setError('Publish the opportunity first.');
      return;
    }

    if (
      !window.confirm(
        enabled
          ? 'Enable registration for the configured period?'
          : 'Close registration for this opportunity?'
      )
    ) {
      return;
    }

    await mutate(
      () =>
        volunteerRequest(
          `/opportunities/${item.id}/registration`,
          {
            method: 'PATCH',

            body: JSON.stringify({
              registration_enabled: enabled,
            }),
          }
        ),

      enabled
        ? 'Registration enabled.'
        : 'Registration closed.'
    );
  }

  // ========================================
  // EXTEND DEADLINE
  // ========================================

  async function extendDeadline(
    event: React.FormEvent
  ) {
    event.preventDefault();

    if (!extension) return;

    const item = items.find(
      (row) => row.id === extension.id
    );

    if (!item) return;

    const deadline = toISTTimestamp(
      extension.deadline
    );

    const timestamp = Date.parse(deadline);

    if (
      !Number.isFinite(timestamp) ||
      timestamp <=
        Date.parse(item.registration_end_at) ||
      timestamp <= Date.now()
    ) {
      setError(
        'New deadline must be later than the existing deadline and current time.'
      );

      return;
    }

    const serviceEnd = Date.parse(
      `${item.service_end_date.slice(0, 10)}T23:59:59.999+05:30`
    );

    if (timestamp > serviceEnd) {
      setError(
        'Deadline cannot exceed the service period.'
      );
      return;
    }

    if (
      !window.confirm(
        'Extend the registration deadline?'
      )
    ) {
      return;
    }

    await mutate(
      () =>
        volunteerRequest(
          `/opportunities/${extension.id}/extend`,
          {
            method: 'PATCH',

            body: JSON.stringify({
              registration_end_at: deadline,
            }),
          }
        ),

      'Registration deadline extended.',

      () => setExtension(null)
    );
  }

  // ========================================
  // DASHBOARD STATISTICS
  // ========================================

  const stats = {
    opportunities: items.length,

    published: items.filter(
      (item) => item.is_published
    ).length,

    open: items.filter(
      (item) =>
        item.registration_status === 'open'
    ).length,

    registrations: items.reduce(
      (sum, item) =>
        sum + Number(item.total_registrations || 0),
      0
    ),

    volunteers: items.reduce(
      (sum, item) =>
        sum + Number(item.registered_volunteers || 0),
      0
    ),

    approved: items.reduce(
      (sum, item) =>
        sum + Number(item.approved_volunteers || 0),
      0
    ),
  };

  const filtered = items.filter((item) => {
    if (
      filter !== 'all' &&
      item.registration_status !== filter
    ) {
      return false;
    }

    const q = search.trim().toLowerCase();

    return (
      !q ||
      item.title.toLowerCase().includes(q) ||
      (item.description || '')
        .toLowerCase()
        .includes(q)
    );
  });

  const disabled =
    busy || loading || requiresRefresh || !loaded;

  const statusColors = {
    draft: '#64748b',
    upcoming: '#b45309',
    open: '#15803d',
    closed: '#b91c1c',
  };

  // ========================================
  // UI
  // ========================================

  return (
    <main className="content">
      <div className="page-head">
        <div>
          <h2>Volunteer Seva Management</h2>

          <p>
            Manage seva opportunities,
            registrations and volunteer services.
          </p>
        </div>

        <div className="actions">
          <button
            type="button"
            disabled={busy || loading}
            onClick={() => void load()}
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>

          <button
            type="button"
            className="primary"
            disabled={disabled}
            onClick={add}
          >
            + Create Opportunity
          </button>
        </div>
      </div>

      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}

      {requiresRefresh && (
        <div className="panel" role="alert">
          Refresh the records before performing
          another change. This helps prevent
          duplicate submissions.
        </div>
      )}

      {success && (
        <div
          className="panel"
          role="status"
          style={{ color: '#15803d' }}
        >
          {success}
        </div>
      )}

      <div
        className="actions"
        style={{
          marginBottom: 20,
          flexWrap: 'wrap',
        }}
      >
        {[
  ['overview', 'Overview'],
  ['opportunities', 'Seva Opportunities'],
  ['registrations', 'Registrations'],
  ['duties', 'Duties'],
  ['shifts', 'Service Shifts'],
  ['requirements', 'Duty Requirements'],
  ['assignments', 'Assignments'],
['attendance', 'Attendance'],

['id-cards', 'ID Cards'],
['accommodation', 'Accommodation'],
['completion', 'Service Completion'],
['certificates', 'Certificates'],
].map(([key, label]) => (
          <button
            type="button"
            key={key}
            disabled={busy}
            className={
              section === key ? 'primary' : ''
            }
            onClick={() =>
              setSection(key as Section)
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* DASHBOARD STATISTICS */}

      <div className="stats">
        {[
          ['Opportunities', stats.opportunities],
          ['Published', stats.published],
          ['Open Registrations', stats.open],
          ['Registrations', stats.registrations],
          ['Registered Volunteers', stats.volunteers],
          ['Approved Volunteers', stats.approved],
        ].map(([label, count]) => (
          <div
            className="stat"
            key={String(label)}
          >
            <span>{label}</span>

            <strong>
              {loaded ? count : '—'}
            </strong>
          </div>
        ))}
      </div>

      {/* OVERVIEW */}

      {section === 'overview' && (
        <>
          <div className="panel">
            <h3>Volunteer Seva Workflow</h3>

            <p>
              Manage the complete volunteer
              service lifecycle from registration
              through certificate issuance.
            </p>

            <ol
              style={{
                lineHeight: 2,
                paddingLeft: 24,
              }}
            >
              <li>Create seva opportunity</li>
              <li>Configure duties and shifts</li>
              <li>Publish opportunity</li>
              <li>Enable registration</li>
              <li>Review applications</li>
              <li>Assign volunteer duties</li>
              <li>Issue digital ID cards</li>
              <li>Allocate accommodation if needed</li>
              <li>Record attendance</li>
              <li>Complete volunteer service</li>
              <li>Issue certificates</li>
            </ol>

            <button
              type="button"
              className="primary"
              onClick={() =>
                setSection('opportunities')
              }
            >
              Manage Seva Opportunities
            </button>
          </div>

          <div className="panel">
            <h3>Recent Opportunities</h3>

            {loading && <p>Loading records…</p>}

            {loaded &&
              !loading &&
              items.length === 0 && (
                <p>
                  No volunteer opportunities
                  created yet.
                </p>
              )}

            {items.slice(0, 5).map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '14px 0',
                  borderBottom: '1px solid #e5e7eb',
                }}
              >
                <div>
                  <strong>{item.title}</strong>

                  <div>
                    <small>
                      {formatDate(
                        item.service_start_date
                      )}
                      {' — '}
                      {formatDate(
                        item.service_end_date
                      )}
                    </small>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => edit(item)}
                >
                  Manage
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* OPPORTUNITIES */}

      {section === 'opportunities' && (
        <>
          {editing && (
            <form
              className="form-card"
              onSubmit={save}
            >
              <h3>
                {editingId
                  ? 'Edit Seva Opportunity'
                  : 'Create Seva Opportunity'}
              </h3>

              <fieldset
                disabled={disabled}
                style={{
                  border: 0,
                  padding: 0,
                  margin: 0,
                  minWidth: 0,
                }}
              >
                <label>
                  Opportunity Title *

                  <input
                    required
                    maxLength={255}
                    value={editing.title}
                    placeholder="Brahmotsavam Volunteer Seva"
                    onChange={(e) =>
                      update('title', e.target.value)
                    }
                  />
                </label>

                <label>
                  Description

                  <textarea
                    rows={4}
                    value={editing.description}
                    onChange={(e) =>
                      update(
                        'description',
                        e.target.value
                      )
                    }
                  />
                </label>

                <label>
                  Volunteer Instructions

                  <textarea
                    rows={4}
                    value={editing.instructions}
                    onChange={(e) =>
                      update(
                        'instructions',
                        e.target.value
                      )
                    }
                  />
                </label>
<label>
  Upload Cover Image

  <input
    type="file"
    accept="image/jpeg,image/png,image/webp"
    disabled={uploadingImage || busy}
    onChange={e => {
      const file = e.target.files?.[0];

      if (file) {
        void uploadCoverImage(file);
      }

      e.target.value = '';
    }}
  />
</label>

{uploadingImage && (
  <p>Uploading image to Cloudinary…</p>
)}
                <label>
                  Cover Image URL

                  <input
                    type="url"

                    value={editing.image_url}
                    placeholder="https://..."
                    onChange={(e) =>
                      update(
                        'image_url',
                        e.target.value
                      )
                    }
                  />
                </label>

                {/^https?:\/\//i.test(
                  editing.image_url
                ) && (
                  <img
                    src={editing.image_url}
                    alt="Opportunity cover preview"
                    style={{
                      width: 260,
                      maxWidth: '100%',
                      height: 150,
                      objectFit: 'cover',
                      borderRadius: 12,
                      marginBottom: 16,
                    }}
                  />
                )}

                <h3>Registration Period</h3>

                <p>
                  All registration dates and times
                  are in Indian Standard Time (IST).
                </p>

                <div className="grid2">
                  <label>
                    Registration Start *

                    <input
                      required
                      type="datetime-local"
                      value={
                        editing.registration_start_at
                      }
                      onChange={(e) =>
                        update(
                          'registration_start_at',
                          e.target.value
                        )
                      }
                    />
                  </label>

                  <label>
                    Registration End *

                    <input
                      required
                      type="datetime-local"
                      value={
                        editing.registration_end_at
                      }
                      onChange={(e) =>
                        update(
                          'registration_end_at',
                          e.target.value
                        )
                      }
                    />
                  </label>
                </div>

                <h3>Service Period</h3>

                <div className="grid2">
                  <label>
                    Service Start Date *

                    <input
                      required
                      type="date"
                      value={editing.service_start_date}
                      onChange={(e) =>
                        update(
                          'service_start_date',
                          e.target.value
                        )
                      }
                    />
                  </label>

                  <label>
                    Service End Date *

                    <input
                      required
                      type="date"
                      min={editing.service_start_date}
                      value={editing.service_end_date}
                      onChange={(e) =>
                        update(
                          'service_end_date',
                          e.target.value
                        )
                      }
                    />
                  </label>
                </div>

                <label>
                  Required Volunteers *

                  <input
                    required
                    type="number"
                    min={1}
                    max={2147483647}
                    step={1}
                    value={editing.required_volunteers}
                    onChange={(e) =>
                      update(
                        'required_volunteers',
                        Number(e.target.value)
                      )
                    }
                  />
                </label>

                <h3>Registration Types</h3>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <input
                    type="checkbox"
                    style={{ width: 'auto' }}
                    checked={editing.allow_individual}
                    onChange={(e) =>
                      update(
                        'allow_individual',
                        e.target.checked
                      )
                    }
                  />

                  Allow Individual Registration
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
                    style={{ width: 'auto' }}
                    checked={editing.allow_group}
                    onChange={(e) =>
                      update(
                        'allow_group',
                        e.target.checked
                      )
                    }
                  />

                  Allow Group Registration
                </label>

                {editing.allow_group && (
                  <div className="grid2">
                    <label>
                      Minimum Group Size

                      <input
                        required
                        type="number"
                        min={2}
                        step={1}
                        value={
                          editing.minimum_group_size
                        }
                        onChange={(e) =>
                          update(
                            'minimum_group_size',
                            Number(e.target.value)
                          )
                        }
                      />
                    </label>

                    <label>
                      Maximum Group Size

                      <input
                        required
                        type="number"
                        min={
                          editing.minimum_group_size
                        }
                        step={1}
                        value={
                          editing.maximum_group_size
                        }
                        onChange={(e) =>
                          update(
                            'maximum_group_size',
                            Number(e.target.value)
                          )
                        }
                      />
                    </label>
                  </div>
                )}

                <div className="panel">
                  {editingId
                    ? 'Changes will update the existing opportunity.'
                    : 'New opportunities are saved as drafts. Configure service shifts and publish before enabling registration.'}
                </div>

                <div className="actions">
                  <button
                    type="submit"
                    className="primary"
                    disabled={disabled}
                  >
                    {busy
                      ? 'Saving…'
                      : editingId
                        ? 'Save Changes'
                        : 'Create Opportunity'}
                  </button>
                </div>
              </fieldset>

              <button
                type="button"
                disabled={busy}
                style={{ marginTop: 12 }}
                onClick={() => {
                  setEditing(null);
                  setEditingId(null);
                }}
              >
                Cancel
              </button>
            </form>
          )}

          {/* EXTEND REGISTRATION DEADLINE */}

          {extension && (
            <form
              className="form-card"
              onSubmit={extendDeadline}
            >
              <h3>Extend Registration Deadline</h3>

              <p>{extension.title}</p>

              <label>
                New Registration Deadline (IST)

                <input
                  required
                  type="datetime-local"
                  value={extension.deadline}
                  disabled={disabled}
                  onChange={(e) =>
                    setExtension((current) =>
                      current
                        ? {
                            ...current,
                            deadline: e.target.value,
                          }
                        : null
                    )
                  }
                />
              </label>

              <div className="actions">
                <button
                  type="submit"
                  className="primary"
                  disabled={disabled}
                >
                  Extend Deadline
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setExtension(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* SEARCH AND FILTERS */}

          <div className="panel">
            <div className="grid2">
              <label>
                Search Opportunities

                <input
                  value={search}
                  placeholder="Search by programme name..."
                  onChange={(e) =>
                    setSearch(e.target.value)
                  }
                />
              </label>

              <label>
                Registration Status

                <select
                  value={filter}
                  onChange={(e) =>
                    setFilter(e.target.value)
                  }
                >
                  <option value="all">
                    All Opportunities
                  </option>

                  <option value="draft">
                    Draft
                  </option>

                  <option value="upcoming">
                    Upcoming
                  </option>

                  <option value="open">
                    Registration Open
                  </option>

                  <option value="closed">
                    Registration Closed
                  </option>
                </select>
              </label>
            </div>
          </div>

          {/* OPPORTUNITY TABLE */}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Programme</th>
                  <th>Service Dates</th>
                  <th>Registration Period</th>
                  <th>Volunteers</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={6}>
                      Loading opportunities…
                    </td>
                  </tr>
                )}

                {!loading &&
                  loaded &&
                  filtered.length === 0 && (
                    <tr>
                      <td colSpan={6}>
                        No opportunities found.
                      </td>
                    </tr>
                  )}

                {filtered.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {item.image_url && (
                        <img
                          src={item.image_url}
                          alt={item.title}
                          className="thumb"
                        />
                      )}

                      <div>
                        <strong>{item.title}</strong>
                      </div>

                      <small>
                        {item.allow_individual
                          ? 'Individual'
                          : ''}

                        {item.allow_individual &&
                        item.allow_group
                          ? ' / '
                          : ''}

                        {item.allow_group
                          ? 'Group'
                          : ''}
                      </small>
                    </td>

                    <td>
                      {formatDate(
                        item.service_start_date
                      )}

                      <div>to</div>

                      {formatDate(
                        item.service_end_date
                      )}
                    </td>

                    <td>
                      <small>
                        Starts:
                        {' '}
                        {formatDateTime(
                          item.registration_start_at
                        )}
                      </small>

                      <div>
                        <small>
                          Ends:
                          {' '}
                          {formatDateTime(
                            item.registration_end_at
                          )}
                        </small>
                      </div>
                    </td>

                    <td>
                      <div>
                        Required:
                        {' '}
                        {item.required_volunteers}
                      </div>

                      <div>
                        Registered:
                        {' '}
                        {item.registered_volunteers}
                      </div>

                      <div>
                        Approved:
                        {' '}
                        {item.approved_volunteers}
                      </div>

                      <small>
                        Applications:
                        {' '}
                        {item.total_registrations}
                      </small>
                    </td>

                    <td>
                      <span
                        className="badge"
                        style={{
                          color:
                            statusColors[
                              item.registration_status
                            ],
                          fontWeight: 700,
                          textTransform: 'capitalize',
                        }}
                      >
                        {item.registration_status}
                      </span>

                      <div>
                        <small>
                          {item.is_published
                            ? 'Published'
                            : 'Not published'}
                        </small>
                      </div>

                      <div>
                        <small>
                          {item.registration_enabled
                            ? 'Registration enabled'
                            : 'Registration disabled'}
                        </small>
                      </div>
                    </td>

                    <td>
                      <div
                        className="actions"
                        style={{
                          flexWrap: 'wrap',
                          gap: 6,
                        }}
                      >
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => edit(item)}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          disabled={disabled}
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
                          disabled={
                            disabled ||
                            (
                              !item.is_published &&
                              !item.registration_enabled
                            )
                          }
                          onClick={() =>
                            void toggleRegistration(item)
                          }
                        >
                          {item.registration_enabled
                            ? 'Close Registration'
                            : 'Enable Registration'}
                        </button>

                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            setEditing(null);
                            setEditingId(null);

                            setExtension({
                              id: item.id,
                              title: item.title,
                              deadline: toISTInput(
                                item.registration_end_at
                              ),
                            });

                            setError('');
                            setSuccess('');

                            window.scrollTo({
                              top: 0,
                              behavior: 'smooth',
                            });
                          }}
                        >
                          Extend Deadline
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {section === 'registrations' && (
  <Registrations opportunities={items} />
)}

{section === 'duties' && (
  <Duties />
)}

{section === 'shifts' && (
  <Shifts opportunities={items} />
)}

{section === 'requirements' && (
  <Requirements opportunities={items} />
)}
{section === 'assignments' && (
  <Assignments opportunities={items} />
)}

{section === 'attendance' && (
  <Attendance opportunities={items} />
)}

{section === 'id-cards' && (
  <IdCards opportunities={items} />
)}

{section === 'accommodation' && (
  <Accommodation opportunities={items} />
)}
{section === 'completion' && (
  <Completion opportunities={items} />
)}

{section === 'certificates' && (
  <Certificates opportunities={items} />
)}

    </main>
  );
}
