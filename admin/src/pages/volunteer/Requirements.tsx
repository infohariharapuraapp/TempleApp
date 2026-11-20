import {
  useEffect,
  useState,
} from 'react';

import type { FormEvent } from 'react';

import {
  volunteerRequest,
  jsonRequest,
  getErrorMessage,
  formatServiceDate,
  isFutureShift,
} from '../../lib/volunteerApi';

import type {
  VolunteerOpportunity,
} from '../../lib/volunteerApi';

import { useVolunteerManager } from './useVolunteerManager';

type Duty = {
  id: number;
  name: string;
  is_active: boolean;
};

type Shift = {
  id: number;
  shift_name: string;
  service_date: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
};

type RequirementForm = {
  shift_id: number;
  duty_id: number;
  required_count: number;
  reporting_location: string;
  reporting_time: string;
  coordinator_name: string;
  coordinator_phone: string;
  instructions: string;
};

type Requirement = RequirementForm & {
  id: number;
  duty_name: string;
  shift_name: string;
  service_date: string;
  start_time: string;
  end_time: string;
  assigned_volunteers: number;
  remaining_volunteers: number;
  effective_reporting_location: string;
  effective_coordinator_name: string;
  effective_coordinator_phone: string;
  duty_is_active: boolean;
  shift_is_active: boolean;
  is_active: boolean;
};

const emptyForm: RequirementForm = {
  shift_id: 0,
  duty_id: 0,
  required_count: 1,
  reporting_location: '',
  reporting_time: '',
  coordinator_name: '',
  coordinator_phone: '',
  instructions: '',
};

export default function Requirements({
  opportunities,
  selectedProgrammeId,
}: {
  opportunities: VolunteerOpportunity[];
  selectedProgrammeId: string;
}) {
  const selectedId = selectedProgrammeId;

  const opportunity = opportunities.find(
    item => String(item.id) === selectedId
  );

  return (
    <>
      <h3>Duty Requirements</h3>

      <div className="panel">
        <div
          style={{
            background: '#FFFDF8',
            border: '1px solid #e7d9be',
            borderRadius: 10,
            padding: '12px 16px',
            marginTop: 12,
          }}
        >
          <small>Selected Seva Programme</small>
          <div style={{
            color: '#6B1720',
            fontWeight: 700,
            marginTop: 5,
          }}>
            {opportunities.find(
              item =>
                String(item.id) === selectedProgrammeId
            )?.title ||
              'Choose a programme from the workspace above.'}
          </div>
        </div>
      </div>

      {opportunity ? (
        <RequirementManager
          key={opportunity.id}
          opportunity={opportunity}
        />
      ) : (
        <div className="panel">
          Select an opportunity to configure
          duty requirements.
        </div>
      )}
    </>
  );
}

