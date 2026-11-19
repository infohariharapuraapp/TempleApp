import { useState } from 'react';
import type { FormEvent } from 'react';

import {
  volunteerRequest,
  jsonRequest,
  formatServiceDate,
  isFutureShift,
} from '../../lib/volunteerApi';

import type {
  VolunteerOpportunity,
} from '../../lib/volunteerApi';

import { useVolunteerManager } from './useVolunteerManager';

type ShiftForm = {
  shift_name: string;
  service_date: string;
  start_time: string;
  end_time: string;
};

type Shift = ShiftForm & {
  id: number;
  is_active: boolean;
  available_volunteers: number;
  assigned_volunteers: number;
  required_volunteers: number;
};

type Props = {
  opportunities: VolunteerOpportunity[];
};

export default function Shifts({
  opportunities,
}: Props) {
  const [selectedId, setSelectedId] =
    useState('');

  const opportunity = opportunities.find(
    item => String(item.id) === selectedId
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h3>Service Shifts</h3>
          <p>
            Configure volunteer service dates
            and shift timings in IST.
          </p>
        </div>
      </div>

      <div className="panel">
        <label>
          Select Seva Opportunity

          <select
            value={selectedId}
            onChange={e =>
              setSelectedId(e.target.value)
            }
          >
            <option value="">
              Select opportunity
            </option>

            {opportunities.map(item => (
              <option
                key={item.id}
                value={item.id}
              >
                {item.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      {opportunity ? (
        <ShiftManager
          key={opportunity.id}
          opportunity={opportunity}
        />
      ) : (
        <div className="panel">
          Select an opportunity to manage shifts.
        </div>
      )}
    </>
  );
}

function ShiftManager({
  opportunity,
}: {
  opportunity: VolunteerOpportunity;
}) {
  const endpoint =
    `/opportunities/${opportunity.id}/shifts`;

  const manager =
    useVolunteerManager<Shift>(endpoint);

  const [form, setForm] =
    useState<ShiftForm | null>(null);

  const [editingId, setEditingId] =
    useState<number | null>(null);

  const [bulk, setBulk] =
    useState(false);

  const [lastDate, setLastDate] =
    useState('');

  const [search, setSearch] =
    useState('');

  const [status, setStatus] =
    useState('all');

  function add() {
    setEditingId(null);
    setBulk(false);

    setForm({
      shift_name: '',
      service_date:
        opportunity.service_start_date.slice(0, 10),
      start_time: '06:00',
      end_time: '10:00',
    });

    setLastDate(
      opportunity.service_end_date.slice(0, 10)
    );

    manager.setError('');
  }

  function edit(item: Shift) {
    setEditingId(item.id);
    setBulk(false);

    setForm({
      shift_name: item.shift_name,
      service_date: item.service_date.slice(0, 10),
      start_time: item.start_time.slice(0, 8),
      end_time: item.end_time.slice(0, 8),
    });

    manager.setError('');

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  function update(
    key: keyof ShiftForm,
    value: string
  ) {
    setForm(current =>
      current
        ? { ...current, [key]: value }
        : null
    );
  }

  async function save(event: FormEvent) {
    event.preventDefault();

    if (!form || manager.disabled) return;

    const normalizedTime = (value: string) =>
      value.length === 5 ? `${value}:00` : value;

    if (!form.shift_name.trim()) {
      manager.setError('Shift name is required.');
      return;
    }

    if (
      normalizedTime(form.end_time) <=
      normalizedTime(form.start_time)
    ) {
      manager.setError(
        'End time must be after start time.'
      );
      return;
    }

    const first = form.service_date;

    const last = bulk && !editingId
      ? lastDate
      : first;

    if (
      !first ||
      !last ||
      last < first ||
      first < opportunity.service_start_date.slice(0, 10) ||
      last > opportunity.service_end_date.slice(0, 10)
    ) {
      manager.setError(
        'Shift dates must be within the service period.'
      );
      return;
    }

    const shifts: ShiftForm[] = [];

    const start = new Date(`${first}T00:00:00Z`);
    const end = new Date(`${last}T00:00:00Z`);

    for (
      let date = start.getTime();
      date <= end.getTime();
      date += 86400000
    ) {
      const serviceDate =
        new Date(date).toISOString().slice(0, 10);

      if (
        !editingId &&
        !isFutureShift(
          serviceDate,
          form.start_time
        )
      ) {
        manager.setError(
          `Shift on ${serviceDate} is in the past.`
        );
        return;
      }

      shifts.push({
        ...form,
        service_date: serviceDate,
        shift_name: form.shift_name.trim(),
      });

      if (shifts.length > 500) {
        manager.setError(
          'Maximum 500 shifts per request.'
        );
        return;
      }
    }

    if (
      shifts.length > 1 &&
      !window.confirm(
        `Create ${shifts.length} service shifts?`
      )
    ) {
      return;
    }

    const id = editingId;

    await manager.mutate(
      () =>
        volunteerRequest(
          id ? `${endpoint}/${id}` : endpoint,

          jsonRequest(
            id ? 'PUT' : 'POST',
            id ? shifts[0] : { shifts }
          )
        ),

      id
        ? 'Shift updated successfully.'
        : `${shifts.length} shift(s) created successfully.`,

      () => {
        setForm(null);
        setEditingId(null);
      }
    );
  }

  async function toggle(item: Shift) {
    if (
      !window.confirm(
        `${item.is_active ? 'Disable' : 'Enable'} this shift?`
      )
    ) {
      return;
    }

    await manager.mutate(
      () =>
        volunteerRequest(
          `${endpoint}/${item.id}/status`,

          jsonRequest('PATCH', {
            is_active: !item.is_active,
          })
        ),

      'Shift status updated.'
    );
  }

  const filtered = manager.items.filter(
    item =>
      (
        status === 'all' ||
        item.is_active === (status === 'active')
      ) &&
      (
        item.shift_name
          .toLowerCase()
          .includes(search.toLowerCase()) ||
        item.service_date.includes(search)
      )
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h3>{opportunity.title}</h3>

          <p>
            {formatServiceDate(
              opportunity.service_start_date
            )}
            {' — '}
            {formatServiceDate(
              opportunity.service_end_date
            )}
          </p>
        </div>

        <div className="actions">
          <button
            disabled={manager.busy}
            onClick={() => void manager.refresh()}
          >
            Refresh
          </button>

          <button
            className="primary"
            disabled={manager.disabled}
            onClick={add}
          >
            + Create Shift
          </button>
        </div>
      </div>

      {manager.error && (
        <div className="error" role="alert">
          {manager.error}
        </div>
      )}

      {manager.needsRefresh && (
        <p>
          Refresh records before retrying changes.
        </p>
      )}

      {manager.success && (
        <div className="panel"
          style={{ color: '#15803d' }}>
          {manager.success}
        </div>
      )}

      {form && (
        <form
          className="form-card"
          onSubmit={save}
        >
          <h3>
            {editingId ? 'Edit Shift' : 'Create Shift'}
          </h3>

          <fieldset
            disabled={manager.disabled}
            style={{
              border: 0,
              padding: 0,
              margin: 0,
              minWidth: 0,
            }}
          >
            {!editingId && (
              <label style={{
                display: 'flex',
                gap: 10,
                alignItems: 'center',
              }}>
                <input
                  type="checkbox"
                  style={{ width: 'auto' }}
                  checked={bulk}
                  onChange={e =>
                    setBulk(e.target.checked)
                  }
                />

                Create same shift for multiple dates
              </label>
            )}

            <label>
              Shift Name *

              <input
                required
                maxLength={150}
                placeholder="Morning Shift"
                value={form.shift_name}
                onChange={e =>
                  update(
                    'shift_name',
                    e.target.value
                  )
                }
              />
            </label>

            <div className="grid2">
              <label>
                {bulk ? 'From Date' : 'Service Date'}

                <input
                  type="date"
                  required
                  min={opportunity.service_start_date.slice(0, 10)}
                  max={opportunity.service_end_date.slice(0, 10)}
                  value={form.service_date}
                  onChange={e =>
                    update(
                      'service_date',
                      e.target.value
                    )
                  }
                />
              </label>

              {bulk && (
                <label>
                  To Date

                  <input
                    type="date"
                    required
                    min={form.service_date}
                    max={opportunity.service_end_date.slice(0, 10)}
                    value={lastDate}
                    onChange={e =>
                      setLastDate(e.target.value)
                    }
                  />
                </label>
              )}
            </div>

            <div className="grid2">
              <label>
                Start Time (IST)

                <input
                  type="time"
                  required
                  step={1}
                  value={form.start_time}
                  onChange={e =>
                    update(
                      'start_time',
                      e.target.value
                    )
                  }
                />
              </label>

              <label>
                End Time (IST)

                <input
                  type="time"
                  required
                  step={1}
                  value={form.end_time}
                  onChange={e =>
                    update(
                      'end_time',
                      e.target.value
                    )
                  }
                />
              </label>
            </div>

            {editingId && (
              <p>
                Dates and timings cannot be changed
                after volunteers or requirements
                have been linked to this shift.
              </p>
            )}

            <button
              type="submit"
              className="primary"
            >
              {manager.busy
                ? 'Saving…'
                : 'Save Shift'}
            </button>
          </fieldset>

          <button
            type="button"
            disabled={manager.busy}
            style={{ marginTop: 12 }}
            onClick={() => setForm(null)}
          >
            Cancel
          </button>
        </form>
      )}

      <div className="panel grid2">
        <label>
          Search Shifts

          <input
            value={search}
            onChange={e =>
              setSearch(e.target.value)
            }
          />
        </label>

        <label>
          Status

          <select
            value={status}
            onChange={e =>
              setStatus(e.target.value)
            }
          >
            <option value="all">All Shifts</option>
            <option value="active">Active</option>
            <option value="inactive">Disabled</option>
          </select>
        </label>
      </div>

      {manager.loading && <p>Loading shifts…</p>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Shift</th>
              <th>Date</th>
              <th>Timing (IST)</th>
              <th>Required</th>
              <th>Available</th>
              <th>Assigned</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map(item => (
              <tr key={item.id}>
                <td>
                  <strong>{item.shift_name}</strong>
                </td>

                <td>
                  {formatServiceDate(
                    item.service_date
                  )}
                </td>

                <td>
                  {item.start_time.slice(0, 5)}
                  {' — '}
                  {item.end_time.slice(0, 5)}
                </td>

                <td>{item.required_volunteers}</td>
                <td>{item.available_volunteers}</td>
                <td>{item.assigned_volunteers}</td>

                <td>
                  {item.is_active
                    ? 'Active'
                    : 'Disabled'}
                </td>

                <td>
                  <div className="actions">
                    <button
                      disabled={manager.disabled}
                      onClick={() => edit(item)}
                    >
                      Edit
                    </button>

                    <button
                      disabled={
                        manager.disabled ||
                        (
                          !item.is_active &&
                          !isFutureShift(
                            item.service_date,
                            item.start_time
                          )
                        )
                      }
                      onClick={() =>
                        void toggle(item)
                      }
                    >
                      {item.is_active
                        ? 'Disable'
                        : 'Enable'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {manager.loaded &&
              !manager.loading &&
              !filtered.length && (
                <tr>
                  <td colSpan={8}>
                    No shifts found.
                  </td>
                </tr>
              )}
          </tbody>
        </table>
      </div>
    </>
  );
}