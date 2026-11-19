import { useEffect, useRef, useState } from 'react';

import {
  volunteerRequest,
  jsonRequest,
  getErrorMessage,
  type VolunteerOpportunity,
} from '../../lib/volunteerApi';

export type AttendanceMode =
  | 'legacy'
  | 'simple'
  | 'detailed'
  | 'none';

export type AttendanceOpportunity =
  VolunteerOpportunity & {
    attendance_mode?: AttendanceMode;
  };

type Status =
  | 'not_marked'
  | 'present'
  | 'absent'
  | 'excused';

interface AttendanceRow {
  service_date_id: number;
  service_date: string;
  member_id: number;
  full_name: string;
  member_code: string;
  mobile: string;
  group_name: string | null;
  member_status: string;
  attendance_status: Status;
  check_in_at: string | null;
  check_out_at: string | null;
  total_service_hours: number | string | null;
  remarks: string | null;
  is_finalized: boolean;
  revision: number;
}

interface AttendanceResponse {
  opportunity_id: number;
  attendance_mode: AttendanceMode;
  service_date: string;
  today: string;
  volunteers: AttendanceRow[];
}

interface Draft {
  attendance_status: Status;
  check_in: string;
  check_out: string;
  remarks: string;
}

const COLORS = {
  maroon: '#6B1720',
  gold: '#C69A3A',
  green: '#15803d',
  red: '#b91c1c',
};

