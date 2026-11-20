import {
  beginVolunteerOperation,
} from '../../lib/volunteerOperationGuard';
import { useRef, useState } from 'react';
import type { FormEvent } from 'react';

import {
  volunteerRequest,
  jsonRequest,
  uploadVolunteerImage,
  getErrorMessage,
} from '../../lib/volunteerApi';

import { useVolunteerManager } from './useVolunteerManager';

const emptyDuty = {
  name: '',
  description: '',
  responsibilities: '',
  reporting_location: '',
  male_dress_code: '',
  female_dress_code: '',
  male_dress_image_url: '',
  female_dress_image_url: '',
  general_instructions: '',
  coordinator_name: '',
  coordinator_phone: '',
};

type DutyForm = typeof emptyDuty;

type Duty = DutyForm & {
  id: number;
  is_active: boolean;
  total_requirements: number;
  total_assignments: number;
};

const fields: {
  key: keyof DutyForm;
  label: string;
  multiline?: boolean;
  maxLength?: number;
}[] = [
  {
    key: 'name',
    label: 'Duty Name *',
    maxLength: 255,
  },
  {
    key: 'description',
    label: 'Description',
    multiline: true,
  },
  {
    key: 'responsibilities',
    label: 'Responsibilities',
    multiline: true,
  },
  {
    key: 'reporting_location',
    label: 'Default Reporting Location',
  },
  {
    key: 'male_dress_code',
    label: 'Male Dress Code',
    multiline: true,
  },
  {
    key: 'female_dress_code',
    label: 'Female Dress Code',
    multiline: true,
  },
  {
    key: 'general_instructions',
    label: 'General Instructions',
    multiline: true,
  },
  {
    key: 'coordinator_name',
    label: 'Coordinator Name',
    maxLength: 255,
  },
  {
    key: 'coordinator_phone',
    label: 'Coordinator Phone',
    maxLength: 20,
  },
];

