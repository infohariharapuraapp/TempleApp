import { useEffect, useRef, useState } from 'react';

import {
  volunteerRequest,
  jsonRequest,
  getErrorMessage,
  formatServiceDate,
  isFutureShift,
  type VolunteerOpportunity,
} from '../../lib/volunteerApi';

interface Props {
  opportunities: VolunteerOpportunity[];
}

interface Requirement {
  id: number;
  duty_name: string;
  shift_name: string;
  service_date: string;
  start_time: string;
  required_count: number;
  is_active: boolean;
}

interface Member {
  id: number;
  full_name: string;
  member_code: string;
  mobile: string;
  group_name: string | null;
  registration_type: string;
  total_assignments: number;
}

interface Assignment {
  id: number;
  member_id: number;
  requirement_id: number;
  full_name: string;
  member_code: string;
  mobile: string;
  duty_name: string;
  shift_name: string;
  service_date: string;
  start_time: string;
  end_time: string;
  status: string;
  reporting_location: string | null;
  reporting_time: string | null;
  cancellation_reason: string | null;
}

export default function Assignments({
  opportunities,
}: Props) {
  const [opportunityId, setOpportunityId] =
    useState('');

  const [requirementId, setRequirementId] =
    useState('');

  const [requirements, setRequirements] =
    useState<Requirement[]>([]);

  const [assignments, setAssignments] =
    useState<Assignment[]>([]);

  const [members, setMembers] =
    useState<Member[]>([]);

  const [selected, setSelected] =
    useState<number[]>([]);

  const [instructions, setInstructions] =
    useState('');

  const [search, setSearch] = useState('');

  const [statusFilter, setStatusFilter] =
    useState('');

  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const [eligibleLoading, setEligibleLoading] =
    useState(false);

  const [ready, setReady] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [reassignment, setReassignment] =
    useState<Assignment | null>(null);

  const [newRequirementId, setNewRequirementId] =
    useState('');

  const [reason, setReason] = useState('');

  const [reassignInstructions, setReassignInstructions] =
    useState('');

  const mutationLock = useRef(false);
  const loadVersion = useRef(0);
  const eligibleVersion = useRef(0);

  const base =
    `/opportunities/${opportunityId}`;

  const activeRequirements = requirements.filter(
    item =>
      item.is_active &&
      isFutureShift(
        item.service_date,
        item.start_time
      )
  );

  function remainingCount(requirement: Requirement) {
    const assigned = assignments.filter(
      item =>
        item.requirement_id === requirement.id &&
        !['cancelled', 'reassigned'].includes(
          item.status
        )
    ).length;

    return Math.max(
      requirement.required_count - assigned,
      0
    );
  }

  const currentRequirement = requirements.find(
    item => item.id === Number(requirementId)
  );

  const remaining = currentRequirement
    ? remainingCount(currentRequirement)
    : 0;

  async function load() {
    const version = ++loadVersion.current;

    eligibleVersion.current++;

    setReady(false);
    setLoading(true);
    setEligibleLoading(false);
    setError('');
    setSelected([]);
    setMembers([]);

    try {
      if (!opportunityId) {
        setRequirements([]);
        setAssignments([]);
        return;
      }

      const [requirementResponse, assignmentResponse] =
        await Promise.all([
          volunteerRequest<Requirement[]>(
            `${base}/requirements`
          ),
          volunteerRequest<Assignment[]>(
            `${base}/assignments`
          ),
        ]);

      if (version !== loadVersion.current) {
        return;
      }

      if (
        !Array.isArray(requirementResponse.data) ||
        !Array.isArray(assignmentResponse.data)
      ) {
        throw new Error('Invalid response from server');
      }

      setRequirements(requirementResponse.data);
      setAssignments(assignmentResponse.data);
      setReady(true);
    } catch (error) {
      if (version === loadVersion.current) {
        setError(getErrorMessage(error));
        setReady(false);
      }
    } finally {
      if (version === loadVersion.current) {
        setLoading(false);
      }
    }
  }

  async function loadEligible() {
    const version = ++eligibleVersion.current;

    setMembers([]);
    setSelected([]);

    if (
      !opportunityId ||
      !requirementId ||
      !ready
    ) {
      setEligibleLoading(false);
      return;
    }

    setEligibleLoading(true);

    try {
      const response =
        await volunteerRequest<Member[]>(
          `${base}/requirements/${requirementId}/eligible-volunteers`
        );

      if (version !== eligibleVersion.current) {
        return;
      }

      if (!Array.isArray(response.data)) {
        throw new Error('Invalid eligible volunteers response');
      }

      setMembers(response.data);
    } catch (error) {
      if (version === eligibleVersion.current) {
        setError(getErrorMessage(error));
      }
    } finally {
      if (version === eligibleVersion.current) {
        setEligibleLoading(false);
      }
    }
  }

  useEffect(() => {
    setRequirementId('');
    setRequirements([]);
    setAssignments([]);
    setMembers([]);
    setSelected([]);
    setSuccess('');
    setReassignment(null);

    void load();

    return () => {
      loadVersion.current++;
      eligibleVersion.current++;
    };
  }, [opportunityId]);

  useEffect(() => {
    void loadEligible();

    return () => {
      eligibleVersion.current++;
    };
  }, [opportunityId, requirementId, ready]);

  const filteredMembers = members.filter(member =>
    [
      member.full_name,
      member.mobile,
      member.member_code,
      member.group_name || '',
    ].join(' ').toLowerCase().includes(
      search.toLowerCase()
    )
  );

  const filteredAssignments = assignments.filter(
    item => !statusFilter ||
      item.status === statusFilter
  );

  function toggleMember(id: number) {
    setSelected(current => {
      if (current.includes(id)) {
        return current.filter(item => item !== id);
      }

      if (
        current.length >= remaining ||
        current.length >= 500
      ) {
        return current;
      }

      return [...current, id];
    });
  }

  async function mutate(
    endpoint: string,
    method: string,
    body: unknown,
    message: string
  ) {
    if (
      mutationLock.current ||
      !ready ||
      loading ||
      eligibleLoading
    ) {
      return;
    }

    mutationLock.current = true;
    setBusy(true);
    setError('');
    setSuccess('');

    try {
      const response = await volunteerRequest(
        endpoint,
        jsonRequest(method, body)
      );

      setSuccess(response.message || message);

      setSelected([]);
      setInstructions('');
      setReassignment(null);
      setReason('');

      await load();
    } catch (error) {
      setError(getErrorMessage(error));

      // Prevent immediate retry after
      // an uncertain server response.
      setReady(false);
      setSelected([]);
    } finally {
      mutationLock.current = false;
      setBusy(false);
    }
  }

  async function assignVolunteers() {
    if (
      !requirementId ||
      !selected.length ||
      selected.length > remaining ||
      selected.length > 500
    ) {
      setError('Select valid volunteers within the available capacity.');
      return;
    }

    if (!window.confirm(
      `Assign ${selected.length} volunteer(s) to this duty?`
    )) {
      return;
    }

    await mutate(
      `${base}/assignments`,
      'POST',
      {
        requirement_id: Number(requirementId),
        member_ids: selected,
        special_instructions: instructions.trim() || null,
      },
      'Volunteers assigned successfully'
    );
  }

  async function cancelAssignment(
    assignment: Assignment
  ) {
    const cancellationReason = window.prompt(
      `Cancellation reason for ${assignment.full_name}:`
    );

    if (cancellationReason === null) return;

    if (!cancellationReason.trim()) {
      setError('Cancellation reason is required.');
      return;
    }

    await mutate(
      `${base}/assignments/${assignment.id}/cancel`,
      'PATCH',
      {
        cancellation_reason:
          cancellationReason.trim(),
      },
      'Assignment cancelled'
    );
  }

  async function submitReassignment() {
    if (
      !reassignment ||
      !newRequirementId ||
      !reason.trim()
    ) {
      setError('Select a new duty and enter a reason.');
      return;
    }

    if (!window.confirm(
      `Reassign ${reassignment.full_name} to the selected duty?`
    )) {
      return;
    }

    await mutate(
      `${base}/assignments/${reassignment.id}/reassign`,
      'PATCH',
      {
        requirement_id: Number(newRequirementId),
        reason: reason.trim(),
        special_instructions:
          reassignInstructions.trim() || null,
      },
      'Volunteer reassigned successfully'
    );
  }

  const disabled =
    loading || busy || !ready || eligibleLoading;

  const activeAssignments = assignments.filter(
    item => !['cancelled', 'reassigned'].includes(
      item.status
    )
  ).length;

  return (
    <section>
      <div className="panel">
        <h2>Duty Assignments</h2>

        <p>
          Allocate eligible volunteers to service
          duties and shifts.
        </p>

        <label>
          Seva Opportunity

          <select
            value={opportunityId}
            disabled={busy || loading}
            onChange={event =>
              setOpportunityId(event.target.value)
            }
          >
            <option value="">
              Select opportunity
            </option>

            {opportunities.map(item => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          disabled={!opportunityId || loading || busy}
          onClick={() => void load()}
        >
          {loading ? 'Loading...' : 'Refresh Records'}
        </button>
      </div>

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
          Refresh records before making further changes.
        </div>
      )}

      {opportunityId && ready && (
        <>
          <div className="panel">
            <h3>Assignment Summary</h3>

            <div style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 16,
            }}>
              {[
                ['Active Assignments', activeAssignments],
                ['In Progress', assignments.filter(
                  a => a.status === 'in_progress'
                ).length],
                ['Completed', assignments.filter(
                  a => a.status === 'completed'
                ).length],
                ['Cancelled', assignments.filter(
                  a => a.status === 'cancelled'
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

          <div className="panel">
            <h3>Allocate Volunteers</h3>

            <fieldset disabled={busy || loading}
              style={{ border: 0, padding: 0 }}>
              <label>
                Duty Requirement

                <select
                  value={requirementId}
                  onChange={event => {
                    setMembers([]);
                    setSelected([]);
                    setRequirementId(event.target.value);
                  }}
                >
                  <option value="">
                    Select duty and shift
                  </option>

                  {activeRequirements.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.duty_name} — {item.shift_name}
                      {' | '}
                      {formatServiceDate(item.service_date)}
                      {' | Remaining: '}
                      {remainingCount(item)}
                    </option>
                  ))}
                </select>
              </label>

              {currentRequirement && (
                <>
                  <p>
                    Required: {currentRequirement.required_count}
                    {' | Remaining: '}{remaining}
                    {' | Selected: '}{selected.length}
                  </p>

                  <input
                    placeholder="Search name, mobile or member code"
                    value={search}
                    onChange={event =>
                      setSearch(event.target.value)
                    }
                  />

                  <button
                    type="button"
                    disabled={eligibleLoading}
                    onClick={() => void loadEligible()}
                  >
                    Refresh Eligible Volunteers
                  </button>

                  {eligibleLoading ? (
                    <p>Loading eligible volunteers...</p>
                  ) : (
                    <>
                      <p>
                        {filteredMembers.length} matching eligible volunteers
                      </p>

                      <button
                        type="button"
                        disabled={remaining === 0}
                        onClick={() =>
                          setSelected(
                            filteredMembers
                              .slice(0, Math.min(remaining, 500))
                              .map(member => member.id)
                          )
                        }
                      >
                        Select Available
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelected([])}
                      >
                        Clear Selection
                      </button>

                      <div style={{
                        overflowX: 'auto',
                        maxHeight: 400,
                        overflowY: 'auto',
                      }}>
                        <table>
                          <thead>
                            <tr>
                              <th>Select</th>
                              <th>Volunteer</th>
                              <th>Mobile</th>
                              <th>Registration</th>
                              <th>Existing Duties</th>
                            </tr>
                          </thead>

                          <tbody>
                            {filteredMembers.map(member => (
                              <tr key={member.id}>
                                <td>
                                  <input
                                    type="checkbox"
                                    checked={selected.includes(member.id)}
                                    disabled={
                                      !selected.includes(member.id) &&
                                      selected.length >= Math.min(remaining, 500)
                                    }
                                    onChange={() =>
                                      toggleMember(member.id)
                                    }
                                  />
                                </td>

                                <td>
                                  <strong>{member.full_name}</strong>
                                  <div>{member.member_code}</div>
                                </td>

                                <td>{member.mobile}</td>

                                <td>
                                  {member.group_name ||
                                    member.registration_type}
                                </td>

                                <td>{member.total_assignments}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  <label>
                    Special Instructions (Optional)

                    <textarea
                      maxLength={10000}
                      value={instructions}
                      onChange={event =>
                        setInstructions(event.target.value)
                      }
                    />
                  </label>

                  <button
                    className="primary"
                    type="button"
                    disabled={
                      disabled ||
                      !selected.length ||
                      selected.length > remaining
                    }
                    onClick={() => void assignVolunteers()}
                  >
                    {busy
                      ? 'Processing...'
                      : `Assign ${selected.length} Volunteer(s)`}
                  </button>
                </>
              )}
            </fieldset>
          </div>

          {reassignment && (
            <div className="panel">
              <h3>Reassign Volunteer</h3>

              <p>{reassignment.full_name}</p>

              <p>Current Duty: {reassignment.duty_name}</p>

              <fieldset disabled={disabled}
                style={{ border: 0, padding: 0 }}>
                <label>
                  New Duty Requirement

                  <select
                    value={newRequirementId}
                    onChange={event =>
                      setNewRequirementId(event.target.value)
                    }
                  >
                    <option value="">Select new duty</option>

                    {activeRequirements
                      .filter(item =>
                        item.id !== reassignment.requirement_id &&
                        remainingCount(item) > 0
                      )
                      .map(item => (
                        <option key={item.id} value={item.id}>
                          {item.duty_name} — {item.shift_name}
                          {' | '}
                          {formatServiceDate(item.service_date)}
                        </option>
                      ))}
                  </select>
                </label>

                <label>
                  Reassignment Reason

                  <textarea
                    maxLength={10000}
                    value={reason}
                    onChange={event =>
                      setReason(event.target.value)
                    }
                  />
                </label>

                <label>
                  Special Instructions

                  <textarea
                    maxLength={10000}
                    value={reassignInstructions}
                    onChange={event =>
                      setReassignInstructions(event.target.value)
                    }
                  />
                </label>

                <button
                  className="primary"
                  type="button"
                  disabled={!newRequirementId || !reason.trim()}
                  onClick={() => void submitReassignment()}
                >
                  Confirm Reassignment
                </button>

                <button
                  type="button"
                  onClick={() => setReassignment(null)}
                >
                  Close
                </button>
              </fieldset>
            </div>
          )}

          <div className="panel">
            <h3>Assignment Records</h3>

            <select
              value={statusFilter}
              onChange={event =>
                setStatusFilter(event.target.value)
              }
            >
              <option value="">All Statuses</option>
              <option value="assigned">Assigned</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="reassigned">Reassigned</option>
            </select>

            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Volunteer</th>
                    <th>Duty</th>
                    <th>Shift</th>
                    <th>Reporting</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredAssignments.map(item => {
                    const canModify =
                      item.status === 'assigned' &&
                      isFutureShift(
                        item.service_date,
                        item.start_time
                      );

                    return (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.full_name}</strong>
                          <div>{item.member_code}</div>
                          <small>{item.mobile}</small>
                        </td>

                        <td>{item.duty_name}</td>

                        <td>
                          {item.shift_name}
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
                          {item.reporting_location || '-'}
                          <div>
                            {item.reporting_time?.slice(0, 5)}
                          </div>
                        </td>

                        <td>
                          {item.status.replace(/_/g, ' ')}
                          {item.cancellation_reason && (
                            <div>{item.cancellation_reason}</div>
                          )}
                        </td>

                        <td>
                          {canModify ? (
                            <>
                              <button
                                type="button"
                                disabled={disabled}
                                onClick={() => {
                                  setReassignment(item);
                                  setNewRequirementId('');
                                  setReason('');
                                  setReassignInstructions('');
                                }}
                              >
                                Reassign
                              </button>

                              <button
                                type="button"
                                disabled={disabled}
                                onClick={() =>
                                  void cancelAssignment(item)
                                }
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <small>No changes allowed</small>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {!filteredAssignments.length && (
                    <tr>
                      <td colSpan={6}>
                        No assignment records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}