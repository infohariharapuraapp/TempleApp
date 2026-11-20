import {
  beginVolunteerOperation,
} from '../../lib/volunteerOperationGuard';
import { useEffect, useRef, useState } from 'react';
import {
  captureAttendanceDrafts,
  reconcileAttendanceDrafts,
  type AttendanceDraftSnapshot,
  type AttendanceDraftConflict,
} from '../../lib/volunteerAttendanceDrafts';
import {
  useVolunteerUnsavedChanges,
} from '../../lib/volunteerUnsavedChangesGuard';

import {
  volunteerRequest,
  jsonRequest,
  getErrorMessage,
  formatServiceDate,
  formatIST,
  isFutureShift,
  type VolunteerOpportunity,
} from '../../lib/volunteerApi';

interface Props {
  opportunities: VolunteerOpportunity[];
  selectedProgrammeId: string;
}

type AttendanceStatus =
  | 'not_marked'
  | 'present'
  | 'absent'
  | 'excused';

interface AttendanceRecord {
  assignment_id: number;
  assignment_status: string;
  member_id: number;
  full_name: string;
  mobile: string;
  member_code: string;
  duty_name: string;
  shift_id: number;
  shift_name: string;
  service_date: string;
  start_time: string;
  end_time: string;
  attendance_status: AttendanceStatus;
  is_finalized: boolean;
  remarks: string | null;
  marked_by_name: string | null;
  marked_at: string | null;
  finalized_at: string | null;
}

interface Draft {
  attendance_status: AttendanceStatus;
  remarks: string;
}

