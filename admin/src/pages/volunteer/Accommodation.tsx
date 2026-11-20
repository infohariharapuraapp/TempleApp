import {
  beginVolunteerOperation,
} from '../../lib/volunteerOperationGuard';
import { useEffect, useRef, useState } from 'react';
import {
  useVolunteerUnsavedChanges,
} from '../../lib/volunteerUnsavedChangesGuard';

import {
  volunteerRequest,
  jsonRequest,
  getErrorMessage,
  formatIST,
  type VolunteerOpportunity,
} from '../../lib/volunteerApi';

interface Props {
  opportunities: VolunteerOpportunity[];
  selectedProgrammeId: string;
}

interface Member {
  member_id: number;
  full_name: string;
  member_code: string;
  mobile: string;
  group_name: string | null;
  registration_type: string;
  accommodation_count: number;
  visible_accommodation_count: number;
}

interface Form {
  accommodation_name: string;
  building_name: string;
  room_number: string;
  address: string;
  check_in_at: string;
  check_out_at: string;
  contact_person: string;
  contact_phone: string;
  instructions: string;
}

type AccommodationRecord = {
  [K in keyof Form]: string | null;
} & {
  id: number;
  member_id: number;
  full_name: string;
  member_code: string;
  mobile: string;
  group_name: string | null;
  member_status: string;
  registration_status: string;
  is_visible: boolean;
  created_by_name: string | null;
  published_at: string | null;
};

const emptyForm: Form = {
  accommodation_name: '',
  building_name: '',
  room_number: '',
  address: '',
  check_in_at: '',
  check_out_at: '',
  contact_person: '',
  contact_phone: '',
  instructions: '',
};

function toISTInput(value: string | null) {
  if (!value) return '';

  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) return '';

  return new Date(
    timestamp + 330 * 60 * 1000
  ).toISOString().slice(0, 19);
}

function toISTTimestamp(value: string) {
  if (!value) return null;

  return `${value}+05:30`;
}

export default function Accommodation({
  opportunities,
  selectedProgrammeId,
}: Props) {
  const selectedProgramme = opportunities.find(
    item => String(item.id) === selectedProgrammeId
  );
  const opportunityId =
    selectedProgramme?.accommodation_enabled === true
      ? String(selectedProgramme.id)
      : '';

  return (
    <section>
      <div className="panel">
        <h2>Volunteer Accommodation</h2>

        <p>
          Allocate accommodation and publish
          confirmed stay details to volunteers.
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

      {selectedProgramme &&
       selectedProgramme.accommodation_enabled !== true && (
        <div className="panel">
          <h3>Accommodation unavailable</h3>
          <p>
            Accommodation is not enabled for this programme.
          </p>
        </div>
      )}
      {opportunityId && (
        <AccommodationManager
          key={opportunityId}
          opportunityId={opportunityId}
        />
      )}
    </section>
  );
}