function todayIST() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function timeIST(value: string | null) {
  if (!value) return '';

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

function toDraft(row: AttendanceRow): Draft {
  return {
    attendance_status: row.attendance_status,
    check_in: timeIST(row.check_in_at),
    check_out: timeIST(row.check_out_at),
    remarks: row.remarks ?? '',
  };
}

function toTimestamp(date: string, time: string) {
  return time
    ? `${date}T${time}:00+05:30`
    : null;
}

export default function DailyAttendance({
  opportunity,
}: {
  opportunity: AttendanceOpportunity;
}) {
  const mode = opportunity.attendance_mode;

  const start =
    opportunity.service_start_date.slice(0, 10);

  const end =
    opportunity.service_end_date.slice(0, 10);

  const today = todayIST();

  const [date, setDate] = useState(
    today < start ? start : today > end ? end : today
  );

  const [rows, setRows] =
    useState<AttendanceRow[]>([]);

  const [drafts, setDrafts] =
    useState<Record<number, Draft>>({});

  const [selected, setSelected] =
    useState<number[]>([]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const version = useRef(0);
  const locked = useRef(false);

  const base =
    `/opportunities/${opportunity.id}/daily-attendance`;

  async function load() {
    const current = ++version.current;

    setLoading(true);
    setReady(false);
    setSelected([]);
    setError('');

    try {
      const response =
        await volunteerRequest<AttendanceResponse>(
          `${base}?service_date=${encodeURIComponent(date)}`
        );

      if (current !== version.current) return;

      const data = response.data;

      if (
        !data ||
        Number(data.opportunity_id) !== opportunity.id ||
        data.service_date !== date ||
        data.attendance_mode !== mode ||
        !Array.isArray(data.volunteers)
      ) {
        throw new Error('Invalid daily attendance response');
      }

      setRows(data.volunteers);

      const next: Record<number, Draft> = {};

      for (const row of data.volunteers) {
        next[row.service_date_id] = toDraft(row);
      }

      setDrafts(next);
      setReady(true);
    } catch (err) {
      if (current === version.current) {
        setError(getErrorMessage(err));
        setRows([]);
        setDrafts({});
      }
    } finally {
      if (current === version.current) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    void load();

    return () => {
      version.current++;
    };
  }, [opportunity.id, date, mode]);

  function dirty(row: AttendanceRow) {
    return JSON.stringify(
      drafts[row.service_date_id]
    ) !== JSON.stringify(toDraft(row));
  }

  const hasUnsaved = rows.some(dirty);

  function canEdit(row: AttendanceRow) {
    return (
      ready &&
      !loading &&
      !busy &&
      date <= todayIST() &&
      row.member_status === 'approved' &&
      !row.is_finalized
    );
  }

  function update(
    row: AttendanceRow,
    values: Partial<Draft>
  ) {
    if (!canEdit(row)) return;

    setDrafts(previous => {
      const next = {
        ...previous[row.service_date_id],
        ...values,
      };

      if (next.attendance_status !== 'present') {
        next.check_in = '';
        next.check_out = '';
      }

      return {
        ...previous,
        [row.service_date_id]: next,
      };
    });
  }

  async function mutate(
    action: () => Promise<unknown>,
    message: string
  ) {
    if (locked.current || !ready) return;

    locked.current = true;

    setBusy(true);
    setError('');
    setSuccess('');

    try {
      await action();

      setSuccess(message);

      await load();
    } catch (err) {
      setError(getErrorMessage(err));
      setReady(false);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  async function save(items: AttendanceRow[]) {
    if (!items.length) return;

    if (items.length > 500) {
      setError('Select a maximum of 500 volunteers.');
      return;
    }

    try {
      const records = items.map(row => {
        if (!canEdit(row)) {
          throw new Error(
            `${row.full_name}: attendance cannot be edited`
          );
        }

        const draft = drafts[row.service_date_id];

        if (
          mode === 'detailed' &&
          draft.attendance_status === 'present'
        ) {
          if (draft.check_out && !draft.check_in) {
            throw new Error(
              `${row.full_name}: enter check-in first`
            );
          }

          if (
            draft.check_in &&
            draft.check_out &&
            draft.check_out <= draft.check_in
          ) {
            throw new Error(
              `${row.full_name}: check-out must be after check-in`
            );
          }
        }

        const useTimes =
          mode === 'detailed' &&
          draft.attendance_status === 'present';

        return {
          service_date_id: row.service_date_id,
          revision: row.revision,
          attendance_status: draft.attendance_status,

          check_in_at: useTimes
            ? toTimestamp(date, draft.check_in)
            : null,

          check_out_at: useTimes
            ? toTimestamp(date, draft.check_out)
            : null,

          remarks: draft.remarks.trim() || null,
        };
      });

      const remainingUnsaved = rows.some(
        row =>
          dirty(row) &&
          !items.some(
            item =>
              item.service_date_id === row.service_date_id
          )
      );

      if (remainingUnsaved) {
        setError(
          'Save all modified records together to avoid losing unsaved changes.'
        );
        return;
      }

      await mutate(
        () =>
          volunteerRequest(
            base,
            jsonRequest('POST', { records })
          ),
        'Attendance saved successfully.'
      );
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  function canFinalize(row: AttendanceRow) {
    return (
      canEdit(row) &&
      !dirty(row) &&
      row.revision > 0 &&
      row.attendance_status !== 'not_marked' &&
      (
        mode !== 'detailed' ||
        row.attendance_status !== 'present' ||
        Boolean(row.check_in_at && row.check_out_at)
      )
    );
  }

  async function finalize(items: AttendanceRow[]) {
    if (!items.length || hasUnsaved) return;

    if (items.length > 500) {
      setError('Select a maximum of 500 volunteers.');
      return;
    }

    if (items.some(row => !canFinalize(row))) {
      setError(
        'Save all records and complete required attendance details before finalizing.'
      );
      return;
    }

    if (
      !window.confirm(
        `Finalize attendance for ${items.length} volunteer(s)?`
      )
    ) {
      return;
    }

    await mutate(
      () =>
        volunteerRequest(
          `${base}/finalize`,
          jsonRequest('POST', {
            records: items.map(row => ({
              service_date_id: row.service_date_id,
              revision: row.revision,
            })),
          })
        ),
      'Attendance finalized successfully.'
    );
  }

  async function reopen(row: AttendanceRow) {
    if (
      hasUnsaved ||
      busy ||
      row.member_status !== 'approved'
    ) {
      return;
    }

    const reason = window.prompt(
      'Enter the reason for reopening attendance:'
    );

    if (!reason?.trim()) return;

    if (reason.trim().length > 2000) {
      setError('Reason must not exceed 2000 characters.');
      return;
    }

    await mutate(
      () =>
        volunteerRequest(
          `${base}/${row.service_date_id}/reopen`,
          jsonRequest('PATCH', {
            revision: row.revision,
            reason: reason.trim(),
          })
        ),
      'Attendance reopened successfully.'
    );
  }

  const visible = rows.filter(row => {
    const draft = drafts[row.service_date_id];

    const text = [
      row.full_name,
      row.member_code,
      row.mobile,
      row.group_name,
    ].join(' ').toLowerCase();

    return (
      text.includes(search.toLowerCase().trim()) &&
      (
        !statusFilter ||
        draft?.attendance_status === statusFilter
      )
    );
  });

  const chosen = rows.filter(row =>
    selected.includes(row.service_date_id)
  );

  const editableVisible = visible.filter(canEdit);

  const stats = {
    total: rows.length,
    present: rows.filter(
      row => row.attendance_status === 'present'
    ).length,
    absent: rows.filter(
      row => row.attendance_status === 'absent'
    ).length,
    excused: rows.filter(
      row => row.attendance_status === 'excused'
    ).length,
    finalized: rows.filter(
      row => row.is_finalized
    ).length,
  };

  return (
    <div className="panel">
      <h2 style={{ color: COLORS.maroon }}>
        Daily Volunteer Attendance
      </h2>

      <p>
        {mode === 'detailed'
          ? 'Detailed attendance with actual service hours.'
          : 'Simple date-wise attendance tracking.'}
      </p>

      <fieldset disabled={busy || loading}>
        <div className="grid2">
          <label>
            Service Date (IST)
            <input
              type="date"
              min={start}
              max={end}
              value={date}
              onChange={event => {
                if (
                  hasUnsaved &&
                  !window.confirm('Discard unsaved changes?')
                ) {
                  return;
                }

                setReady(false);
                setSuccess('');
                setDate(event.target.value);
              }}
            />
          </label>

          <label>
            Search Volunteers
            <input
              value={search}
              placeholder="Name, member code, mobile or group"
              onChange={event =>
                setSearch(event.target.value)
              }
            />
          </label>

          <label>
            Attendance Status
            <select
              value={statusFilter}
              onChange={event =>
                setStatusFilter(event.target.value)
              }
            >
              <option value="">All statuses</option>
              <option value="not_marked">Not marked</option>
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="excused">Excused</option>
            </select>
          </label>
        </div>

        <button
          type="button"
          onClick={() => {
            if (
              !hasUnsaved ||
              window.confirm('Discard unsaved changes?')
            ) {
              void load();
            }
          }}
        >
          Refresh Attendance
        </button>
      </fieldset>

      {error && (
        <p style={{ color: COLORS.red }}>
          {error}
        </p>
      )}

      {success && (
        <p style={{ color: COLORS.green }}>
          {success}
        </p>
      )}

      {loading && <p>Loading attendance...</p>}

      {date > today && (
        <p>Future service dates are read-only.</p>
      )}

      {!loading && ready && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(110px, 1fr))',
              gap: 12,
              margin: '20px 0',
            }}
          >
            {Object.entries(stats).map(([name, count]) => (
              <div
                key={name}
                style={{
                  border: '1px solid #e8dfcf',
                  borderRadius: 10,
                  padding: 14,
                  background: '#FFFDF8',
                }}
              >
                <small style={{ textTransform: 'capitalize' }}>
                  {name}
                </small>
                <h2 style={{ color: COLORS.maroon, margin: 0 }}>
                  {count}
                </h2>
              </div>
            ))}
          </div>

          <fieldset disabled={busy}>
            <div
              className="actions"
              style={{ flexWrap: 'wrap', gap: 8 }}
            >
              <button
                type="button"
                onClick={() =>
                  setSelected(
                    editableVisible
                      .slice(0, 500)
                      .map(row => row.service_date_id)
                  )
                }
              >
                Select Visible (max 500)
              </button>

              <button
                type="button"
                onClick={() => setSelected([])}
              >
                Clear Selection
              </button>

              <button
                type="button"
                disabled={!chosen.length}
                onClick={() =>
                  chosen.forEach(row =>
                    update(row, {
                      attendance_status: 'present',
                    })
                  )
                }
              >
                Mark Selected Present
              </button>

              <button
                type="button"
                disabled={!chosen.length}
                onClick={() =>
                  chosen.forEach(row =>
                    update(row, {
                      attendance_status: 'absent',
                    })
                  )
                }
              >
                Mark Selected Absent
              </button>

              <button
                className="primary"
                type="button"
                disabled={!hasUnsaved}
                onClick={() =>
                  void save(rows.filter(dirty))
                }
              >
                Save All Changes
              </button>

              <button
                type="button"
                disabled={
                  !chosen.length ||
                  hasUnsaved ||
                  chosen.some(row => !canFinalize(row))
                }
                onClick={() => void finalize(chosen)}
              >
                Finalize Selected
              </button>
            </div>

            <p>
              {selected.length} selected
              {hasUnsaved && ' · Unsaved changes'}
            </p>

            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Select</th>
                    <th>Volunteer</th>
                    <th>Attendance</th>

                    {mode === 'detailed' && (
                      <>
                        <th>Check-in (IST)</th>
                        <th>Check-out (IST)</th>
                        <th>Actual Hours</th>
                      </>
                    )}

                    <th>Remarks</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {visible.map(row => {
                    const draft =
                      drafts[row.service_date_id];

                    if (!draft) return null;

                    const editable = canEdit(row);

                    return (
                      <tr key={row.service_date_id}>
                        <td>
                          <input
                            type="checkbox"
                            style={{ width: 'auto' }}
                            disabled={!editable}
                            checked={selected.includes(
                              row.service_date_id
                            )}
                            onChange={event => {
                              const checked =
                                event.target.checked;

                              setSelected(previous =>
                                checked
                                  ? previous.length >= 500
                                    ? previous
                                    : [
                                        ...previous,
                                        row.service_date_id,
                                      ]
                                  : previous.filter(
                                      id =>
                                        id !== row.service_date_id
                                    )
                              );
                            }}
                          />
                        </td>

                        <td>
                          <strong>{row.full_name}</strong>
                          <div><small>{row.member_code}</small></div>
                          <div><small>{row.group_name}</small></div>
                          <div><small>{row.mobile}</small></div>
                        </td>

                        <td>
                          <select
                            disabled={!editable}
                            value={draft.attendance_status}
                            onChange={event =>
                              update(row, {
                                attendance_status:
                                  event.target.value as Status,
                              })
                            }
                          >
                            <option value="not_marked">
                              Not marked
                            </option>
                            <option value="present">
                              Present
                            </option>
                            <option value="absent">
                              Absent
                            </option>
                            <option value="excused">
                              Excused
                            </option>
                          </select>
                        </td>

                        {mode === 'detailed' && (
                          <>
                            <td>
                              <input
                                type="time"
                                value={draft.check_in}
                                disabled={
                                  !editable ||
                                  draft.attendance_status !==
                                    'present'
                                }
                                onChange={event =>
                                  update(row, {
                                    check_in: event.target.value,
                                  })
                                }
                              />
                            </td>

                            <td>
                              <input
                                type="time"
                                value={draft.check_out}
                                disabled={
                                  !editable ||
                                  draft.attendance_status !==
                                    'present'
                                }
                                onChange={event =>
                                  update(row, {
                                    check_out: event.target.value,
                                  })
                                }
                              />
                            </td>

                            <td>
                              {dirty(row)
                                ? 'Save to calculate'
                                : row.total_service_hours == null
                                  ? '—'
                                  : Number(
                                      row.total_service_hours
                                    ).toFixed(2)}
                            </td>
                          </>
                        )}

                        <td>
                          <input
                            maxLength={2000}
                            value={draft.remarks}
                            disabled={!editable}
                            onChange={event =>
                              update(row, {
                                remarks: event.target.value,
                              })
                            }
                          />
                        </td>

                        <td>
                          {row.is_finalized ? (
                            <span style={{ color: COLORS.green }}>
                              Finalized
                            </span>
                          ) : dirty(row) ? (
                            <span>Unsaved</span>
                          ) : (
                            <span>Open</span>
                          )}
                        </td>

                        <td>
                          {row.is_finalized ? (
                            <button
                              type="button"
                              disabled={
                                hasUnsaved ||
                                row.member_status !== 'approved'
                              }
                              onClick={() => void reopen(row)}
                            >
                              Reopen
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                disabled={!editable || !dirty(row)}
                                onClick={() => void save([row])}
                              >
                                Save
                              </button>

                              <button
                                type="button"
                                disabled={
                                  hasUnsaved ||
                                  !canFinalize(row)
                                }
                                onClick={() => void finalize([row])}
                              >
                                Finalize
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {!visible.length && (
                    <tr>
                      <td colSpan={mode === 'detailed' ? 9 : 6}>
                        No volunteers found for this date.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </fieldset>
        </>
      )}
    </div>
  );
}