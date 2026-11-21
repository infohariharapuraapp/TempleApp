import {
  beginVolunteerOperation,
} from '../../lib/volunteerOperationGuard';
import {
  useState,
  useEffect,
  useRef,
} from 'react';

import {
  volunteerRequest,
  jsonRequest,
  getErrorMessage,
  formatServiceDate,
  type VolunteerOpportunity,
} from '../../lib/volunteerApi';

// ========================================
// TYPES
// ========================================

interface ReportingVolunteer {
  service_date_id: number;
  service_date: string;

  member_id: number;
  member_code: string;
  full_name: string;
  mobile: string;
  is_team_leader: boolean;

  registration_id: number;
  registration_code: string;
  registration_type: string;
  group_name: string | null;

  reporting_id: number | null;
  reporting_status: string;
  reporting_time: string | null;
  reporting_location: string | null;
  coordinator_name: string | null;
  coordinator_phone: string | null;
  special_instructions: string | null;
  revision: number | null;

  attendance_status: string;
  attendance_finalized: boolean;
}

interface ReportingData {
  opportunity_id: number;
  service_date: string;

  stats: {
    total_volunteers: number;
    not_sent: number;
    awaiting_confirmation: number;
    confirmed: number;
    cancelled: number;
  };

  volunteers: ReportingVolunteer[];
}

interface ReportingForm {
  reporting_time: string;
  reporting_location: string;
  coordinator_name: string;
  coordinator_phone: string;
  special_instructions: string;
}

const emptyForm: ReportingForm = {
  reporting_time: '',
  reporting_location: '',
  coordinator_name: '',
  coordinator_phone: '',
  special_instructions: '',
};

const statusLabels: Record<string, string> = {
  not_sent: 'Not Sent',
  awaiting_response: 'Awaiting Confirmation',
  confirmed: 'Confirmed',
  coordinator_contacted: 'Contacted Coordinator',
  cancelled: 'Cancelled',
};

const statusColors: Record<string, string> = {
  not_sent: '#64748b',
  awaiting_response: '#b45309',
  confirmed: '#15803d',
  coordinator_contacted: '#2563eb',
  cancelled: '#b91c1c',
};

function todayIST() {
  return new Date(
    Date.now() + 330 * 60 * 1000
  ).toISOString().slice(0, 10);
}

function formatTime(value: string | null) {
  if (!value) return '—';

  const [hour, minute] = value.split(':');

  const h = Number(hour);

  return `${h % 12 || 12}:${minute} ${
    h >= 12 ? 'PM' : 'AM'
  }`;
}

function canAllocate(row: ReportingVolunteer) {
  return (
    row.reporting_status === 'not_sent' &&
    row.attendance_status === 'not_marked' &&
    !row.attendance_finalized
  );
}

function canEdit(row: ReportingVolunteer) {
  return (
    row.reporting_id !== null &&
    row.revision !== null &&
    !row.attendance_finalized &&
    row.attendance_status === 'not_marked' &&
    [
      'awaiting_response',
      'confirmed',
      'coordinator_contacted',
      'cancelled',
    ].includes(row.reporting_status)
  );
}

// ========================================
// MAIN COMPONENT
// ========================================

