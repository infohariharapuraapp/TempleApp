import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import type { FormEvent } from 'react';

import {
  volunteerRequest,
  jsonRequest,
  getErrorMessage,
  formatIST,
  formatServiceDate,
} from '../../lib/volunteerApi';

import type {
  VolunteerOpportunity,
} from '../../lib/volunteerApi';

type Registration = {
  id: number;
  registration_code: string;
  opportunity_title: string;
  registration_type: string;
  group_name: string | null;
  total_members: number;
  status: string;
  registered_by_name: string;
  contact_member_name: string;
  contact_member_mobile: string;
  approved_members: number;
  total_assignments: number;
  created_at: string;
  is_registration_owner_deleted: boolean;
};

type Member = {
  id: number;
  member_code: string;
  full_name: string;
  mobile: string;
  email: string | null;
  age: number | null;
  date_of_birth: string | null;
  gender: string | null;
  photo_url: string | null;
  country: string | null;
  pincode: string | null;
  state: string | null;
  district: string | null;
  mandal: string | null;
  city: string | null;
  street: string | null;
  door_number: string | null;
  qualification: string | null;
  profession: string | null;
  area_of_interest: string | null;
  is_team_leader: boolean;
  status: string;
  service_dates?: string[];
  availability: {
    shift_id: number;
    shift_name: string;
    service_date: string;
    start_time: string;
    end_time: string;
    is_active: boolean;
  }[];
};

type Details = Registration & {
  registered_by_email: string | null;
  registered_by_phone: string | null;
  admin_remarks: string | null;
  rejection_reason: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  members: Member[];
};

type Stats = Record<string, number>;

type Filters = {
  opportunity_id: string;
  status: string;
  registration_type: string;
  search: string;
};

const emptyFilters: Filters = {
  opportunity_id: '',
  status: '',
  registration_type: '',
  search: '',
};

const statuses = [
  'pending',
  'approved',
  'rejected',
  'assigned',
  'in_progress',
  'completed',
  'cancelled',
];

function statusText(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char =>
      char.toUpperCase()
    );
}