function AccommodationManager({
  opportunityId,
}: {
  opportunityId: string;
}) {
  const base =
    `/opportunities/${opportunityId}/accommodation`;

  const [members, setMembers] =
    useState<Member[]>([]);

  const [records, setRecords] =
    useState<AccommodationRecord[]>([]);

  const [selected, setSelected] =
    useState<number[]>([]);

  const [form, setForm] =
    useState<Form>({ ...emptyForm });
  const formBaseline = useRef<Form>({
    ...emptyForm,
  });

  const [editing, setEditing] =
    useState<AccommodationRecord | null>(null);

  const [showForm, setShowForm] =
    useState(false);

  const [search, setSearch] = useState('');

  const [recordSearch, setRecordSearch] =
    useState('');

  const [visibilityFilter, setVisibilityFilter] =
    useState('');

  const [loading, setLoading] =
    useState(true);

  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const lock = useRef(false);
  const recoveryRequired = useRef(false);
  const [mutationUncertain, setMutationUncertain] =
    useState(false);
  const version = useRef(0);
  const mounted = useRef(true);

  async function load(discardForm = false) {
    const requestVersion = ++version.current;

    setLoading(true);
    setReady(false);
    setError('');

    try {
      const [memberResponse, recordResponse] =
        await Promise.all([
          volunteerRequest<Member[]>(
            `${base}/eligible-members`
          ),
          volunteerRequest<AccommodationRecord[]>(
            base
          ),
        ]);

      if (
        !mounted.current ||
        requestVersion !== version.current
      ) return;

      if (
        !Array.isArray(memberResponse.data) ||
        !Array.isArray(recordResponse.data)
      ) {
        throw new Error('Invalid server response');
      }

      setMembers(memberResponse.data);
      setRecords(recordResponse.data);
      setReady(true);
      if (recoveryRequired.current) {
        recoveryRequired.current = false;
        setMutationUncertain(false);
        setSuccess(
          'Records refreshed. Review the latest server records before submitting again.'
        );
      }

      if (discardForm) {
        closeForm();
      }
    } catch (error) {
      if (
        mounted.current &&
        requestVersion === version.current
      ) {
        setError(getErrorMessage(error));
      }
    } finally {
      if (
        mounted.current &&
        requestVersion === version.current
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

  const disabled =
    loading ||
    busy ||
    !ready ||
    mutationUncertain;
  const formDirty =
    showForm &&
    (
      JSON.stringify(form) !==
        JSON.stringify(formBaseline.current) ||
      (!editing && selected.length > 0)
    );
  useVolunteerUnsavedChanges(
    'Accommodation form',
    formDirty || mutationUncertain
  );

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

  const filteredRecords = records.filter(item =>
    (
      !visibilityFilter ||
      String(item.is_visible) === visibilityFilter
    ) &&
    [
      item.full_name,
      item.member_code,
      item.accommodation_name,
      item.building_name,
      item.room_number,
      item.group_name,
    ].join(' ').toLowerCase().includes(
      recordSearch.toLowerCase()
    )
  );

  function updateField(
    field: keyof Form,
    value: string
  ) {
    setForm(current => ({
      ...current,
      [field]: value,
    }));
  }

  function toggleMember(id: number) {
    if (
      disabled ||
      lock.current ||
      !showForm ||
      editing ||
      !filteredMembers.some(
        member => member.member_id === id
      )
    ) return;
    setSelected(current =>
      current.includes(id)
        ? current.filter(item => item !== id)
        : current.length < 500
          ? [...current, id]
          : current
    );
  }

  function confirmDiscardForm(): boolean {
    return (
      !formDirty ||
      window.confirm(
        'Discard unsaved form changes?'
      )
    );
  }
  function refreshRecords() {
    if (loading || busy || lock.current) return;
    if (recoveryRequired.current) {
      if (!window.confirm(
        'The previous operation may have completed on the server. Refresh records to review the result? The current form will close only after a successful refresh.'
      )) return;
      void load(true);
      return;
    }
    if (!confirmDiscardForm()) return;
    void load(true);
  }
  function startCreate() {
    if (disabled || lock.current || showForm) return;
    formBaseline.current = { ...emptyForm };
    setEditing(null);
    setSelected([]);
    setForm({ ...emptyForm });
    setShowForm(true);
    setError('');
    setSuccess('');
  }

  function startEdit(item: AccommodationRecord) {
    if (
      disabled ||
      lock.current ||
      showForm ||
      !eligible(item.member_id)
    ) return;
    setEditing(item);
    setSelected([]);

    const initialForm: Form = {
      accommodation_name:
        item.accommodation_name || '',

      building_name:
        item.building_name || '',

      room_number:
        item.room_number || '',

      address:
        item.address || '',

      check_in_at:
        toISTInput(item.check_in_at),

      check_out_at:
        toISTInput(item.check_out_at),

      contact_person:
        item.contact_person || '',

      contact_phone:
        item.contact_phone || '',

      instructions:
        item.instructions || '',
    };

    formBaseline.current = { ...initialForm };
    setForm(initialForm);

    setShowForm(true);
    setError('');
    setSuccess('');
  }

  function closeForm() {
    formBaseline.current = { ...emptyForm };
    setShowForm(false);
    setEditing(null);
    setSelected([]);
    setForm({ ...emptyForm });
  }

  function eligible(memberId: number) {
    return members.some(
      member => member.member_id === memberId
    );
  }

  async function mutate(
    endpoint: string,
    method: string,
    body: unknown,
    message: string
  ) {
    if (
      lock.current ||
      disabled
    ) return;

    if (recoveryRequired.current) return;
    const releaseOperation = beginVolunteerOperation('Accommodation management');
    lock.current = true;

    setBusy(true);
    setError('');
    setSuccess('');

    try {
      const response = await volunteerRequest(
        endpoint,
        jsonRequest(method, body)
      );

      if (!mounted.current) return;

      setSuccess(response.message || message);

      closeForm();
      await load();
    } catch (error) {
      if (mounted.current) {
        recoveryRequired.current = true;
        setMutationUncertain(true);
        setError(
          'The operation could not be confirmed. It may have completed on the server. Refresh and review the records before retrying. Details: ' +
          getErrorMessage(error)
        );

        // A timed-out request could have
        // completed on the backend.
        setReady(false);
      }
    } finally {
      lock.current = false;
      releaseOperation();

      if (mounted.current) {
        setBusy(false);
      }
    }
  }

  async function save() {
    if (disabled || lock.current || !showForm) return;
    if (!form.accommodation_name.trim()) {
      setError('Accommodation name is required.');
      return;
    }

    if (
      !editing &&
      (
        !selected.length ||
        selected.length > 500 ||
        !selected.every(id =>
          eligible(id) &&
          filteredMembers.some(
            member => member.member_id === id
          )
        )
      )
    ) {
      setError(
        'Select between 1 and 500 eligible volunteers.'
      );

      return;
    }

    if (editing && !eligible(editing.member_id)) {
      setError(
        'This member is no longer eligible for accommodation changes.'
      );

      return;
    }

    const checkIn = toISTTimestamp(form.check_in_at);
    const checkOut = toISTTimestamp(form.check_out_at);

    if (
      (checkIn && Number.isNaN(Date.parse(checkIn))) ||
      (checkOut && Number.isNaN(Date.parse(checkOut)))
    ) {
      setError('Enter valid check-in and check-out dates.');
      return;
    }

    if (
      checkIn &&
      checkOut &&
      Date.parse(checkOut) <= Date.parse(checkIn)
    ) {
      setError(
        'Check-out must be after check-in.'
      );

      return;
    }

    if (
      form.contact_phone.trim() &&
      !/^\+?[0-9\s()-]{7,20}$/.test(
        form.contact_phone.trim()
      )
    ) {
      setError('Enter a valid contact phone number.');
      return;
    }

    const payload = {
      accommodation_name:
        form.accommodation_name.trim(),

      building_name:
        form.building_name.trim() || null,

      room_number:
        form.room_number.trim() || null,

      address:
        form.address.trim() || null,

      check_in_at: checkIn,
      check_out_at: checkOut,

      contact_person:
        form.contact_person.trim() || null,

      contact_phone:
        form.contact_phone.trim() || null,

      instructions:
        form.instructions.trim() || null,
    };

    const message = editing
      ? 'Save accommodation changes?'
      : `Allocate these accommodation details to ${selected.length} volunteer(s)?`;

    if (!window.confirm(message)) return;

    await mutate(
      editing
        ? `${base}/${editing.id}`
        : base,

      editing ? 'PUT' : 'POST',

      editing
        ? payload
        : {
            ...payload,
            member_ids: selected,
          },

      'Accommodation saved successfully'
    );
  }

  async function changeVisibility(
    item: AccommodationRecord
  ) {
    if (
      disabled ||
      lock.current ||
      showForm
    ) return;
    const visible = !item.is_visible;

    if (visible && !eligible(item.member_id)) {
      setError(
        'This volunteer is no longer eligible for publication.'
      );

      return;
    }

    if (!window.confirm(
      visible
        ? `Publish accommodation details for ${item.full_name}?`
        : `Hide accommodation details for ${item.full_name}?`
    )) return;

    await mutate(
      `${base}/${item.id}/visibility`,
      'PATCH',
      { is_visible: visible },
      visible
        ? 'Accommodation published'
        : 'Accommodation hidden'
    );
  }

  return (
    <>
      <div className="panel">
        <button
          type="button"
          disabled={loading || busy}
          onClick={refreshRecords}
        >
          {loading
            ? 'Loading...'
            : 'Refresh Records'}
        </button>

        <button
          className="primary"
          type="button"
          disabled={disabled || showForm}
          onClick={startCreate}
        >
          Allocate Accommodation
        </button>

        {mutationUncertain && (
          <div
            role="alert"
            style={{
              background: '#fff7ed',
              border: '1px solid #fdba74',
              borderRadius: 10,
              padding: 14,
              marginTop: 12,
              color: '#9a3412',
            }}
          >
            <strong>Server confirmation required</strong>
            <p>
              The previous operation may have completed.
              Do not submit it again until you refresh
              and review the latest records.
            </p>
            <button
              type="button"
              disabled={loading || busy}
              onClick={refreshRecords}
            >
              {loading
                ? 'Refreshing...'
                : 'Refresh and Review Records'}
            </button>
          </div>
        )}
        {formDirty && (
          <p
            role="status"
            style={{
              color: '#92400e',
              background: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: 8,
              padding: '10px 12px',
            }}
          >
            You have unsaved form changes.
            Save before leaving this workspace.
          </p>
        )}
        {error && (
          <p role="alert"
            style={{ color: '#b91c1c' }}>
            {error}
          </p>
        )}

        {success && (
          <p style={{ color: '#15803d' }}>
            {success}
          </p>
        )}

        {!ready && !loading && (
          <p>
            Refresh records before making
            further changes.
          </p>
        )}
      </div>

      {ready && (
        <>
          <div className="panel">
            <h3>Accommodation Summary</h3>

            <div style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 12,
            }}>
              {[
                ['Approved Volunteers', members.length],
                ['Total Allocations', records.length],
                ['Published', records.filter(
                  r => r.is_visible
                ).length],
                ['Hidden', records.filter(
                  r => !r.is_visible
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

          {showForm && (
            <div className="panel">
              <h3>
                {editing
                  ? 'Edit Accommodation'
                  : 'Allocate Accommodation'}
              </h3>

              <form onSubmit={e => {
                e.preventDefault();
                void save();
              }}>
                <fieldset
                  disabled={disabled}
                  style={{ border: 0, padding: 0 }}
                >
                  {editing ? (
                    <p>
                      Volunteer: {editing.full_name}
                    </p>
                  ) : (
                    <>
                      <input
                        placeholder="Search volunteer, mobile or group"
                        value={search}
                        onChange={e => {
                          setSearch(e.target.value);
                          setSelected([]);
                        }}
                      />

                      <p>
                        Selected: {selected.length} / 500
                      </p>

                      <button
                        type="button"
                        onClick={() =>
                          setSelected(
                            filteredMembers
                              .filter(m =>
                                m.accommodation_count === 0
                              )
                              .slice(0, 500)
                              .map(m => m.member_id)
                          )
                        }
                      >
                        Select Unallocated
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelected([])}
                      >
                        Clear Selection
                      </button>

                      <div style={{
                        overflowX: 'auto',
                        maxHeight: 350,
                        overflowY: 'auto',
                      }}>
                        <table>
                          <thead>
                            <tr>
                              <th>Select</th>
                              <th>Volunteer</th>
                              <th>Mobile</th>
                              <th>Existing Allocations</th>
                            </tr>
                          </thead>

                          <tbody>
                            {filteredMembers.map(member => (
                              <tr key={member.member_id}>
                                <td>
                                  <input
                                    type="checkbox"
                                    checked={selected.includes(
                                      member.member_id
                                    )}
                                    disabled={
                                      selected.length >= 500 &&
                                      !selected.includes(
                                        member.member_id
                                      )
                                    }
                                    onChange={() =>
                                      toggleMember(
                                        member.member_id
                                      )
                                    }
                                  />
                                </td>

                                <td>
                                  <strong>
                                    {member.full_name}
                                  </strong>

                                  <div>
                                    {member.member_code}
                                  </div>

                                  <small>
                                    {member.group_name ||
                                      member.registration_type}
                                  </small>
                                </td>

                                <td>{member.mobile}</td>

                                <td>
                                  {member.accommodation_count}
                                </td>
                              </tr>
                            ))}

                            {!filteredMembers.length && (
                              <tr>
                                <td colSpan={4}>
                                  No eligible volunteers.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fit, minmax(230px, 1fr))',
                    gap: 16,
                    marginTop: 20,
                  }}>
                    <label>
                      Accommodation Name *

                      <input
                        required
                        maxLength={255}
                        value={form.accommodation_name}
                        onChange={e =>
                          updateField(
                            'accommodation_name',
                            e.target.value
                          )
                        }
                      />
                    </label>

                    <label>
                      Building Name

                      <input
                        maxLength={255}
                        value={form.building_name}
                        onChange={e =>
                          updateField(
                            'building_name',
                            e.target.value
                          )
                        }
                      />
                    </label>

                    <label>
                      Room Number

                      <input
                        maxLength={100}
                        value={form.room_number}
                        onChange={e =>
                          updateField(
                            'room_number',
                            e.target.value
                          )
                        }
                      />
                    </label>

                    <label>
                      Check-in (IST)

                      <input
                        type="datetime-local"
                        step="1"
                        value={form.check_in_at}
                        onChange={e =>
                          updateField(
                            'check_in_at',
                            e.target.value
                          )
                        }
                      />
                    </label>

                    <label>
                      Check-out (IST)

                      <input
                        type="datetime-local"
                        step="1"
                        value={form.check_out_at}
                        onChange={e =>
                          updateField(
                            'check_out_at',
                            e.target.value
                          )
                        }
                      />
                    </label>

                    <label>
                      Contact Person

                      <input
                        maxLength={255}
                        value={form.contact_person}
                        onChange={e =>
                          updateField(
                            'contact_person',
                            e.target.value
                          )
                        }
                      />
                    </label>

                    <label>
                      Contact Phone

                      <input
                        type="tel"
                        maxLength={20}
                        value={form.contact_phone}
                        onChange={e =>
                          updateField(
                            'contact_phone',
                            e.target.value
                          )
                        }
                      />
                    </label>
                  </div>

                  <label>
                    Address

                    <textarea
                      maxLength={10000}
                      value={form.address}
                      onChange={e =>
                        updateField('address', e.target.value)
                      }
                    />
                  </label>

                  <label>
                    Accommodation Instructions

                    <textarea
                      maxLength={10000}
                      value={form.instructions}
                      onChange={e =>
                        updateField(
                          'instructions',
                          e.target.value
                        )
                      }
                    />
                  </label>

                  {!editing && (
                    <p>
                      New accommodation records
                      remain hidden until published.
                    </p>
                  )}

                  {editing?.is_visible && (
                    <p>
                      This record is already published.
                      Saved changes will be visible
                      to the volunteer.
                    </p>
                  )}

                  <button
                    className="primary"
                    type="submit"
                    disabled={
                      disabled ||
                      !form.accommodation_name.trim() ||
                      (!editing && !selected.length)
                    }
                  >
                    {busy
                      ? 'Saving...'
                      : editing
                        ? 'Save Changes'
                        : 'Save Allocation'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (busy || loading || lock.current) return;
                      if (confirmDiscardForm()) {
                        closeForm();
                      }
                    }}
                  >
                    Cancel
                  </button>
                </fieldset>
              </form>
            </div>
          )}

          <div className="panel">
            <h3>Accommodation Records</h3>

            <input
              placeholder="Search volunteer, building or room"
              value={recordSearch}
              onChange={e =>
                setRecordSearch(e.target.value)
              }
            />

            <select
              value={visibilityFilter}
              onChange={e =>
                setVisibilityFilter(e.target.value)
              }
            >
              <option value="">All Records</option>
              <option value="true">Published</option>
              <option value="false">Hidden</option>
            </select>

            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Volunteer</th>
                    <th>Accommodation</th>
                    <th>Check-in / Out</th>
                    <th>Contact</th>
                    <th>Visibility</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRecords.map(item => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.full_name}</strong>

                        <div>{item.member_code}</div>

                        <small>{item.mobile}</small>
                      </td>

                      <td>
                        <strong>
                          {item.accommodation_name}
                        </strong>

                        <div>{item.building_name}</div>

                        <div>
                          Room: {item.room_number || '-'}
                        </div>

                        <small>{item.address}</small>
                      </td>

                      <td>
                        <div>
                          In: {formatIST(item.check_in_at)}
                        </div>

                        <div>
                          Out: {formatIST(item.check_out_at)}
                        </div>
                      </td>

                      <td>
                        {item.contact_person || '-'}

                        <div>{item.contact_phone}</div>
                      </td>

                      <td>
                        <strong style={{
                          color: item.is_visible
                            ? '#15803d'
                            : '#b45309',
                        }}>
                          {item.is_visible
                            ? 'Published'
                            : 'Hidden'}
                        </strong>

                        {item.published_at && (
                          <div>
                            {formatIST(item.published_at)}
                          </div>
                        )}
                      </td>

                      <td>
                        <button
                          type="button"
                          disabled={
                            disabled ||
                            showForm ||
                            !eligible(item.member_id)
                          }
                          onClick={() =>
                            startEdit(item)
                          }
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          disabled={
                            disabled ||
                            showForm ||
                            (
                              !item.is_visible &&
                              !eligible(item.member_id)
                            )
                          }
                          onClick={() =>
                            void changeVisibility(item)
                          }
                        >
                          {item.is_visible
                            ? 'Hide'
                            : 'Publish'}
                        </button>
                      </td>
                    </tr>
                  ))}

                  {!filteredRecords.length && (
                    <tr>
                      <td colSpan={6}>
                        No accommodation records found.
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