function RequirementManager({
  opportunity,
}: {
  opportunity: VolunteerOpportunity;
}) {
  const base =
    `/opportunities/${opportunity.id}`;

  const endpoint = `${base}/requirements`;

  const manager =
    useVolunteerManager<Requirement>(endpoint);

  const [duties, setDuties] =
    useState<Duty[]>([]);

  const [shifts, setShifts] =
    useState<Shift[]>([]);

  const [optionsLoading, setOptionsLoading] =
    useState(true);

  const [optionsError, setOptionsError] =
    useState('');

  const [optionsVersion, setOptionsVersion] =
    useState(0);

  const [form, setForm] =
    useState<RequirementForm | null>(null);

  const [editingId, setEditingId] =
    useState<number | null>(null);

  const [filter, setFilter] =
    useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      setOptionsLoading(true);
      setOptionsError('');

      try {
        const [dutyResult, shiftResult] =
          await Promise.all([
            volunteerRequest<Duty[]>('/duties'),

            volunteerRequest<Shift[]>(
              `${base}/shifts`
            ),
          ]);

        if (
          !Array.isArray(dutyResult.data) ||
          !Array.isArray(shiftResult.data)
        ) {
          throw new Error(
            'Invalid duty or shift response.'
          );
        }

        if (!cancelled) {
          setDuties(dutyResult.data);
          setShifts(shiftResult.data);
        }
      } catch (error) {
        if (!cancelled) {
          setOptionsError(
            getErrorMessage(error)
          );
        }
      } finally {
        if (!cancelled) {
          setOptionsLoading(false);
        }
      }
    }

    void loadOptions();

    return () => {
      cancelled = true;
    };
  }, [base, optionsVersion]);

  const disabled =
    manager.disabled ||
    optionsLoading ||
    Boolean(optionsError);

  const activeDuties = duties.filter(
    duty => duty.is_active
  );

  const futureShifts = shifts.filter(
    shift =>
      shift.is_active &&
      isFutureShift(
        shift.service_date,
        shift.start_time
      )
  );

  function update<K extends keyof RequirementForm>(
    key: K,
    value: RequirementForm[K]
  ) {
    setForm(current =>
      current
        ? { ...current, [key]: value }
        : null
    );
  }

  function add() {
    setEditingId(null);

    setForm({
      ...emptyForm,
      shift_id: futureShifts[0]?.id || 0,
      duty_id: activeDuties[0]?.id || 0,
    });

    manager.setError('');
  }

  function edit(item: Requirement) {
    setEditingId(item.id);

    setForm({
      shift_id: item.shift_id,
      duty_id: item.duty_id,
      required_count: item.required_count,
      reporting_location:
        item.reporting_location || '',
      reporting_time:
        item.reporting_time?.slice(0, 8) || '',
      coordinator_name:
        item.coordinator_name || '',
      coordinator_phone:
        item.coordinator_phone || '',
      instructions:
        item.instructions || '',
    });

    manager.setError('');

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  async function save(event: FormEvent) {
    event.preventDefault();

    if (!form || disabled) return;

    if (
      !Number.isInteger(form.required_count) ||
      form.required_count < 1 ||
      form.required_count > 2147483647
    ) {
      manager.setError(
        'Enter a valid required volunteer count.'
      );
      return;
    }

    const shift = shifts.find(
      item => item.id === form.shift_id
    );

    const duty = duties.find(
      item => item.id === form.duty_id
    );

    if (!shift || !duty) {
      manager.setError(
        'Select a valid duty and shift.'
      );
      return;
    }

    if (
      !isFutureShift(
        shift.service_date,
        shift.start_time
      )
    ) {
      manager.setError(
        'The selected shift has already started.'
      );
      return;
    }

    if (
      !editingId &&
      (!shift.is_active || !duty.is_active)
    ) {
      manager.setError(
        'Select an active duty and shift.'
      );
      return;
    }

    const normalize = (time: string) =>
      time.length === 5 ? `${time}:00` : time;

    if (
      form.reporting_time &&
      normalize(form.reporting_time) >
        normalize(shift.start_time)
    ) {
      manager.setError(
        'Reporting time cannot be after shift start.'
      );
      return;
    }

    const existing = manager.items.find(
      item => item.id === editingId
    );

    if (
      existing &&
      form.required_count <
        existing.assigned_volunteers
    ) {
      manager.setError(
        'Required count cannot be below assigned volunteers.'
      );
      return;
    }

    const body = {
      required_count: form.required_count,

      reporting_location:
        form.reporting_location.trim() || null,

      reporting_time:
        form.reporting_time || null,

      coordinator_name:
        form.coordinator_name.trim() || null,

      coordinator_phone:
        form.coordinator_phone.trim() || null,

      instructions:
        form.instructions.trim() || null,
    };

    const id = editingId;

    await manager.mutate(
      () =>
        volunteerRequest(
          id ? `${endpoint}/${id}` : endpoint,

          jsonRequest(
            id ? 'PUT' : 'POST',

            id
              ? body
              : {
                  ...body,
                  shift_id: form.shift_id,
                  duty_id: form.duty_id,
                }
          )
        ),

      id
        ? 'Requirement updated successfully.'
        : 'Requirement created successfully.',

      () => setForm(null)
    );
  }

  async function toggle(item: Requirement) {
    if (
      !window.confirm(
        `${item.is_active ? 'Disable' : 'Enable'} this requirement?`
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

      'Requirement status updated.'
    );
  }

  const active = manager.items.filter(
    item => item.is_active
  );

  const totals = {
    required: active.reduce(
      (sum, item) =>
        sum + item.required_count,
      0
    ),

    assigned: active.reduce(
      (sum, item) =>
        sum + item.assigned_volunteers,
      0
    ),

    remaining: active.reduce(
      (sum, item) =>
        sum + item.remaining_volunteers,
      0
    ),
  };

  return (
    <>
      <div className="page-head">
        <h3>{opportunity.title}</h3>

        <div className="actions">
          <button
            disabled={manager.busy}
            onClick={() => {
              void manager.refresh();
              setOptionsVersion(
                current => current + 1
              );
            }}
          >
            Refresh
          </button>

          <button
            className="primary"
            disabled={
              disabled ||
              !futureShifts.length ||
              !activeDuties.length
            }
            onClick={add}
          >
            + Create Requirement
          </button>
        </div>
      </div>

      {(manager.error || optionsError) && (
        <div className="error" role="alert">
          {manager.error || optionsError}
        </div>
      )}

      {manager.needsRefresh && (
        <p>Refresh records before retrying changes.</p>
      )}

      {manager.success && (
        <div className="panel"
          style={{ color: '#15803d' }}>
          {manager.success}
        </div>
      )}

      {!optionsLoading &&
        !optionsError &&
        (
          !activeDuties.length ||
          !futureShifts.length
        ) && (
          <div className="panel">
            Create active duties and future service
            shifts before configuring requirements.
          </div>
        )}

      <div className="stats">
        {[
          ['Required Positions', totals.required],
          ['Assigned Positions', totals.assigned],
          ['Remaining Positions', totals.remaining],
        ].map(([label, count]) => (
          <div
            className="stat"
            key={String(label)}
          >
            <span>{label}</span>

            <strong>
              {manager.loaded ? count : '—'}
            </strong>
          </div>
        ))}
      </div>

      {form && (
        <form
          className="form-card"
          onSubmit={save}
        >
          <h3>
            {editingId
              ? 'Edit Requirement'
              : 'Create Requirement'}
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
              Service Shift *

              <select
                required
                disabled={Boolean(editingId)}
                value={form.shift_id || ''}
                onChange={e =>
                  update(
                    'shift_id',
                    Number(e.target.value)
                  )
                }
              >
                <option value="">Select shift</option>

                {(editingId
                  ? shifts
                  : futureShifts
                ).map(shift => (
                  <option
                    key={shift.id}
                    value={shift.id}
                  >
                    {formatServiceDate(
                      shift.service_date
                    )}
                    {' — '}
                    {shift.shift_name}
                    {' — '}
                    {shift.start_time.slice(0, 5)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Volunteer Duty *

              <select
                required
                disabled={Boolean(editingId)}
                value={form.duty_id || ''}
                onChange={e =>
                  update(
                    'duty_id',
                    Number(e.target.value)
                  )
                }
              >
                <option value="">Select duty</option>

                {(editingId
                  ? duties
                  : activeDuties
                ).map(duty => (
                  <option
                    key={duty.id}
                    value={duty.id}
                  >
                    {duty.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Required Volunteers *

              <input
                type="number"
                required
                min={1}
                max={2147483647}
                step={1}
                value={form.required_count}
                onChange={e =>
                  update(
                    'required_count',
                    Number(e.target.value)
                  )
                }
              />
            </label>

            <h3>Optional Reporting Details</h3>

            <p>
              Leave optional location, coordinator
              and instruction fields empty to use
              the selected duty's default details.
            </p>

            <div className="grid2">
              <label>
                Reporting Location

                <input
                  value={form.reporting_location}
                  maxLength={10000}
                  onChange={e =>
                    update(
                      'reporting_location',
                      e.target.value
                    )
                  }
                />
              </label>

              <label>
                Reporting Time (IST)

                <input
                  type="time"
                  step={1}
                  value={form.reporting_time}
                  onChange={e =>
                    update(
                      'reporting_time',
                      e.target.value
                    )
                  }
                />
              </label>

              <label>
                Coordinator Name

                <input
                  maxLength={255}
                  value={form.coordinator_name}
                  onChange={e =>
                    update(
                      'coordinator_name',
                      e.target.value
                    )
                  }
                />
              </label>

              <label>
                Coordinator Phone

                <input
                  maxLength={20}
                  value={form.coordinator_phone}
                  onChange={e =>
                    update(
                      'coordinator_phone',
                      e.target.value
                    )
                  }
                />
              </label>
            </div>

            <label>
              Additional Instructions

              <textarea
                rows={4}
                maxLength={10000}
                value={form.instructions}
                onChange={e =>
                  update(
                    'instructions',
                    e.target.value
                  )
                }
              />
            </label>

            <button
              className="primary"
              type="submit"
            >
              {manager.busy
                ? 'Saving…'
                : 'Save Requirement'}
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

      <div className="panel">
        <label>
          Filter by Shift

          <select
            value={filter}
            onChange={e =>
              setFilter(e.target.value)
            }
          >
            <option value="">All Shifts</option>

            {shifts.map(shift => (
              <option
                key={shift.id}
                value={shift.id}
              >
                {formatServiceDate(
                  shift.service_date
                )}
                {' — '}
                {shift.shift_name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {manager.loading && (
        <p>Loading requirements…</p>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Duty</th>
              <th>Shift</th>
              <th>Required</th>
              <th>Assigned</th>
              <th>Remaining</th>
              <th>Reporting</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {manager.items
              .filter(
                item =>
                  !filter ||
                  String(item.shift_id) === filter
              )
              .map(item => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.duty_name}</strong>
                  </td>

                  <td>
                    {item.shift_name}
                    <div>
                      <small>
                        {formatServiceDate(
                          item.service_date
                        )}
                      </small>
                    </div>
                  </td>

                  <td>{item.required_count}</td>
                  <td>{item.assigned_volunteers}</td>
                  <td>{item.remaining_volunteers}</td>

                  <td>
                    {item.effective_reporting_location || '—'}

                    <div>
                      <small>
                        {item.reporting_time?.slice(0, 5)}
                      </small>
                    </div>

                    <div>
                      <small>
                        {item.effective_coordinator_name}
                      </small>
                    </div>
                  </td>

                  <td>
                    {item.is_active
                      ? 'Active'
                      : 'Disabled'}

                    {(!item.duty_is_active ||
                      !item.shift_is_active) && (
                      <div>
                        <small>
                          Duty or shift unavailable
                        </small>
                      </div>
                    )}
                  </td>

                  <td>
                    <div className="actions">
                      <button
                        disabled={
                          disabled ||
                          !isFutureShift(
                            item.service_date,
                            item.start_time
                          )
                        }
                        onClick={() => edit(item)}
                      >
                        Edit
                      </button>

                      <button
                        disabled={
                          disabled ||
                          (
                            !item.is_active &&
                            (
                              !item.duty_is_active ||
                              !item.shift_is_active ||
                              !isFutureShift(
                                item.service_date,
                                item.start_time
                              )
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
              !manager.items.some(
                item =>
                  !filter ||
                  String(item.shift_id) === filter
              ) && (
                <tr>
                  <td colSpan={8}>
                    No requirements found.
                  </td>
                </tr>
              )}
          </tbody>
        </table>
      </div>
    </>
  );
}