function matchesAttendanceValues(
  record: AttendanceRecord,
  draft: Draft
): boolean {
  return (
    record.attendance_status === draft.attendance_status &&
    (record.remarks || '') === draft.remarks.trim()
  );
}
function attendanceBaseline(
  record: AttendanceRecord
): string {
  return JSON.stringify([
    record.assignment_id,
    record.member_id,
    record.shift_id,
    record.service_date,
    record.start_time,
    record.end_time,
    record.assignment_status,
    record.attendance_status,
    record.remarks || '',
    record.is_finalized,
    record.marked_at,
    record.finalized_at,
  ]);
}
export default function Attendance({
  opportunities,
  selectedProgrammeId,
}: Props) {
  const opportunity = opportunities.find(
    item => String(item.id) === selectedProgrammeId
  );
  const opportunityId = opportunity
    ? selectedProgrammeId
    : '';

  const [records, setRecords] =
    useState<AttendanceRecord[]>([]);

  const [drafts, setDrafts] =
    useState<Record<number, Draft>>({});

  const [selected, setSelected] =
    useState<number[]>([]);

  const [search, setSearch] = useState('');
  const [shiftFilter, setShiftFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [draftConflicts, setDraftConflicts] =
    useState<AttendanceDraftConflict<Draft>[]>([]);
  const pendingRefreshDrafts =
    useRef<AttendanceDraftSnapshot<Draft>[] | null>(null);
  const [refreshRequired, setRefreshRequired] =
    useState(false);
  const uncertainOutcome = useRef(false);
  const [mutationUncertain, setMutationUncertain] =
    useState(false);
  const mutationLock = useRef(false);
  const loadVersion = useRef(0);

  const base =
    `/opportunities/${opportunityId}/attendance`;

  async function load(
    snapshots: AttendanceDraftSnapshot<Draft>[] = []
  ) {
    const version = ++loadVersion.current;

    setLoading(true);
    setReady(false);
    setSelected([]);
    setError('');

    try {
      if (!opportunityId) {
        setRecords([]);
        setDrafts({});
        return;
      }

      const response =
        await volunteerRequest<AttendanceRecord[]>(base);

      if (version !== loadVersion.current) {
        return;
      }

      if (!Array.isArray(response.data)) {
        throw new Error('Invalid attendance response');
      }

      setRecords(response.data);

      const result = reconcileAttendanceDrafts(
        response.data,
        snapshots,
        item => item.assignment_id,
        item => ({
          attendance_status: item.attendance_status,
          remarks: item.remarks || '',
        }),
        attendanceBaseline,
        canEdit,
        uncertainOutcome.current
          ? matchesAttendanceValues
          : undefined
      );
      if (uncertainOutcome.current) {
        setSuccess(
          'Server records refreshed. ' +
          `${result.matchedCount} draft(s) match server values. ` +
          `${result.restoredCount} unsaved draft(s) restored. ` +
          `${result.conflicts.length} new conflict(s) require review.`
        );
      }
      setDrafts(result.drafts);
      setDraftConflicts(previous => {
        const combined = new Map(
          previous.map(conflict => [
            conflict.id,
            conflict,
          ])
        );
        for (const conflict of result.conflicts) {
          combined.set(conflict.id, conflict);
        }
        return Array.from(combined.values());
      });
      pendingRefreshDrafts.current = null;
      uncertainOutcome.current = false;
      setMutationUncertain(false);
      setRefreshRequired(false);
      setReady(true);
    } catch (error) {
      if (version === loadVersion.current) {
        setError(
          pendingRefreshDrafts.current !== null
            ? (
                uncertainOutcome.current
                  ? 'The previous operation remains unconfirmed. Refresh again before making changes. '
                  : 'Attendance was saved, but refreshing the server records failed. Refresh again to recover the remaining drafts. '
              ) +
              getErrorMessage(error)
            : getErrorMessage(error)
        );
        setReady(false);
      }
    } finally {
      if (version === loadVersion.current) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    pendingRefreshDrafts.current = null;
    uncertainOutcome.current = false;
    setMutationUncertain(false);
    setRefreshRequired(false);
    setDraftConflicts([]);
    setRecords([]);
    setDrafts({});
    setSelected([]);
    setShiftFilter('');
    setStatusFilter('');
    setSuccess('');

    void load();

    return () => {
      loadVersion.current++;
    };
  }, [opportunityId]);

  function hasStarted(record: AttendanceRecord) {
    return !isFutureShift(
      record.service_date,
      record.start_time
    );
  }

  function hasEnded(record: AttendanceRecord) {
    return !isFutureShift(
      record.service_date,
      record.end_time
    );
  }

  function canEdit(record: AttendanceRecord) {
    return (
      !draftConflicts.some(
        conflict => conflict.id === record.assignment_id
      ) &&
      !record.is_finalized &&
      record.assignment_status !== 'completed' &&
      hasStarted(record)
    );
  }

  function isDirty(record: AttendanceRecord) {
    const draft = drafts[record.assignment_id];

    return Boolean(
      draft && (
        draft.attendance_status !== record.attendance_status ||
        draft.remarks !== (record.remarks || '')
      )
    );
  }

  const dirtyCount = records.filter(isDirty).length;
  useVolunteerUnsavedChanges(
    'Duty and shift attendance',
    dirtyCount > 0 ||
      draftConflicts.length > 0 ||
      refreshRequired
  );

  function canFinalize(record: AttendanceRecord) {
    return (
      canEdit(record) &&
      hasEnded(record) &&
      record.attendance_status !== 'not_marked' &&
      !isDirty(record)
    );
  }

  function updateDraft(
    id: number,
    changes: Partial<Draft>
  ) {
    setDrafts(current => ({
      ...current,
      [id]: {
        ...current[id],
        ...changes,
      },
    }));
  }

  function toggleSelection(id: number) {
    setSelected(current =>
      current.includes(id)
        ? current.filter(item => item !== id)
        : current.length < 500
          ? [...current, id]
          : current
    );
  }

  const shifts = Array.from(
    new Map(
      records.map(record => [
        record.shift_id,
        {
          id: record.shift_id,
          label:
            `${formatServiceDate(record.service_date)} — ${record.shift_name}`,
        },
      ])
    ).values()
  );

  const filteredRecords = records.filter(record => {
    const matchesSearch = [
      record.full_name,
      record.mobile,
      record.member_code,
      record.duty_name,
    ].join(' ').toLowerCase().includes(
      search.toLowerCase()
    );

    return (
      matchesSearch &&
      (!shiftFilter ||
        record.shift_id === Number(shiftFilter)) &&
      (!statusFilter ||
        record.attendance_status === statusFilter)
    );
  });

  const selectedRecords = filteredRecords.filter(record =>
    selected.includes(record.assignment_id) &&
    canEdit(record)
  );
  const visibleSelectedIds = selectedRecords.map(
    record => record.assignment_id
  );
  const selectionKey = visibleSelectedIds.join(',');
  useEffect(() => {
    setSelected(previous => {
      const next = previous.filter(id =>
        visibleSelectedIds.includes(id)
      );
      return next.length === previous.length
        ? previous
        : next;
    });
  }, [selectionKey]);

  async function mutate(
    endpoint: string,
    method: string,
    body: unknown,
    fallbackMessage: string,
    snapshots: AttendanceDraftSnapshot<Draft>[] = []
  ) {
    if (
      mutationLock.current ||
      busy ||
      loading ||
      !ready ||
      refreshRequired
    ) {
      return;
    }

    const allSnapshots = captureAttendanceDrafts(
      records,
      drafts,
      new Set<number>(),
      item => item.assignment_id,
      isDirty,
      attendanceBaseline
    );
    const releaseOperation = beginVolunteerOperation('Shift attendance');
    mutationLock.current = true;
    setBusy(true);
    setSuccess('');
    setError('');

    try {
      const response = await volunteerRequest(
        endpoint,
        jsonRequest(method, body)
      );

      setSuccess(
        response.message || fallbackMessage
      );

      uncertainOutcome.current = false;
      setMutationUncertain(false);
      pendingRefreshDrafts.current = snapshots;
      setRefreshRequired(true);
      await load(snapshots);
    } catch (error) {
      pendingRefreshDrafts.current = allSnapshots;
      uncertainOutcome.current = true;
      setMutationUncertain(true);
      setRefreshRequired(true);
      setReady(false);
      setSelected([]);
      setError(
        'The attendance operation could not be confirmed. ' +
        'Refresh server records before retrying. ' +
        getErrorMessage(error)
      );
    } finally {
      mutationLock.current = false;
      releaseOperation();
      setBusy(false);
    }
  }

  async function saveAttendance(
    items: AttendanceRecord[]
  ) {
    if (
      !items.length ||
      items.length > 500 ||
      !items.every(canEdit)
    ) {
      setError('Select eligible attendance records.');
      return;
    }

    const ids = new Set(
      items.map(item => item.assignment_id)
    );

    const snapshots = captureAttendanceDrafts(
      records,
      drafts,
      ids,
      item => item.assignment_id,
      isDirty,
      attendanceBaseline
    );

    await mutate(
      base,
      'POST',
      {
        records: items.map(item => ({
          assignment_id: item.assignment_id,
          attendance_status:
            drafts[item.assignment_id].attendance_status,
          remarks:
            drafts[item.assignment_id].remarks.trim() || null,
        })),
      },
      'Attendance saved successfully',
      snapshots
    );
  }

  async function finalizeAttendance(
    items: AttendanceRecord[]
  ) {
    if (
      !items.length ||
      items.length > 500 ||
      !items.every(canFinalize)
    ) {
      setError(
        'Attendance must be saved and the shift must have ended before finalization.'
      );
      return;
    }

    if (dirtyCount || draftConflicts.length) {
      setError('Save or discard unsaved changes first.');
      return;
    }

    if (!window.confirm(
      `Finalize ${items.length} attendance record(s)? Finalized records require reopening before editing.`
    )) {
      return;
    }

    await mutate(
      `${base}/finalize`,
      'POST',
      {
        assignment_ids: items.map(
          item => item.assignment_id
        ),
      },
      'Attendance finalized successfully'
    );
  }

  async function reopenAttendance(
    item: AttendanceRecord
  ) {
    if (dirtyCount || draftConflicts.length) {
      setError('Save or discard unsaved changes first.');
      return;
    }

    const reason = window.prompt(
      `Enter attendance correction reason for ${item.full_name}:`
    );

    if (reason === null) return;

    if (!reason.trim() || reason.trim().length > 2000) {
      setError(
        'Enter a correction reason within 2000 characters.'
      );
      return;
    }

    await mutate(
      `${base}/${item.assignment_id}/reopen`,
      'PATCH',
      { reason: reason.trim() },
      'Attendance reopened'
    );
  }

  function applyBulkStatus(status: AttendanceStatus) {
    if (
      mutationLock.current ||
      busy ||
      loading ||
      !ready ||
      refreshRequired
    ) return;
    if (
      !selectedRecords.length ||
      !selectedRecords.every(canEdit)
    ) {
      return;
    }

    setDrafts(current => {
      const next = { ...current };

      selectedRecords.forEach(record => {
        next[record.assignment_id] = {
          ...next[record.assignment_id],
          attendance_status: status,
        };
      });

      return next;
    });
  }

  async function refreshAttendance() {
    if (
      mutationLock.current ||
      busy ||
      loading ||
      !opportunityId
    ) return;
    const snapshots = pendingRefreshDrafts.current ?? captureAttendanceDrafts(
      records,
      drafts,
      new Set<number>(),
      item => item.assignment_id,
      isDirty,
      attendanceBaseline
    );
    setSuccess('');
    await load(snapshots);
  }

  const disabled = loading || busy || !ready || refreshRequired;

  const stats = [
    ['Total Assignments', records.length],
    ['Present', records.filter(
      item => item.attendance_status === 'present'
    ).length],
    ['Absent', records.filter(
      item => item.attendance_status === 'absent'
    ).length],
    ['Excused', records.filter(
      item => item.attendance_status === 'excused'
    ).length],
    ['Not Marked', records.filter(
      item => item.attendance_status === 'not_marked'
    ).length],
    ['Finalized', records.filter(
      item => item.is_finalized
    ).length],
  ];

  return (
    <section>
      <div className="panel">
        <h2>Volunteer Attendance</h2>

        <p>
          Record volunteer attendance and finalize
          completed service shifts.
        </p>

        <p style={{
          color: '#6B1720',
          fontWeight: 700,
        }}>
          {opportunity?.title ||
            'No programme selected'}
        </p>

        <button
          type="button"
          disabled={!opportunityId || busy || loading}
          onClick={() => void refreshAttendance()}
        >
          {loading ? 'Loading...' : 'Refresh Attendance'}
        </button>
      </div>

      {refreshRequired && !loading && (
        <div
          className="panel"
          role="alert"
          style={{
            background: '#FFF8E8',
            border: '1px solid #E5C98C',
            color: '#795318',
            marginBottom: 16,
          }}
        >
          <strong>
            {mutationUncertain
              ? 'Attendance outcome unconfirmed'
              : 'Attendance saved — refresh required'}
          </strong>
          <p>
            {mutationUncertain
              ? 'The previous operation may or may not have reached the server. Refresh to inspect the latest records and recover compatible drafts.'
              : 'The server accepted your save. Refresh attendance to verify the latest records and restore compatible remaining drafts.'}
          </p>
          <p>
            Do not submit the same attendance again.
            Editing remains disabled until refresh succeeds.
          </p>
          <button
            type="button"
            disabled={busy || loading}
            onClick={() => void refreshAttendance()}
          >
            Retry Refresh
          </button>
        </div>
      )}
      {draftConflicts.length > 0 && (
        <div
          className="panel"
          role="alert"
          style={{
            background: '#FFF8E8',
            border: '1px solid #E5C98C',
            color: '#795318',
          }}
        >
          <h3>Attendance changes require review</h3>
          <p>
            Some attendance records changed or became
            unavailable on the server. Your original
            unsaved values have been retained below.
          </p>
          {draftConflicts.map(conflict => (
            <div
              key={conflict.id}
              style={{
                padding: 12,
                marginBottom: 10,
                border: '1px solid #E5C98C',
                borderRadius: 8,
              }}
            >
              <strong>
                {records.find(
                  record =>
                    record.assignment_id === conflict.id
                )?.full_name ||
                  `Assignment #${conflict.id}`}
              </strong>
              <p>
                Reason: {
                  conflict.reason === 'record_missing'
                    ? 'Record no longer available'
                    : conflict.reason === 'record_locked'
                      ? 'Record is locked'
                      : 'Server record changed'
                }
              </p>
              <p>
                Unsaved attendance:
                {' '}{conflict.draft.attendance_status}
              </p>
              <p style={{ whiteSpace: 'pre-wrap' }}>
                Unsaved remarks:
                {' '}{conflict.draft.remarks || 'None'}
              </p>
              <button
                type="button"
                disabled={busy || loading || !ready || refreshRequired}
                onClick={() => {
                  if (
                    mutationLock.current ||
                    busy ||
                    loading ||
                    !ready ||
                    refreshRequired
                  ) return;
                  if (!window.confirm(
                    'Discard this unsaved draft and keep the server record?'
                  )) return;
                  setDraftConflicts(previous =>
                    previous.filter(
                      item => item.id !== conflict.id
                    )
                  );
                }}
              >
                Discard Draft / Keep Server Record
              </button>
            </div>
          ))}
        </div>
      )}
      {dirtyCount > 0 && (
        <div
          role="status"
          aria-live="polite"
          style={{
            padding: '12px 16px',
            marginBottom: 16,
            border: '1px solid #e5c98c',
            borderRadius: 10,
            background: '#FFF8E8',
            color: '#795318',
          }}
        >
          <strong>
            Unsaved attendance changes
          </strong>
          <div style={{
            fontSize: 13,
            marginTop: 4,
          }}>
            {dirtyCount} modified record(s).
            Refresh preserves compatible unsaved drafts.
            Save your changes before leaving this workspace.
          </div>
        </div>
      )}
      {error && (
        <div className="panel" role="alert"
          style={{ color: '#b91c1c' }}>
          {error}
        </div>
      )}

      {success && (
        <div className="panel"
          style={{ color: '#15803d' }}>
          {success}
        </div>
      )}

      {opportunityId && !ready && !loading && (
        <div className="panel">
          Refresh attendance before making further changes.
        </div>
      )}

      {opportunityId && ready && (
        <>
          <div className="panel">
            <h3>Attendance Summary</h3>

            <div style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(130px, 1fr))',
              gap: 12,
            }}>
              {stats.map(([label, value]) => (
                <div key={label} style={{
                  padding: 16,
                  borderRadius: 8,
                  border: '1px solid #ddd',
                }}>
                  <small>{label}</small>
                  <h2>{value}</h2>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <h3>Attendance Records</h3>

            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              marginBottom: 16,
            }}>
              <input
                placeholder="Search volunteers or duties"
                value={search}
                onChange={event => {
                  setSearch(event.target.value);
                  setSelected([]);
                }}
              />

              <select
                value={shiftFilter}
                disabled={busy}
                onChange={event => {
                  setShiftFilter(event.target.value);
                  setSelected([]);
                }}
              >
                <option value="">All Shifts</option>

                {shifts.map(shift => (
                  <option key={shift.id} value={shift.id}>
                    {shift.label}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                disabled={busy}
                onChange={event => {
                  setStatusFilter(event.target.value);
                  setSelected([]);
                }}
              >
                <option value="">All Attendance Statuses</option>
                <option value="not_marked">Not Marked</option>
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="excused">Excused</option>
              </select>
            </div>

            <p>
              Selected: {selectedRecords.length}
              {' | Unsaved changes: '}{dirtyCount}
            </p>

            <fieldset disabled={disabled}
              style={{ border: 0, padding: 0 }}>

              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
                marginBottom: 16,
              }}>
                <button
                  type="button"
                  onClick={() =>
                    setSelected(
                      filteredRecords
                        .filter(canEdit)
                        .slice(0, 500)
                        .map(item => item.assignment_id)
                    )
                  }
                >
                  Select Editable
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setSelected(
                      filteredRecords
                        .filter(canFinalize)
                        .slice(0, 500)
                        .map(item => item.assignment_id)
                    )
                  }
                >
                  Select Finalizable
                </button>

                <button
                  type="button"
                  onClick={() => setSelected([])}
                >
                  Clear Selection
                </button>

                {(
                  ['present', 'absent', 'excused'] as AttendanceStatus[]
                ).map(status => (
                  <button
                    key={status}
                    type="button"
                    disabled={!selectedRecords.length}
                    onClick={() => applyBulkStatus(status)}
                  >
                    Mark {status}
                  </button>
                ))}

                <button
                  type="button"
                  className="primary"
                  disabled={
                    !selectedRecords.length ||
                    !selectedRecords.every(canEdit)
                  }
                  onClick={() =>
                    void saveAttendance(selectedRecords)
                  }
                >
                  Save Selected
                </button>

                <button
                  type="button"
                  disabled={
                    !selectedRecords.length ||
                    !selectedRecords.every(canFinalize) ||
                    dirtyCount > 0 ||
                    draftConflicts.length > 0 ||
                    refreshRequired
                  }
                  onClick={() =>
                    void finalizeAttendance(selectedRecords)
                  }
                >
                  Finalize Selected
                </button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Select</th>
                      <th>Volunteer</th>
                      <th>Duty & Shift</th>
                      <th>Attendance</th>
                      <th>Remarks</th>
                      <th>State</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredRecords.map(item => {
                      const draft = drafts[item.assignment_id];

                      if (!draft) return null;

                      return (
                        <tr key={item.assignment_id}>
                          <td>
                            <input
                              type="checkbox"
                              disabled={!canEdit(item)}
                              checked={selected.includes(
                                item.assignment_id
                              )}
                              onChange={() =>
                                toggleSelection(item.assignment_id)
                              }
                            />
                          </td>

                          <td>
                            <strong>{item.full_name}</strong>
                            <div>{item.member_code}</div>
                            <small>{item.mobile}</small>
                          </td>

                          <td>
                            <strong>{item.duty_name}</strong>

                            <div>{item.shift_name}</div>

                            <div>
                              {formatServiceDate(item.service_date)}
                            </div>

                            <small>
                              {item.start_time.slice(0, 5)}
                              {' - '}
                              {item.end_time.slice(0, 5)} IST
                            </small>
                          </td>

                          <td>
                            <select
                              value={draft.attendance_status}
                              disabled={!canEdit(item)}
                              onChange={event =>
                                updateDraft(
                                  item.assignment_id,
                                  {
                                    attendance_status:
                                      event.target.value as AttendanceStatus,
                                  }
                                )
                              }
                            >
                              <option value="not_marked">
                                Not Marked
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

                          <td>
                            <textarea
                              maxLength={5000}
                              value={draft.remarks}
                              disabled={!canEdit(item)}
                              onChange={event =>
                                updateDraft(
                                  item.assignment_id,
                                  { remarks: event.target.value }
                                )
                              }
                            />
                          </td>

                          <td>
                            {item.is_finalized ? (
                              <span style={{ color: '#15803d' }}>
                                Finalized
                              </span>
                            ) : isDirty(item) ? (
                              <span style={{ color: '#b45309' }}>
                                Unsaved
                              </span>
                            ) : !hasStarted(item) ? (
                              <span>Upcoming Shift</span>
                            ) : (
                              <span>Open</span>
                            )}

                            {item.marked_by_name && (
                              <div>
                                <small>
                                  By {item.marked_by_name}
                                </small>
                              </div>
                            )}

                            {item.finalized_at && (
                              <small>
                                {formatIST(item.finalized_at)}
                              </small>
                            )}
                          </td>

                          <td>
                            {item.is_finalized ? (
                              <button
                                type="button"
                                disabled={dirtyCount > 0 || draftConflicts.length > 0 || refreshRequired}
                                onClick={() =>
                                  void reopenAttendance(item)
                                }
                              >
                                Reopen
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  disabled={!canEdit(item)}
                                  onClick={() =>
                                    void saveAttendance([item])
                                  }
                                >
                                  Save
                                </button>

                                <button
                                  type="button"
                                  disabled={
                                    !canFinalize(item) ||
                                    dirtyCount > 0 ||
                                    draftConflicts.length > 0 ||
                                    refreshRequired
                                  }
                                  onClick={() =>
                                    void finalizeAttendance([item])
                                  }
                                >
                                  Finalize
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                    {!filteredRecords.length && (
                      <tr>
                        <td colSpan={7}>
                          No attendance records found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </fieldset>
          </div>
        </>
      )}
    </section>
  );
}