export default function Registrations({
  opportunities,
}: {
  opportunities: VolunteerOpportunity[];
}) {
  const [filters, setFilters] =
    useState<Filters>({ ...emptyFilters });

  const [applied, setApplied] =
    useState<Filters>({ ...emptyFilters });

  const [page, setPage] =
    useState(1);

  const [totalPages, setTotalPages] =
    useState(0);

  const [total, setTotal] =
    useState(0);

  const [items, setItems] =
    useState<Registration[]>([]);

  const [stats, setStats] =
    useState<Stats | null>(null);

  const [detail, setDetail] =
    useState<Details | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [detailLoading, setDetailLoading] =
    useState(false);

  const [busy, setBusy] =
    useState(false);

  const [needsRefresh, setNeedsRefresh] =
    useState(false);

  const [error, setError] =
    useState('');

  const [success, setSuccess] =
    useState('');

  const [remarks, setRemarks] =
    useState('');

  const [reason, setReason] =
    useState('');

  const [action, setAction] =
    useState<'approve' | 'reject' | ''>('');

  const listVersion = useRef(0);
  const detailVersion = useRef(0);
  const mutationLock = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
      listVersion.current++;
      detailVersion.current++;
    };
  }, []);

  const load = useCallback(async () => {
    const version = ++listVersion.current;

    setLoading(true);
    setError('');

    const params = new URLSearchParams({
      page: String(page),
      limit: '25',
    });

    for (const [key, value] of Object.entries(applied)) {
      if (value.trim()) {
        params.set(key, value.trim());
      }
    }

    const statsQuery = applied.opportunity_id
      ? `?opportunity_id=${applied.opportunity_id}`
      : '';

    try {
      const [list, statistics] =
        await Promise.all([
          volunteerRequest<Registration[]>(
            `/registrations?${params.toString()}`
          ),

          volunteerRequest<Stats>(
            `/registrations/stats${statsQuery}`
          ),
        ]);

      if (
        !Array.isArray(list.data) ||
        !list.pagination
      ) {
        throw new Error(
          'Invalid registration response.'
        );
      }

      if (
        !mounted.current ||
        version !== listVersion.current
      ) {
        return false;
      }

      setItems(list.data);
      setStats(statistics.data);

      setTotalPages(
        list.pagination.total_pages
      );

      setTotal(list.pagination.total);
      setNeedsRefresh(false);

      return true;
    } catch (error) {
      if (
        mounted.current &&
        version === listVersion.current
      ) {
        setError(getErrorMessage(error));
        setNeedsRefresh(true);
      }

      return false;
    } finally {
      if (
        mounted.current &&
        version === listVersion.current
      ) {
        setLoading(false);
      }
    }
  }, [applied, page]);

  useEffect(() => {
    setItems([]);
    setStats(null);
    setTotal(0);
    setTotalPages(0);

    void load();

    return () => {
      listVersion.current++;
    };
  }, [load]);

  async function openDetails(id: number) {
    const version = ++detailVersion.current;

    setDetail(null);
    setDetailLoading(true);
    setError('');
    setAction('');
    setRemarks('');
    setReason('');

    try {
      const response =
        await volunteerRequest<Details>(
          `/registrations/${id}`
        );

      if (
        !response.data ||
        !Array.isArray(response.data.members)
      ) {
        throw new Error(
          'Invalid registration details.'
        );
      }

      if (
        !mounted.current ||
        version !== detailVersion.current
      ) {
        return false;
      }

      setDetail(response.data);
      setRemarks(
        response.data.admin_remarks || ''
      );

      return true;
    } catch (error) {
      if (
        mounted.current &&
        version === detailVersion.current
      ) {
        setError(getErrorMessage(error));
      }

      return false;
    } finally {
      if (
        mounted.current &&
        version === detailVersion.current
      ) {
        setDetailLoading(false);
      }
    }
  }

  function closeDetails() {
    detailVersion.current++;
    setDetail(null);
    setDetailLoading(false);
    setAction('');
    setRemarks('');
    setReason('');
  }

  function applyFilters(event: FormEvent) {
    event.preventDefault();

    if (busy) return;

    closeDetails();
    setPage(1);
    setApplied({ ...filters });
  }

  async function refreshAll() {
    const id = detail?.id;

    const refreshed = await load();

    if (refreshed && id) {
      const detailRefreshed =
        await openDetails(id);

      if (!detailRefreshed) {
        setNeedsRefresh(true);
      }
    }
  }

  async function review(event: FormEvent) {
    event.preventDefault();

    if (
      !detail ||
      detail.status !== 'pending' ||
      !action ||
      loading ||
      needsRefresh ||
      mutationLock.current
    ) {
      return;
    }

    if (
      action === 'reject' &&
      !reason.trim()
    ) {
      setError('Rejection reason is required.');
      return;
    }

    if (
      !window.confirm(
        `${action === 'approve' ? 'Approve' : 'Reject'} registration ${detail.registration_code} and all ${detail.total_members} member(s)?`
      )
    ) {
      return;
    }

    mutationLock.current = true;

    setBusy(true);
    setError('');
    setSuccess('');

    const id = detail.id;

    try {
      const response =
        await volunteerRequest(
          `/registrations/${id}/review`,

          jsonRequest('PATCH', {
            action,
            admin_remarks:
              remarks.trim() || null,
            rejection_reason:
              action === 'reject'
                ? reason.trim()
                : null,
          })
        );

      if (!mounted.current) return;

      setSuccess(
        response.message ||
        'Registration reviewed successfully.'
      );

      closeDetails();

      const refreshed = await load();

      if (!refreshed) {
        setNeedsRefresh(true);
      }
    } catch (error) {
      if (mounted.current) {
        setError(getErrorMessage(error));
        setNeedsRefresh(true);
      }
    } finally {
      mutationLock.current = false;

      if (mounted.current) {
        setBusy(false);
      }
    }
  }

  function changePage(next: number) {
    if (
      busy ||
      next < 1 ||
      next > totalPages
    ) {
      return;
    }

    closeDetails();
    setPage(next);
  }

  const disabled =
    loading ||
    busy ||
    detailLoading ||
    needsRefresh;

  return (
    <>
      <div className="page-head">
        <div>
          <h3>Volunteer Registrations</h3>

          <p>
            Review individual and group
            seva applications.
          </p>
        </div>

        <button
          disabled={
            busy || loading || detailLoading
          }
          onClick={() => void refreshAll()}
        >
          Refresh
        </button>
      </div>

      {error && (
        <div
          className="error"
          role="alert"
        >
          {error}
        </div>
      )}

      {needsRefresh && (
        <div className="panel">
          Refresh records before retrying
          registration changes.
        </div>
      )}

      {success && (
        <div className="panel"
          role="status"
          style={{ color: '#15803d' }}>
          {success}
        </div>
      )}

      <div className="stats">
        {[
          ['Applications', 'total_registrations'],
          ['Pending', 'pending_registrations'],
          ['Approved', 'approved_registrations'],
          ['Rejected', 'rejected_registrations'],
          ['Total Volunteers', 'total_volunteers'],
          ['Approved Volunteers', 'approved_volunteers'],
        ].map(([label, key]) => (
          <div className="stat" key={key}>
            <span>{label}</span>

            <strong>
              {stats?.[key] ?? '—'}
            </strong>
          </div>
        ))}
      </div>

      <p>
        Statistics include all registrations
        for the selected opportunity.
      </p>

      <form
        className="form-card"
        onSubmit={applyFilters}
      >
        <fieldset
          disabled={busy}
          style={{
            border: 0,
            padding: 0,
            margin: 0,
            minWidth: 0,
          }}
        >
          <div className="grid2">
            <label>
              Seva Opportunity

              <select
                value={filters.opportunity_id}
                onChange={e =>
                  setFilters(current => ({
                    ...current,
                    opportunity_id: e.target.value,
                  }))
                }
              >
                <option value="">
                  All Opportunities
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

            <label>
              Registration Status

              <select
                value={filters.status}
                onChange={e =>
                  setFilters(current => ({
                    ...current,
                    status: e.target.value,
                  }))
                }
              >
                <option value="">
                  All Statuses
                </option>

                {statuses.map(item => (
                  <option key={item} value={item}>
                    {statusText(item)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Registration Type

              <select
                value={filters.registration_type}
                onChange={e =>
                  setFilters(current => ({
                    ...current,
                    registration_type: e.target.value,
                  }))
                }
              >
                <option value="">All Types</option>

                <option value="individual">
                  Individual
                </option>

                <option value="group">
                  Group
                </option>
              </select>
            </label>

            <label>
              Search

              <input
                maxLength={150}
                placeholder="Name, mobile, group or code"
                value={filters.search}
                onChange={e =>
                  setFilters(current => ({
                    ...current,
                    search: e.target.value,
                  }))
                }
              />
            </label>
          </div>

          <div className="actions">
            <button
              type="submit"
              className="primary"
            >
              Apply Filters
            </button>

            <button
              type="button"
              onClick={() => {
                closeDetails();
                setFilters({ ...emptyFilters });
                setApplied({ ...emptyFilters });
                setPage(1);
              }}
            >
              Reset
            </button>
          </div>
        </fieldset>
      </form>

      {detailLoading && (
        <div className="panel">
          Loading registration details…
        </div>
      )}

      {detail && (
        <div className="panel">
          <div className="page-head">
            <div>
              <h3>
                {detail.registration_code}
              </h3>

              <p>
                {detail.opportunity_title}
              </p>
            </div>

            <button
              disabled={busy}
              onClick={closeDetails}
            >
              Close Details
            </button>
          </div>

          <div className="grid2">
            <div>
              <strong>Registered By</strong>
              <p>{detail.registered_by_name}</p>

              <p>
                {detail.registered_by_phone || '—'}
              </p>

              <p>
                {detail.registered_by_email || '—'}
              </p>
            </div>

            <div>
              <strong>Application Details</strong>

              <p>
                Type: {statusText(
                  detail.registration_type
                )}
              </p>

              {detail.group_name && (
                <p>
                  Group: {detail.group_name}
                </p>
              )}

              <p>
                Members: {detail.total_members}
              </p>

              <p>
                Status: {statusText(detail.status)}
              </p>

              <p>
                Submitted: {formatIST(
                  detail.created_at
                )}
              </p>
            </div>
          </div>

          <h3>Volunteer Members</h3>

          {detail.members.map(member => (
            <div
              className="panel"
              key={member.id}
            >
              <div style={{
                display: 'flex',
                gap: 16,
                alignItems: 'center',
              }}>
                {member.photo_url?.startsWith('https://') && (
                  <img
                    src={member.photo_url}
                    alt="Volunteer"
                    style={{
                      width: 75,
                      height: 90,
                      objectFit: 'cover',
                      borderRadius: 8,
                    }}
                  />
                )}

                <div>
                  <h3>{member.full_name}</h3>

                  <p>{member.member_code}</p>

                  {member.is_team_leader && (
                    <strong>Team Leader</strong>
                  )}

                  <p>
                    {statusText(member.status)}
                  </p>
                </div>
              </div>

              <div className="grid2">
                {[
                  ['Mobile', member.mobile],
                  ['Email', member.email],
                  ['Age', member.age],
                  [
                    'Date of Birth',
                    formatServiceDate(
                      member.date_of_birth
                    ),
                  ],
                  ['Gender', member.gender],
                  ['Qualification', member.qualification],
                  ['Profession', member.profession],
                  ['Area of Interest', member.area_of_interest],
                  ['Door Number', member.door_number],
                  ['Street', member.street],
                  ['City / Village', member.city],
                  ['Mandal', member.mandal],
                  ['District', member.district],
                  ['State', member.state],
                  ['Country', member.country],
                  ['Pincode', member.pincode],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <small>{label}</small>

                    <div>
                      <strong>{value ?? '—'}</strong>
                    </div>
                  </div>
                ))}
              </div>

              <h4>Selected Service Dates</h4>
              {member.service_dates === undefined ? (
                <p>
                  Service date information is unavailable
                  from this backend version.
                </p>
              ) : member.service_dates.length > 0 ? (
                <>
                  <p style={{ color: '#15803d' }}>
                    <strong>
                      {member.service_dates.length}
                      {' '}
                      service day(s) selected
                    </strong>
                  </p>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 10,
                      marginBottom: 16,
                    }}
                  >
                    {member.service_dates.map(date => (
                      <div
                        key={date}
                        style={{
                          padding: '10px 16px',
                          borderRadius: 8,
                          border: '1px solid #C69A3A',
                          background: '#FFF8E7',
                          color: '#6B1720',
                          fontWeight: 600,
                        }}
                      >
                        {formatServiceDate(date)}
                      </div>
                    ))}
                  </div>
                </>
              ) : member.availability?.length ? (
                <p>
                  This application uses legacy
                  shift-based registration.
                </p>
              ) : (
                <p>No selected service dates.</p>
              )}
              <h4>Legacy Service Shifts</h4>

              {member.availability?.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Shift</th>
                        <th>Timing</th>
                        <th>Status</th>
                      </tr>
                    </thead>

                    <tbody>
                      {member.availability.map(shift => (
                        <tr key={shift.shift_id}>
                          <td>
                            {formatServiceDate(
                              shift.service_date
                            )}
                          </td>

                          <td>{shift.shift_name}</td>

                          <td>
                            {shift.start_time.slice(0, 5)}
                            {' — '}
                            {shift.end_time.slice(0, 5)}
                          </td>

                          <td>
                            {shift.is_active
                              ? 'Active'
                              : 'Disabled'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>No shift-based availability recorded.</p>
              )}
            </div>
          ))}

          {detail.status === 'pending' ? (
            <form
              className="form-card"
              onSubmit={review}
            >
              <h3>Review Application</h3>

              <p>
                Approval or rejection applies
                to the entire registration
                and all its members.
              </p>

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
                  Review Action *

                  <select
                    required
                    value={action}
                    onChange={e =>
                      setAction(
                        e.target.value as
                          'approve' | 'reject' | ''
                      )
                    }
                  >
                    <option value="">
                      Select action
                    </option>

                    <option value="approve">
                      Approve Registration
                    </option>

                    <option value="reject">
                      Reject Registration
                    </option>
                  </select>
                </label>

                <label>
                  Admin Remarks

                  <textarea
                    rows={3}
                    maxLength={5000}
                    value={remarks}
                    onChange={e =>
                      setRemarks(e.target.value)
                    }
                  />
                </label>

                {action === 'reject' && (
                  <label>
                    Rejection Reason *

                    <textarea
                      required
                      rows={3}
                      maxLength={5000}
                      value={reason}
                      onChange={e =>
                        setReason(e.target.value)
                      }
                    />
                  </label>
                )}

                <button
                  type="submit"
                  className="primary"
                  disabled={!action || disabled}
                >
                  {busy
                    ? 'Processing…'
                    : 'Submit Review'}
                </button>
              </fieldset>
            </form>
          ) : (
            <div className="panel">
              <h3>Review Information</h3>

              <p>
                Reviewed By:
                {' '}
                {detail.reviewed_by_name || '—'}
              </p>

              <p>
                Reviewed At:
                {' '}
                {formatIST(detail.reviewed_at)}
              </p>

              <p>
                Remarks:
                {' '}
                {detail.admin_remarks || '—'}
              </p>

              {detail.rejection_reason && (
                <p>
                  Rejection Reason:
                  {' '}
                  {detail.rejection_reason}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {loading && (
        <p>Loading registrations…</p>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Registration</th>
              <th>Programme</th>
              <th>Contact</th>
              <th>Members</th>
              <th>Status</th>
              <th>Submitted</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {items.map(item => (
              <tr key={item.id}>
                <td>
                  <strong>
                    {item.registration_code}
                  </strong>

                  <div>
                    {statusText(
                      item.registration_type
                    )}
                  </div>

                  {item.group_name && (
                    <small>
                      {item.group_name}
                    </small>
                  )}

                  {item.is_registration_owner_deleted && (
                    <div>
                      <small>Owner account deleted</small>
                    </div>
                  )}
                </td>

                <td>{item.opportunity_title}</td>

                <td>
                  {item.contact_member_name || '—'}

                  <div>
                    <small>
                      {item.contact_member_mobile}
                    </small>
                  </div>
                </td>

                <td>{item.total_members}</td>

                <td>{statusText(item.status)}</td>

                <td>{formatIST(item.created_at)}</td>

                <td>
                  <button
                    disabled={
                      busy ||
                      loading ||
                      detailLoading
                    }
                    onClick={() =>
                      void openDetails(item.id)
                    }
                  >
                    {item.status === 'pending'
                      ? 'Review'
                      : 'View Details'}
                  </button>
                </td>
              </tr>
            ))}

            {!loading && !items.length && (
              <tr>
                <td colSpan={7}>
                  No registrations found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div
        className="actions"
        style={{
          marginTop: 16,
          alignItems: 'center',
        }}
      >
        <button
          disabled={
            busy || loading || page <= 1
          }
          onClick={() => changePage(page - 1)}
        >
          Previous
        </button>

        <span>
          Page {totalPages ? page : 0}
          {' of '}
          {totalPages}
          {' — '}
          {total} applications
        </span>

        <button
          disabled={
            busy ||
            loading ||
            page >= totalPages
          }
          onClick={() => changePage(page + 1)}
        >
          Next
        </button>
      </div>
    </>
  );
}