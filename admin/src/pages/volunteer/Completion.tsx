import {
  beginVolunteerOperation,
} from '../../lib/volunteerOperationGuard';
import { useEffect, useRef, useState } from 'react';

import {
  volunteerRequest,
  jsonRequest,
  getErrorMessage,
  formatServiceDate,
  formatIST,
  type VolunteerOpportunity,
} from '../../lib/volunteerApi';

interface Props {
  opportunities: VolunteerOpportunity[];
  selectedProgrammeId: string;
}

type AttendanceMode =
  | 'legacy'
  | 'simple'
  | 'detailed'
  | 'none';
interface Member {
  attendance_mode?: AttendanceMode;
  total_selected_dates?: number;
  finalized_dates?: number | null;
  remaining_dates?: number;
  member_id: number;
  full_name: string;
  member_code: string;
  group_name: string | null;
  registration_code: string;
  member_status: string;
  registration_status: string;
  total_assignments: number;
  completed_assignments: number;
  present_count: number;
  absent_count: number;
  excused_count: number;
  unfinalized_count: number;
  remaining_assignments: number;
  total_service_days: number | null;
  total_service_hours: number | null;
  attendance_percentage: number | null;
  service_start_date: string | null;
  service_end_date: string | null;
  certificate_status: string | null;
  can_complete: boolean;
  completion_reasons: string[];
}

interface Assignment {
  assignment_id: number;
  assignment_status: string;
  duty_name: string;
  service_date: string;
  shift_name: string;
  start_time: string;
  end_time: string;
  attendance_status: string;
  is_finalized: boolean;
  check_in_at: string | null;
  check_out_at: string | null;
  remarks: string | null;
  service_hours: number | string;
}

interface Details extends Member {
  daily_attendance?: {
    service_date_id: number;
    service_date: string;
    attendance_status: string;
    is_finalized: boolean;
    check_in_at: string | null;
    check_out_at: string | null;
    remarks: string | null;
    service_hours: number | string | null;
  }[];
  assignments: Assignment[];
}

function ServiceInformation({ item }: { item: Member }) {
  const mode = item.attendance_mode ?? 'legacy';
  if (mode === 'none') {
    return (
      <span>Manually verified service</span>
    );
  }
  return (
    <>
      <div>
        Service days: {item.total_service_days ?? 'Not available'}
      </div>
      {(mode === 'legacy' || mode === 'detailed') && (
        <div>
          {mode === 'detailed' ? 'Actual hours' : 'Scheduled hours'}:
          {' '}
          {item.total_service_hours ?? 'Not available'}
        </div>
      )}
    </>
  );
}
function ServiceProgress({ item }: { item: Member }) {
  const mode = item.attendance_mode ?? 'legacy';
  if (mode === 'legacy') {
    return (
      <>
        {item.completed_assignments} / {item.total_assignments}
        <div>Remaining: {item.remaining_assignments}</div>
      </>
    );
  }
  return (
    <>
      <div>
        Selected dates: {item.total_selected_dates ?? 0}
      </div>
      {mode !== 'none' && (
        <div>
          Finalized: {item.finalized_dates ?? 0}
          {' / '}
          {item.total_selected_dates ?? 0}
        </div>
      )}
      <div>
        Future dates: {item.remaining_dates ?? 0}
      </div>
      {mode === 'none' && (
        <small>Manual completion</small>
      )}
    </>
  );
}
function AttendanceInformation({ item }: { item: Member }) {
  if (item.attendance_mode === 'none') {
    return <span>Attendance not required</span>;
  }
  return (
    <>
      <strong>
        {item.attendance_percentage == null
          ? 'Pending'
          : String(item.attendance_percentage) + '%'}
      </strong>
      <div>Present: {item.present_count ?? 0}</div>
      <div>Absent: {item.absent_count ?? 0}</div>
      <div>Excused: {item.excused_count ?? 0}</div>
      <small>
        Unfinalized: {item.unfinalized_count ?? 0}
      </small>
    </>
  );
}
export default function Completion({
  opportunities,
  selectedProgrammeId,
}: Props) {
  const selectedProgramme = opportunities.find(
    item => String(item.id) === selectedProgrammeId
  );
  const opportunityId = selectedProgramme
    ? String(selectedProgramme.id)
    : '';

  const [working, setWorking] = useState(false);

  return (
    <section>
      <div className="panel">
        <h2>Volunteer Service Completion</h2>

        <p>
          Review finalized attendance and confirm
          successful volunteer service.
        </p>

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
            {selectedProgramme?.title ||
              'Choose a programme from the workspace above.'}
          </div>
        </div>
      </div>

      {opportunityId && (
        <CompletionManager
          key={opportunityId}
          opportunityId={opportunityId}
          onWorking={setWorking}
        />
      )}
    </section>
  );
}