export default function DailyReporting({
  opportunities,
  selectedProgrammeId,
}: {
  opportunities: VolunteerOpportunity[];
  selectedProgrammeId: string;
}) {
  const opportunityId = opportunities.some(
    item => String(item.id) === selectedProgrammeId
  )
    ? selectedProgrammeId
    : '';
  const [date, setDate] = useState(() => {
    const item = opportunities.find(
      row => String(row.id) === opportunityId
    );
    if (!item) return '';
    const start =
      item.service_start_date.slice(0, 10);
    const end =
      item.service_end_date.slice(0, 10);
    const today = todayIST();
    return today < start
      ? start
      : today > end
        ? end
        : today;
  });

  const [data, setData] =
    useState<ReportingData | null>(null);

  const [selected, setSelected] =
    useState<number[]>([]);

  const [form, setForm] =
    useState<ReportingForm>({ ...emptyForm });

  const [editing, setEditing] =
    useState<ReportingVolunteer | null>(null);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [registrationType, setRegistrationType] =
    useState('all');
  const [memberRole, setMemberRole] =
    useState('all');

  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [requiresRefresh, setRequiresRefresh] =
    useState(false);

  const mounted = useRef(false);
  const version = useRef(0);
  const mutationLock = useRef(false);

  const opportunity = opportunities.find(
    row => String(row.id) === opportunityId
  );

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
      version.current++;
    };
  }, []);

  // ========================================
  // LOAD DAILY REPORTING
  // ========================================

  async function load(): Promise<boolean> {

    if (
      !opportunityId ||
      !date
    ) {
      return false;
    }

    const currentVersion = ++version.current;

    setLoading(true);
    setError('');
    setRequiresRefresh(true);

    try {

      const response =
        await volunteerRequest<ReportingData>(
          `/opportunities/${opportunityId}/reporting?service_date=${encodeURIComponent(date)}`
        );

      if (
        !response.data ||
        !Array.isArray(response.data.volunteers) ||
        !response.data.stats ||
        Number(response.data.opportunity_id) !==
          Number(opportunityId) ||
        response.data.service_date !== date
      ) {
        throw new Error(
          'Invalid reporting response.'
        );
      }

      if (
        !mounted.current ||
        currentVersion !== version.current
      ) {
        return false;
      }

      setData(response.data);
      setSelected([]);
      setEditing(null);
      setRequiresRefresh(false);

      return true;

    } catch (error) {

      if (
        mounted.current &&
        currentVersion === version.current
      ) {
        setError(getErrorMessage(error));
      }

      return false;

    } finally {

      if (
        mounted.current &&
        currentVersion === version.current
      ) {
        setLoading(false);
      }
    }
  }

  function resetRecords() {

    version.current++;

    setData(null);
    setSelected([]);
    setEditing(null);
    setForm({ ...emptyForm });

    setLoading(false);
    setError('');
    setSuccess('');
    setRequiresRefresh(false);
  }

  function changeDate(value: string) {

    if (mutationLock.current) return;

    resetRecords();

    setDate(value);
  }

  // ========================================
  // FILTER AND SELECT
  // ========================================

  const rows = data?.volunteers || [];

  const filtered = rows.filter(row => {
    if (
      registrationType !== 'all' &&
      row.registration_type !== registrationType
    ) {
      return false;
    }
    if (
      memberRole === 'leader' &&
      (
        row.registration_type !== 'group' ||
        !row.is_team_leader
      )
    ) {
      return false;
    }
    if (
      memberRole === 'member' &&
      (
        row.registration_type !== 'group' ||
        row.is_team_leader
      )
    ) {
      return false;
    }

    if (
      filter !== 'all' &&
      row.reporting_status !== filter
    ) {
      return false;
    }

    const q = search.trim().toLowerCase();

    return (
      !q ||
      [
        row.full_name,
        row.member_code,
        row.mobile,
        row.group_name,
        row.registration_code,
      ].some(value =>
        String(value || '')
          .toLowerCase()
          .includes(q)
      )
    );
  });

  const selectable = filtered.filter(
    canAllocate
  );

  const disabled =
    busy ||
    loading ||
    requiresRefresh ||
    !data;

  function toggleMember(id: number) {

    if (disabled || editing) return;

    setSelected(current =>

      current.includes(id)

        ? current.filter(value => value !== id)

        : current.length >= 500

          ? current

          : [...current, id]
    );
  }

  function selectVisible() {

    if (disabled || editing) return;

    const ids = selectable.map(
      row => row.service_date_id
    );

    setSelected(current => {

      const allSelected = ids.every(
        id => current.includes(id)
      );

      if (allSelected) {

        return current.filter(
          id => !ids.includes(id)
        );
      }

      return [
        ...new Set([...current, ...ids]),
      ].slice(0, 500);
    });
  }

  function selectGroup(registrationId: number) {

    if (disabled || editing) return;

    const ids = filtered
      .filter(
        row =>
          row.registration_id === registrationId &&
          canAllocate(row)
      )
      .map(row => row.service_date_id);

    setSelected(current => [
      ...new Set([...current, ...ids]),
    ].slice(0, 500));
  }

  // ========================================
  // MUTATION
  // ========================================

  async function mutate(
    task: () => Promise<string>
  ) {

    if (
      mutationLock.current ||
      disabled
    ) {
      return;
    }

    const releaseOperation = beginVolunteerOperation('Daily reporting');
    mutationLock.current = true;

    setBusy(true);
    setError('');
    setSuccess('');

    try {

      const message = await task();

      if (!mounted.current) return;

      setSuccess(message);

      const refreshed = await load();

      if (
        mounted.current &&
        !refreshed
      ) {
        setRequiresRefresh(true);
      }

    } catch (error) {

      if (mounted.current) {

        setError(getErrorMessage(error));

        setRequiresRefresh(true);
      }

    } finally {

      mutationLock.current = false;
      releaseOperation();

      if (mounted.current) {
        setBusy(false);
      }
    }
  }

  // ========================================
  // VALIDATE REPORTING DETAILS
  // ========================================

  function validateForm() {

    if (!form.reporting_time) {
      return 'Enter reporting time.';
    }

    if (
      Date.parse(
        `${date}T${form.reporting_time}:00+05:30`
      ) <= Date.now()
    ) {
      return 'Reporting time must be in the future.';
    }

    if (!form.reporting_location.trim()) {
      return 'Enter reporting location.';
    }

    if (!form.coordinator_name.trim()) {
      return 'Enter coordinator name.';
    }

    if (!form.coordinator_phone.trim()) {
      return 'Enter coordinator phone number.';
    }

    return null;
  }

  // ========================================
  // SEND OR UPDATE REPORTING
  // ========================================

  async function submit(
    event: React.FormEvent
  ) {

    event.preventDefault();

    if (disabled) return;

    const validation = validateForm();

    if (validation) {

      setError(validation);
      return;
    }

    if (editing) {

      if (
        !window.confirm(
          `Update reporting for ${editing.full_name}? If reporting details changed, the volunteer will need to confirm again.`
        )
      ) {
        return;
      }

      await mutate(async () => {

        await volunteerRequest(
          `/reporting/${editing.reporting_id}`,
          jsonRequest('PATCH', {
            ...form,
            action: 'update',
            revision: editing.revision,
          })
        );

        return 'Reporting details updated.';
      });

      return;
    }

    const validSelection = new Set(
      selectable.map(row => row.service_date_id)
    );
    if (
      selected.length > 500 ||
      selected.some(id => !validSelection.has(id))
    ) {
      setSelected([]);
      setError(
        'Volunteer selection changed. Select matching volunteers again.'
      );
      return;
    }
    if (!selected.length) {

      setError(
        'Select at least one volunteer.'
      );

      return;
    }

    if (
      !window.confirm(
        `Send reporting details to ${selected.length} selected volunteers?`
      )
    ) {
      return;
    }

    await mutate(async () => {

      const response =
        await volunteerRequest<{
          selected: number;
          reporting_created: number;
          skipped: number;
          notifications_queued: number;
        }>(
          `/opportunities/${opportunityId}/reporting`,
          jsonRequest('POST', {
            ...form,
            service_date: date,
            service_date_ids: selected,
          })
        );

      return (
        `Reporting created: ${response.data.reporting_created}. ` +
        `Skipped: ${response.data.skipped}. ` +
        `Notifications queued: ${response.data.notifications_queued}.`
      );
    });
  }

  function editReporting(
    row: ReportingVolunteer
  ) {

    if (disabled || !canEdit(row)) return;

    setEditing(row);
    setSelected([]);

    setForm({
      reporting_time:
        row.reporting_time?.slice(0, 5) || '',

      reporting_location:
        row.reporting_location || '',

      coordinator_name:
        row.coordinator_name || '',

      coordinator_phone:
        row.coordinator_phone || '',

      special_instructions:
        row.special_instructions || '',
    });

    document
      .getElementById('daily-reporting-form')
      ?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
  }

  async function cancelReporting(
    row: ReportingVolunteer
  ) {

    if (
      disabled ||
      !canEdit(row) ||
      row.reporting_status === 'cancelled'
    ) {
      return;
    }

    if (
      !window.confirm(
        `Cancel reporting for ${row.full_name} on ${formatServiceDate(row.service_date)}?`
      )
    ) {
      return;
    }

    await mutate(async () => {

      await volunteerRequest(
        `/reporting/${row.reporting_id}`,
        jsonRequest('PATCH', {
          action: 'cancel',
          revision: row.revision,
        })
      );

      return 'Reporting cancelled.';
    });
  }

  // ========================================
  // UI
  // ========================================

  return (
    <>

      <div className="panel">

        <h3>Daily Reporting Management</h3>

        <p>
          Select a service date and send
          reporting instructions to approved
          volunteers.
        </p>

        <div className="grid2">

          <div style={{
              background: '#FFFDF8',
              border: '1px solid #e7d9be',
              padding: '12px 16px',
              borderRadius: 10,
            }}>
              <small>Selected Seva Programme</small>
              <div style={{
                color: '#6B1720',
                fontWeight: 700,
                marginTop: 5,
              }}>
                {opportunity?.title ||
                  'Choose a programme from the workspace above.'}
              </div>
            </div>

          <label>
            Service Date (IST)

            <input
              type="date"
              value={date}
              min={
                opportunity?.service_start_date
                  .slice(0, 10)
              }
              max={
                opportunity?.service_end_date
                  .slice(0, 10)
              }
              disabled={
                !opportunityId ||
                busy ||
                loading
              }
              onChange={event =>
                changeDate(event.target.value)
              }
            />

          </label>

        </div>

        <div className="actions">

          <button
            type="button"
            className="primary"
            disabled={
              !opportunityId ||
              !date ||
              busy ||
              loading
            }
            onClick={() => void load()}
          >
            {loading
              ? 'Loading…'
              : 'Load / Refresh Volunteers'}
          </button>

        </div>

      </div>

      {error && (
        <div className="error" role="alert">
          {error}
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

      {requiresRefresh && !loading && (
        <div className="panel" role="alert">
          Refresh volunteer records before
          performing another change.
        </div>
      )}

      {data && (
        <>

          <div className="stats">

            {[
              [
                'Available Volunteers',
                data.stats.total_volunteers,
              ],
              [
                'Not Sent',
                data.stats.not_sent,
              ],
              [
                'Awaiting Confirmation',
                data.stats.awaiting_confirmation,
              ],
              [
                'Confirmed',
                data.stats.confirmed,
              ],
              [
                'Cancelled',
                data.stats.cancelled,
              ],
            ].map(([label, count]) => (

              <div
                className="stat"
                key={String(label)}
              >
                <span>{label}</span>
                <strong>{count}</strong>
              </div>

            ))}

          </div>

          <form
            id="daily-reporting-form"
            className="form-card"
            onSubmit={submit}
          >

            <h3>
              {editing
                ? `Edit Reporting — ${editing.full_name}`
                : 'Allocate Reporting Details'}
            </h3>

            <p>
              Reporting Date: {formatServiceDate(date)}
            </p>

            <fieldset
              disabled={disabled}
              style={{
                border: 0,
                margin: 0,
                padding: 0,
                minWidth: 0,
              }}
            >

              <div className="grid2">

                <label>
                  Reporting Time (IST) *

                  <input
                    required
                    type="time"
                    value={form.reporting_time}
                    onChange={event =>
                      setForm(current => ({
                        ...current,
                        reporting_time:
                          event.target.value,
                      }))
                    }
                  />

                </label>

                <label>
                  Reporting Location *

                  <input
                    required
                    maxLength={1000}
                    value={form.reporting_location}
                    placeholder="Temple Main Entrance"
                    onChange={event =>
                      setForm(current => ({
                        ...current,
                        reporting_location:
                          event.target.value,
                      }))
                    }
                  />

                </label>

                <label>
                  Coordinator Name *

                  <input
                    required
                    maxLength={255}
                    value={form.coordinator_name}
                    placeholder="Seva Coordinator"
                    onChange={event =>
                      setForm(current => ({
                        ...current,
                        coordinator_name:
                          event.target.value,
                      }))
                    }
                  />

                </label>

                <label>
                  Coordinator Mobile / WhatsApp *

                  <input
                    required
                    type="tel"
                    maxLength={30}
                    value={form.coordinator_phone}
                    placeholder="+91XXXXXXXXXX"
                    onChange={event =>
                      setForm(current => ({
                        ...current,
                        coordinator_phone:
                          event.target.value,
                      }))
                    }
                  />

                </label>

              </div>

              <label>
                Special Instructions

                <textarea
                  rows={4}
                  maxLength={5000}
                  value={form.special_instructions}
                  placeholder="Dress code, items to carry, arrival instructions..."
                  onChange={event =>
                    setForm(current => ({
                      ...current,
                      special_instructions:
                        event.target.value,
                    }))
                  }
                />

              </label>

              <div className="panel">

                {editing
                  ? 'Updating reporting details will require fresh confirmation.'
                  : `${selected.length} volunteer(s) selected. Select volunteers from the list below.`}

                <p>
                  Volunteers can confirm availability
                  in My Sevas or contact their
                  coordinator directly.
                </p>

              </div>

              <div className="actions">

                <button
                  type="submit"
                  className="primary"
                  disabled={
                    disabled ||
                    (!editing && !selected.length)
                  }
                >
                  {busy
                    ? 'Processing…'
                    : editing
                      ? 'Update Reporting'
                      : `Send Reporting (${selected.length})`}
                </button>

                {editing && (

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {

                      setEditing(null);
                      setForm({ ...emptyForm });

                    }}
                  >
                    Cancel Editing
                  </button>

                )}

              </div>

            </fieldset>

          </form>

          <div className="panel">

            <div className="vs-availability-dashboard">
              <div className="vs-availability-heading">
                <span className="vs-filter-kicker">
                  SERVICE PREPARATION
                </span>
                <h3>Volunteer Availability</h3>
                <p>
                  Manage date-wise reporting,
                  group volunteers and confirmations.
                </p>
                <span className="vs-date-pill">
                  Service Date: {date}
                </span>
              </div>
              <div className="vs-availability-stats">
                <article className="vs-availability-stat">
                  <span>Matching Volunteers</span>
                  <strong>{filtered.length}</strong>
                  <small>
                    Of {rows.length} loaded volunteers
                  </small>
                </article>
                <article className="vs-availability-stat">
                  <span>Individual Volunteers</span>
                  <strong>
                    {filtered.filter(
                      row =>
                        row.registration_type === 'individual'
                    ).length}
                  </strong>
                  <small>Individual registrations</small>
                </article>
                <article className="vs-availability-stat">
                  <span>Group Volunteers</span>
                  <strong>
                    {filtered.filter(
                      row =>
                        row.registration_type === 'group'
                    ).length}
                  </strong>
                  <small>Leaders and members</small>
                </article>
                <article className="vs-availability-stat vs-stat-confirmed">
                  <span>Confirmed</span>
                  <strong>
                    {filtered.filter(
                      row =>
                        row.reporting_status === 'confirmed'
                    ).length}
                  </strong>
                  <small>Reporting acknowledged</small>
                </article>
              </div>
              <div className="vs-advanced-filter-panel">
                <div className="vs-filter-panel-heading">
                  <div>
                    <h4>Advanced Filters</h4>
                    <small>
                      Find the volunteers you need.
                    </small>
                  </div>
                  <button
                    type="button"
                    className="vs-clear-filter"
                    disabled={busy || loading}
                    onClick={() => {
                      setSearch('');
                      setFilter('all');
                      setRegistrationType('all');
                      setMemberRole('all');
                      setSelected([]);
                    }}
                  >
                    Clear Filters
                  </button>
                </div>
                <div className="vs-filter-grid">
                  <label>
                    Registration Type
                    <select
                      disabled={busy || loading}
                      value={registrationType}
                      onChange={event => {
                        setRegistrationType(event.target.value);
                        setMemberRole('all');
                        setSelected([]);
                      }}
                    >
                      <option value="all">
                        All Registration Types
                      </option>
                      <option value="individual">
                        Individual
                      </option>
                      <option value="group">
                        Group
                      </option>
                    </select>
                  </label>
                  <label>
                    Volunteer Role
                    <select
                      disabled={
                        busy ||
                        loading ||
                        registrationType === 'individual'
                      }
                      value={memberRole}
                      onChange={event => {
                        setMemberRole(event.target.value);
                        setSelected([]);
                      }}
                    >
                      <option value="all">
                        All Volunteers
                      </option>
                      <option value="leader">
                        Group Leaders
                      </option>
                      <option value="member">
                        Group Members
                      </option>
                    </select>
                  </label>
                </div>
                <div className="vs-filter-result-bar">
                  <span>
                    Showing {filtered.length}
                    {' of '}{rows.length} volunteers
                  </span>
                  <strong>
                    {selected.length} selected
                  </strong>
                </div>
                <small className="vs-selection-help">
                  Changing filters clears the current
                  selection. Group selection includes
                  only visible, eligible volunteers.
                </small>
              </div>
            </div>

            <div className="grid2">

              <label>
                Search Volunteers

                <input
                  value={search}
                  placeholder="Name, mobile, group or code"
                  disabled={busy || loading}
                  onChange={event => {
                    setSearch(event.target.value);
                    setSelected([]);
                  }}
                />

              </label>

              <label>
                Reporting Status

                <select
                  value={filter}
                  disabled={busy || loading}
                  onChange={event => {
                    setFilter(event.target.value);
                    setSelected([]);
                  }}
                >

                  <option value="all">
                    All Volunteers
                  </option>

                  {Object.entries(statusLabels)
                    .map(([value, label]) => (

                      <option
                        key={value}
                        value={value}
                      >
                        {label}
                      </option>

                    ))}

                </select>

              </label>

            </div>

            <div
              className="actions"
              style={{ flexWrap: 'wrap' }}
            >

              <button
                type="button"
                disabled={
                  disabled ||
                  !!editing ||
                  selectable.length === 0
                }
                onClick={selectVisible}
              >
                Select / Deselect Visible Unsent
              </button>

              <button
                type="button"
                disabled={busy || loading}
                onClick={() => setSelected([])}
              >
                Clear Selection
              </button>

              <strong>
                {selected.length} selected
              </strong>

            </div>

            <small>
              Maximum 500 volunteers per allocation.
              Selection resets whenever search or filters change.
            </small>

          </div>

          <div className="table-wrap">

            <table>

              <thead>

                <tr>
                  <th>Select</th>
                  <th>Volunteer</th>
                  <th>Registration</th>
                  <th>Reporting Status</th>
                  <th>Reporting Details</th>
                  <th>Coordinator</th>
                  <th>Actions</th>
                </tr>

              </thead>

              <tbody>

                {filtered.length === 0 && (

                  <tr>
                    <td colSpan={7}>
                      No matching volunteers for
                      this service date.
                    </td>
                  </tr>

                )}

                {filtered.map(row => (

                  <tr key={row.service_date_id}>

                    <td>

                      <input
                        type="checkbox"
                        aria-label={`Select ${row.full_name}`}
                        style={{ width: 'auto' }}
                        disabled={
                          disabled ||
                          !!editing ||
                          !canAllocate(row)
                        }
                        checked={
                          selected.includes(
                            row.service_date_id
                          )
                        }
                        onChange={() =>
                          toggleMember(
                            row.service_date_id
                          )
                        }
                      />

                    </td>

                    <td>

                      <strong>
                        {row.full_name}
                      </strong>

                      {row.is_team_leader && (
                        <div>
                          <small>Group Leader</small>
                        </div>
                      )}

                      <div>
                        <small>
                          {row.member_code}
                        </small>
                      </div>

                      <small>{row.mobile}</small>

                    </td>

                    <td>

                      <div>
                        {row.registration_code}
                      </div>

                      <small>
                        {row.group_name ||
                          row.registration_type}
                      </small>

                      {row.registration_type ===
                        'group' && (

                        <div>

                          <button
                            type="button"
                            disabled={
                              disabled || !!editing
                            }
                            onClick={() =>
                              selectGroup(
                                row.registration_id
                              )
                            }
                          >
                            Select Group
                          </button>

                        </div>

                      )}

                    </td>

                    <td>

                      <span
                        className="badge"
                        style={{
                          fontWeight: 700,
                          color:
                            statusColors[
                              row.reporting_status
                            ] || '#64748b',
                        }}
                      >

                        {statusLabels[
                          row.reporting_status
                        ] || row.reporting_status}

                      </span>

                      {row.attendance_finalized && (
                        <div>
                          <small>
                            Attendance finalized
                          </small>
                        </div>
                      )}

                    </td>

                    <td>

                      <strong>
                        {formatTime(
                          row.reporting_time
                        )}
                      </strong>

                      <div>
                        {row.reporting_location ||
                          '—'}
                      </div>

                      {row.special_instructions && (
                        <small>
                          {row.special_instructions}
                        </small>
                      )}

                    </td>

                    <td>

                      <div>
                        {row.coordinator_name || '—'}
                      </div>

                      <small>
                        {row.coordinator_phone || ''}
                      </small>

                    </td>

                    <td>

                      <div
                        className="actions"
                        style={{ flexWrap: 'wrap' }}
                      >

                        {canEdit(row) && (

                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() =>
                              editReporting(row)
                            }
                          >
                            {row.reporting_status ===
                            'cancelled'
                              ? 'Reschedule'
                              : 'Edit'}
                          </button>

                        )}

                        {canEdit(row) &&
                          row.reporting_status !==
                            'cancelled' && (

                          <button
                            type="button"
                            disabled={disabled}
                            style={{
                              color: '#b91c1c',
                            }}
                            onClick={() =>
                              void cancelReporting(row)
                            }
                          >
                            Cancel Reporting
                          </button>

                        )}

                      </div>

                    </td>

                  </tr>

                ))}

              </tbody>

            </table>

          </div>

        </>
      )}

    </>
  );
}