export default function Duties() {
  const manager =
    useVolunteerManager<Duty>('/duties');

  const [form, setForm] =
    useState<DutyForm | null>(null);

  const [editingId, setEditingId] =
    useState<number | null>(null);

  const [search, setSearch] = useState('');

  const [filter, setFilter] = useState('all');

  const [uploading, setUploading] =
    useState(false);

  const uploadLock = useRef(false);

  const disabled =
    manager.disabled || uploading;

  function update(
    key: keyof DutyForm,
    value: string
  ) {
    setForm(current =>
      current
        ? { ...current, [key]: value }
        : null
    );
  }

  function add() {
    setEditingId(null);
    setForm({ ...emptyDuty });
    manager.setError('');
    manager.setSuccess('');
  }

  function edit(duty: Duty) {
    const values = { ...emptyDuty };

    for (
      const key of Object.keys(values) as
        (keyof DutyForm)[]
    ) {
      values[key] = duty[key] || '';
    }

    setForm(values);
    setEditingId(duty.id);
    manager.setError('');

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  async function upload(
    file: File,
    type: 'male-dress' | 'female-dress'
  ) {
    if (uploadLock.current || disabled) return;

    const releaseOperation = beginVolunteerOperation('Duty image upload');
    uploadLock.current = true;
    setUploading(true);
    manager.setError('');

    try {
      const url =
        await uploadVolunteerImage(file, type);

      update(
        type === 'male-dress'
          ? 'male_dress_image_url'
          : 'female_dress_image_url',
        url
      );
    } catch (error) {
      manager.setError(getErrorMessage(error));
    } finally {
      uploadLock.current = false;
      releaseOperation();
      setUploading(false);
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();

    if (!form || disabled) return;

    if (!form.name.trim()) {
      manager.setError('Duty name is required.');
      return;
    }

    for (const url of [
      form.male_dress_image_url,
      form.female_dress_image_url,
    ]) {
      if (url && !url.startsWith('https://')) {
        manager.setError(
          'Dress code images must use HTTPS.'
        );
        return;
      }
    }

    const id = editingId;

    await manager.mutate(
      () =>
        volunteerRequest(
          id ? `/duties/${id}` : '/duties',
          jsonRequest(id ? 'PUT' : 'POST', form)
        ),
      id
        ? 'Duty updated successfully.'
        : 'Duty created successfully.',
      () => {
        setForm(null);
        setEditingId(null);
      }
    );
  }

  async function toggle(duty: Duty) {
    if (
      !window.confirm(
        `${duty.is_active ? 'Disable' : 'Enable'} "${duty.name}"?`
      )
    ) {
      return;
    }

    await manager.mutate(
      () =>
        volunteerRequest(
          `/duties/${duty.id}/status`,
          jsonRequest('PATCH', {
            is_active: !duty.is_active,
          })
        ),
      'Duty status updated.'
    );
  }

  const filtered = manager.items.filter(duty => {
    const query = search.trim().toLowerCase();

    return (
      (
        filter === 'all' ||
        duty.is_active === (filter === 'active')
      ) &&
      (
        !query ||
        duty.name.toLowerCase().includes(query) ||
        (duty.description || '')
          .toLowerCase()
          .includes(query)
      )
    );
  });

  return (
    <>
      <div className="page-head">
        <div>
          <h3>Volunteer Duties</h3>
          <p>
            Create reusable responsibilities for
            different seva programmes.
          </p>
        </div>

        <div className="actions">
          <button
            disabled={manager.busy || uploading}
            onClick={() => void manager.refresh()}
          >
            Refresh
          </button>

          <button
            className="primary"
            disabled={disabled}
            onClick={add}
          >
            + Create Duty
          </button>
        </div>
      </div>

      {manager.error && (
        <div className="error" role="alert">
          {manager.error}
        </div>
      )}

      {manager.needsRefresh && (
        <p>Refresh records before retrying changes.</p>
      )}

      {manager.success && (
        <div className="panel" role="status"
          style={{ color: '#15803d' }}>
          {manager.success}
        </div>
      )}

      {form && (
        <form className="form-card" onSubmit={save}>
          <h3>
            {editingId ? 'Edit Duty' : 'Create Duty'}
          </h3>

          <fieldset
            disabled={disabled}
            style={{
              border: 0,
              padding: 0,
              minWidth: 0,
              margin: 0,
            }}
          >
            {fields.map(field => (
              <label key={field.key}>
                {field.label}

                {field.multiline ? (
                  <textarea
                    rows={3}
                    maxLength={10000}
                    value={form[field.key]}
                    onChange={e =>
                      update(field.key, e.target.value)
                    }
                  />
                ) : (
                  <input
                    required={field.key === 'name'}
                    maxLength={field.maxLength || 10000}
                    value={form[field.key]}
                    onChange={e =>
                      update(field.key, e.target.value)
                    }
                  />
                )}
              </label>
            ))}

            {([
              [
                'male_dress_image_url',
                'male-dress',
                'Male Dress Code Image',
              ],
              [
                'female_dress_image_url',
                'female-dress',
                'Female Dress Code Image',
              ],
            ] as const).map(([key, type, label]) => (
              <div className="panel" key={key}>
                <label>
                  {label}

                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={e => {
                      const file = e.target.files?.[0];

                      if (file) {
                        void upload(file, type);
                      }

                      e.target.value = '';
                    }}
                  />
                </label>

                <label>
                  Image URL

                  <input
                    type="url"
                    value={form[key]}
                    placeholder="https://..."
                    onChange={e =>
                      update(key, e.target.value)
                    }
                  />
                </label>

                {form[key].startsWith('https://') && (
                  <>
                    <img
                      src={form[key]}
                      alt={label}
                      style={{
                        width: 180,
                        maxWidth: '100%',
                        height: 180,
                        objectFit: 'contain',
                        borderRadius: 10,
                      }}
                    />

                    <button
                      type="button"
                      onClick={() => update(key, '')}
                    >
                      Remove Image
                    </button>
                  </>
                )}
              </div>
            ))}

            <button
              type="submit"
              className="primary"
              disabled={disabled}
            >
              {uploading
                ? 'Uploading Image…'
                : manager.busy
                  ? 'Saving…'
                  : 'Save Duty'}
            </button>
          </fieldset>

          <button
            type="button"
            disabled={manager.busy || uploading}
            style={{ marginTop: 12 }}
            onClick={() => setForm(null)}
          >
            Cancel
          </button>
        </form>
      )}

      <div className="panel grid2">
        <label>
          Search Duties

          <input
            value={search}
            placeholder="Search duty name..."
            onChange={e => setSearch(e.target.value)}
          />
        </label>

        <label>
          Status

          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
          >
            <option value="all">All Duties</option>
            <option value="active">Active</option>
            <option value="inactive">Disabled</option>
          </select>
        </label>
      </div>

      {manager.loading && <p>Loading duties…</p>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Duty</th>
              <th>Reporting Location</th>
              <th>Coordinator</th>
              <th>Requirements</th>
              <th>Assignments</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map(duty => (
              <tr key={duty.id}>
                <td>
                  <strong>{duty.name}</strong>
                  <div>
                    <small>{duty.description}</small>
                  </div>
                </td>

                <td>{duty.reporting_location || '—'}</td>

                <td>
                  {duty.coordinator_name || '—'}

                  <div>
                    <small>
                      {duty.coordinator_phone}
                    </small>
                  </div>
                </td>

                <td>{duty.total_requirements}</td>
                <td>{duty.total_assignments}</td>

                <td>
                  {duty.is_active ? 'Active' : 'Disabled'}
                </td>

                <td>
                  <div className="actions">
                    <button
                      disabled={disabled}
                      onClick={() => edit(duty)}
                    >
                      Edit
                    </button>

                    <button
                      disabled={disabled}
                      onClick={() => void toggle(duty)}
                    >
                      {duty.is_active
                        ? 'Disable'
                        : 'Enable'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {manager.loaded &&
              !manager.loading &&
              filtered.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    No duties found.
                  </td>
                </tr>
              )}
          </tbody>
        </table>
      </div>
    </>
  );
}