function CompletionManager({
  opportunityId,
  onWorking,
}: {
  opportunityId: string;
  onWorking: (value: boolean) => void;
}) {
  const base =
    `/opportunities/${opportunityId}/completion`;

  const [items, setItems] =
    useState<Member[]>([]);

  const [selected, setSelected] =
    useState<number[]>([]);

  const [details, setDetails] =
    useState<Details | null>(null);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const mounted = useRef(true);
  const lock = useRef(false);
  const version = useRef(0);

  async function load() {
    const current = ++version.current;

    setLoading(true);
    setReady(false);
    setError('');
    setSelected([]);
    setDetails(null);

    try {
      const response =
        await volunteerRequest<Member[]>(base);

      if (
        !mounted.current ||
        current !== version.current
      ) return;

      if (!Array.isArray(response.data)) {
        throw new Error('Invalid server response');
      }

      setItems(response.data);
      setReady(true);
    } catch (error) {
      if (
        mounted.current &&
        current === version.current
      ) {
        setError(getErrorMessage(error));
      }
    } finally {
      if (
        mounted.current &&
        current === version.current
      ) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    mounted.current = true;
    void load();

    return () => {
      mounted.current = false;
      version.current++;
    };
  }, []);

  const disabled = loading || busy || !ready;

  const eligible = items.filter(
    item => item.can_complete
  );

  const completed = items.filter(
    item => item.member_status === 'completed'
  );

  const pending = items.filter(
    item =>
      !item.can_complete &&
      item.member_status !== 'completed'
  );

  const filtered = items.filter(item => {
    const matchesSearch = [
      item.full_name,
      item.member_code,
      item.registration_code,
      item.group_name || '',
    ].join(' ').toLowerCase().includes(
      search.toLowerCase()
    );

    const status =
      item.member_status === 'completed'
        ? 'completed'
        : item.can_complete
          ? 'eligible'
          : 'pending';

    return matchesSearch &&
      (!filter || filter === status);
  });

  function toggleMember(id: number) {
    setSelected(current =>
      current.includes(id)
        ? current.filter(item => item !== id)
        : current.length < 500
          ? [...current, id]
          : current
    );
  }

  async function mutate(
    endpoint: string,
    method: string,
    body: unknown
  ) {
    if (lock.current || disabled) return;

    const releaseOperation = beginVolunteerOperation('Service completion');
    lock.current = true;
    setBusy(true);
    onWorking(true);
    setError('');
    setSuccess('');

    try {
      const response = await volunteerRequest(
        endpoint,
        jsonRequest(method, body)
      );

      if (!mounted.current) return;

      setSuccess(
        response.message || 'Updated successfully'
      );

      await load();
    } catch (error) {
      if (mounted.current) {
        setError(getErrorMessage(error));
        setReady(false);
      }
    } finally {
      lock.current = false;
      releaseOperation();

      if (mounted.current) {
        setBusy(false);
        onWorking(false);
      }
    }
  }

  async function complete(ids: number[]) {
    if (
      disabled ||
      !ids.length ||
      ids.length > 500 ||
      !ids.every(id =>
        eligible.some(item =>
          item.member_id === id
        )
      )
    ) return;

    if (!window.confirm(
      eligible.some(item =>
        ids.includes(item.member_id) &&
        item.attendance_mode === 'none'
      )
        ? 'Confirm that the selected volunteers have successfully completed their service, including manual verification where attendance is disabled?'
        : 'Confirm service completion for ' + ids.length + ' volunteer(s)?'
    )) return;

    await mutate(base, 'POST', {
      member_ids: ids,
      confirm_completion: true,
    });
  }

  async function reopen(item: Member) {
    if (
      disabled ||
      item.member_status !== 'completed'
    ) return;

    if (
      item.certificate_status === 'issued' ||
      item.certificate_status === 'draft'
    ) {
      setError(
        'Withdraw or revoke the certificate before reopening service. Revoked certificates cannot currently be reissued.'
      );
      return;
    }

    const reason = window.prompt(
      `Reason for reopening ${item.full_name}'s service:`
    );

    if (reason === null) return;

    if (
      !reason.trim() ||
      reason.trim().length > 2000
    ) {
      setError(
        'Enter a valid reason within 2000 characters.'
      );
      return;
    }

    if (!window.confirm(
      'Reopen completed volunteer service?'
    )) return;

    await mutate(
      `${base}/${item.member_id}/reopen`,
      'PATCH',
      { reason: reason.trim() }
    );
  }

  async function viewDetails(id: number) {
    if (lock.current || disabled) return;

    const releaseOperation = beginVolunteerOperation('Service completion');
    lock.current = true;
    setBusy(true);
    onWorking(true);
    setError('');
    setDetails(null);

    try {
      const response =
        await volunteerRequest<Details>(
          `${base}/${id}`
        );

      if (mounted.current) {
        setDetails(response.data);
      }
    } catch (error) {
      if (mounted.current) {
        setError(getErrorMessage(error));
      }
    } finally {
      lock.current = false;
      releaseOperation();

      if (mounted.current) {
        setBusy(false);
        onWorking(false);
      }
    }
  }

  return (
    <>
      <div className="panel">
        <button
          type="button"
          disabled={loading || busy}
          onClick={() => void load()}
        >
          {loading ? 'Loading...' : 'Refresh Records'}
        </button>

        {error && (
          <p role="alert" style={{ color: '#b91c1c' }}>
            {error}
          </p>
        )}

        {success && (
          <p style={{ color: '#15803d' }}>
            {success}
          </p>
        )}

        {!ready && !loading && (
          <p>Refresh records before making changes.</p>
        )}
      </div>

      {ready && (
        <>
          <div className="panel">
            <h3>Service Completion Summary</h3>

            <div style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 12,
            }}>
              {[
                ['Total Volunteers', items.length],
                ['Eligible', eligible.length],
                ['Completed', completed.length],
                ['Pending', pending.length],
                ['Certificates Issued', items.filter(
                  item =>
                    item.certificate_status === 'issued'
                ).length],
              ].map(([label, value]) => (
                <div key={label} style={{
                  padding: 16,
                  border: '1px solid #ddd',
                  borderRadius: 8,
                }}>
                  <small>{label}</small>
                  <h2>{value}</h2>
                </div>
              ))}
            </div>
          </div>

          {details && (
            <div className="panel">
              <h3>
                Service Details — {details.full_name}
              </h3>

              <ServiceInformation item={details} />
              <ServiceProgress item={details} />
              <AttendanceInformation item={details} />

              {details.attendance_mode !== 'none' &&
                details.service_start_date &&
                details.service_end_date && (
                  <p>
                    {formatServiceDate(details.service_start_date)}
                    {' - '}
                    {formatServiceDate(details.service_end_date)}
                  </p>
                )}

              {details.member_status !== 'completed' &&
                (details.completion_reasons || [])
                  .map(reason => (
                    <p key={reason} style={{
                      color: '#b45309',
                    }}>
                      {reason}
                    </p>
                  ))}

              {details.attendance_mode &&
               details.attendance_mode !== 'legacy' ? (
                <div style={{ overflowX: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Service Date</th>
                        {details.attendance_mode !== 'none' && (
                          <>
                            <th>Attendance</th>
                            <th>Finalized</th>
                            <th>Remarks</th>
                          </>
                        )}
                        {details.attendance_mode === 'detailed' && (
                          <>
                            <th>Check-in</th>
                            <th>Check-out</th>
                            <th>Actual Hours</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {(details.daily_attendance || []).map(day => (
                        <tr key={day.service_date_id}>
                          <td>
                            {formatServiceDate(day.service_date)}
                          </td>
                          {details.attendance_mode !== 'none' && (
                            <>
                              <td>{day.attendance_status}</td>
                              <td>
                                {day.is_finalized ? 'Yes' : 'No'}
                              </td>
                              <td>{day.remarks || '-'}</td>
                            </>
                          )}
                          {details.attendance_mode === 'detailed' && (
                            <>
                              <td>{formatIST(day.check_in_at)}</td>
                              <td>{formatIST(day.check_out_at)}</td>
                              <td>{day.service_hours ?? '-'}</td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!details.daily_attendance?.length && (
                    <p>No service dates found.</p>
                  )}
                </div>
              ) : (
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Duty / Shift</th>
                      <th>Attendance</th>
                      <th>Check-in / Out</th>
                      <th>Finalized</th>
                      <th>Service Hours</th>
                    </tr>
                  </thead>

                  <tbody>
                    {(details.assignments || [])
                      .map(item => (
                        <tr key={item.assignment_id}>
                          <td>
                            {formatServiceDate(
                              item.service_date
                            )}
                          </td>
                          <td>
                            <strong>{item.duty_name}</strong>
                            <div>{item.shift_name}</div>
                            <small>
                              {item.start_time} - {item.end_time}
                            </small>
                          </td>
                          <td>
                            {item.attendance_status}
                            <div>{item.remarks}</div>
                          </td>
                          <td>
                            <div>
                              {formatIST(item.check_in_at)}
                            </div>
                            <div>
                              {formatIST(item.check_out_at)}
                            </div>
                          </td>
                          <td>
                            {item.is_finalized ? 'Yes' : 'No'}
                          </td>
                          <td>{item.service_hours}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              )}
              <button
                type="button"
                onClick={() => setDetails(null)}
              >
                Close Details
              </button>
            </div>
          )}

          <div className="panel">
            <h3>Manage Service Completion</h3>

            <input
              placeholder="Search volunteer or group"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />

            <select
              value={filter}
              onChange={e => setFilter(e.target.value)}
            >
              <option value="">All Volunteers</option>
              <option value="eligible">Eligible</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
            </select>

            <p>Selected: {selected.length}</p>

            <button
              type="button"
              disabled={disabled}
              onClick={() =>
                setSelected(
                  filtered
                    .filter(item => item.can_complete)
                    .slice(0, 500)
                    .map(item => item.member_id)
                )
              }
            >
              Select Eligible (Filtered)
            </button>

            <button
              type="button"
              disabled={disabled}
              onClick={() => setSelected([])}
            >
              Clear Selection
            </button>

            <button
              className="primary"
              type="button"
              disabled={disabled || !selected.length}
              onClick={() => void complete(selected)}
            >
              {busy
                ? 'Processing...'
                : `Complete ${selected.length} Volunteer(s)`}
            </button>

            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Select</th>
                    <th>Volunteer</th>
                    <th>Service Progress</th>
                    <th>Attendance</th>
                    <th>Service</th>
                    <th>Status</th>
                    <th>Certificate</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map(item => (
                    <tr key={item.member_id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selected.includes(
                            item.member_id
                          )}
                          disabled={
                            disabled ||
                            !item.can_complete ||
                            (
                              selected.length >= 500 &&
                              !selected.includes(
                                item.member_id
                              )
                            )
                          }
                          onChange={() =>
                            toggleMember(item.member_id)
                          }
                        />
                      </td>

                      <td>
                        <strong>{item.full_name}</strong>
                        <div>{item.member_code}</div>
                        <small>{item.group_name}</small>
                      </td>

                      <td>
                        <ServiceProgress item={item} />
                      </td>

                      <td>
                        <AttendanceInformation item={item} />
                      </td>

                      <td>
                        <ServiceInformation item={item} />
                      </td>

                      <td>
                        {item.member_status === 'completed'
                          ? 'Completed'
                          : item.can_complete
                            ? 'Eligible'
                            : 'Pending'}

                        {item.member_status !== 'completed' &&
                          !item.can_complete && (
                            <div style={{
                              color: '#b45309',
                              fontSize: 12,
                            }}>
                              {(item.completion_reasons || [])
                                .join('; ')}
                            </div>
                          )}
                      </td>

                      <td>
                        {item.certificate_status || 'Not created'}
                      </td>

                      <td>
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() =>
                            void viewDetails(item.member_id)
                          }
                        >
                          Details
                        </button>

                        {item.can_complete && (
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() =>
                              void complete([item.member_id])
                            }
                          >
                            Complete
                          </button>
                        )}

                        {item.member_status === 'completed' && (
                          <button
                            type="button"
                            disabled={
                              disabled ||
                              item.certificate_status === 'issued' ||
                              item.certificate_status === 'draft'
                            }
                            onClick={() => void reopen(item)}
                          >
                            Reopen
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}

                  {!filtered.length && (
                    <tr>
                      <td colSpan={8}>
                        No volunteers found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}