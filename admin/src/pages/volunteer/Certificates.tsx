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
  formatServiceDate,
  formatIST,
  type VolunteerOpportunity,
} from '../../lib/volunteerApi';

import {
  API_BASE_URL,
  getAdminToken,
} from '../../lib/api';

interface Props {
  opportunities: VolunteerOpportunity[];
  selectedProgrammeId: string;
}

interface Member {
  member_id: number;
  full_name: string;
  member_code: string;
  group_name: string | null;
  certificate_id: number | null;
  certificate_status: string | null;
  can_create: boolean;
}

interface Form {
  certificate_title: string;
  certificate_message: string;
  signatory_name: string;
  signatory_designation: string;
}

interface Certificate {
  attendance_mode?: 'legacy' | 'simple' | 'detailed' | 'none';
  id: number;
  member_id: number;
  member_code: string;
  certificate_number: string;
  volunteer_name: string;
  programme_name: string;
  group_name: string | null;
  certificate_title: string;
  certificate_message: string | null;
  signatory_name: string | null;
  signatory_designation: string | null;
  service_start_date: string | null;
  service_end_date: string | null;
  total_service_days: number | null;
  total_service_hours: number | string | null;
  status: 'draft' | 'issued' | 'revoked';
  issued_at: string | null;
  issued_by_name: string | null;
  revoked_at: string | null;
  revocation_reason: string | null;
}

const emptyForm: Form = {
  certificate_title: 'Certificate of Appreciation',
  certificate_message: '',
  signatory_name: '',
  signatory_designation: '',
};

export default function Certificates({
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
        <h2>Volunteer Certificates</h2>

        <p>
          Create, review and issue certificates
          for completed volunteer service.
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
        <CertificateManager
          key={opportunityId}
          opportunityId={opportunityId}
          onWorking={setWorking}
        />
      )}
    </section>
  );
}

function CertificateManager({
  opportunityId,
  onWorking,
}: {
  opportunityId: string;
  onWorking: (value: boolean) => void;
}) {
  const base =
    `/opportunities/${opportunityId}/certificates`;

  const [members, setMembers] =
    useState<Member[]>([]);

  const [cards, setCards] =
    useState<Certificate[]>([]);

  const [selectedMembers, setSelectedMembers] =
    useState<number[]>([]);

  const [selectedCards, setSelectedCards] =
    useState<number[]>([]);

  const [form, setForm] =
    useState<Form>({ ...emptyForm });
  const formBaseline = useRef<Form>({
    ...emptyForm,
  });

  const [editing, setEditing] =
    useState<Certificate | null>(null);

  const [showForm, setShowForm] =
    useState(false);

  const [memberSearch, setMemberSearch] =
    useState('');

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [pdfUrl, setPdfUrl] = useState('');
  const [pdfName, setPdfName] = useState('');

  const latestPdf = useRef('');
  const mounted = useRef(true);
  const lock = useRef(false);
  const recoveryRequired = useRef(false);
  const [mutationUncertain, setMutationUncertain] =
    useState(false);
  const version = useRef(0);

  function closePreview() {
    if (latestPdf.current) {
      URL.revokeObjectURL(latestPdf.current);
      latestPdf.current = '';
    }

    setPdfUrl('');
    setPdfName('');
  }

  function closeForm() {
    formBaseline.current = { ...emptyForm };
    setShowForm(false);
    setEditing(null);
    setSelectedMembers([]);
    setForm({ ...emptyForm });
  }

  async function load(discardForm = false) {
    const current = ++version.current;

    setLoading(true);
    setReady(false);
    setError('');
    setSelectedCards([]);
    closePreview();

    try {
      const [memberResponse, cardResponse] =
        await Promise.all([
          volunteerRequest<Member[]>(
            `${base}/eligible-members`
          ),
          volunteerRequest<Certificate[]>(base),
        ]);

      if (
        !mounted.current ||
        current !== version.current
      ) return;

      if (
        !Array.isArray(memberResponse.data) ||
        !Array.isArray(cardResponse.data)
      ) {
        throw new Error('Invalid server response');
      }

      setMembers(memberResponse.data);
      setCards(cardResponse.data);
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

      if (latestPdf.current) {
        URL.revokeObjectURL(latestPdf.current);
        latestPdf.current = '';
      }
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
      (!editing && selectedMembers.length > 0)
    );
  useVolunteerUnsavedChanges(
    'Certificate draft form',
    formDirty || mutationUncertain
  );

  const filteredMembers = members.filter(item =>
    [
      item.full_name,
      item.member_code,
      item.group_name || '',
    ].join(' ').toLowerCase().includes(
      memberSearch.toLowerCase()
    )
  );

  const filteredCards = cards.filter(item =>
    (!filter || item.status === filter) &&
    [
      item.volunteer_name,
      item.member_code,
      item.certificate_number,
      item.group_name || '',
    ].join(' ').toLowerCase().includes(
      search.toLowerCase()
    )
  );

  function toggle(
    current: number[],
    id: number
  ): number[] {
    return current.includes(id)
      ? current.filter(item => item !== id)
      : current.length < 200
        ? [...current, id]
        : current;
  }

  function updateField(
    field: keyof Form,
    value: string
  ) {
    setForm(current => ({
      ...current,
      [field]: value,
    }));
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
    closePreview();
    setEditing(null);
    setSelectedMembers([]);
    setSelectedCards([]);
    setForm({ ...emptyForm });
    setShowForm(true);
    setError('');
    setSuccess('');
  }

  function startEdit(item: Certificate) {
    if (
      disabled ||
      lock.current ||
      showForm ||
      item.status !== 'draft'
    ) return;
    closePreview();
    setEditing(item);
    setSelectedMembers([]);
    setSelectedCards([]);

    const initialForm: Form = {
      certificate_title: item.certificate_title,
      certificate_message:
        item.certificate_message || '',
      signatory_name:
        item.signatory_name || '',
      signatory_designation:
        item.signatory_designation || '',
    };

    formBaseline.current = { ...initialForm };
    setForm(initialForm);

    setShowForm(true);
    setError('');
    setSuccess('');
  }

  function canIssue(item: Certificate) {
    return (
      item.status === 'draft' &&
      Boolean(item.signatory_name?.trim()) &&
      Boolean(item.signatory_designation?.trim())
    );
  }

  async function mutate(
    endpoint: string,
    method: string,
    body: unknown
  ) {
    if (lock.current || disabled) return;

    if (recoveryRequired.current) return;
    const releaseOperation = beginVolunteerOperation('Certificate management');
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

  async function save() {
    if (disabled || lock.current || !showForm) return;

    if (
      !form.certificate_title.trim() ||
      form.certificate_title.trim().length > 80 ||
      form.certificate_message.trim().length > 400 ||
      form.signatory_name.trim().length > 100 ||
      form.signatory_designation.trim().length > 120
    ) {
      setError('Check certificate text field limits.');
      return;
    }

    if (
      !editing &&
      (
        !selectedMembers.length ||
        selectedMembers.length > 200 ||
        !selectedMembers.every(id =>
          filteredMembers.some(
            member => member.member_id === id
          )
        ) ||
        !selectedMembers.every(id =>
          members.some(item =>
            item.member_id === id &&
            item.can_create
          )
        )
      )
    ) {
      setError('Select eligible volunteers.');
      return;
    }

    const payload = {
      certificate_title:
        form.certificate_title.trim(),

      certificate_message:
        form.certificate_message.trim() || null,

      signatory_name:
        form.signatory_name.trim() || null,

      signatory_designation:
        form.signatory_designation.trim() || null,
    };

    if (!window.confirm(
      editing
        ? 'Save changes to certificate draft?'
        : `Create ${selectedMembers.length} certificate draft(s)?`
    )) return;

    await mutate(
      editing ? `${base}/${editing.id}` : base,
      editing ? 'PUT' : 'POST',
      editing
        ? payload
        : {
            ...payload,
            member_ids: selectedMembers,
          }
    );
  }

  async function issue(ids: number[]) {
    if (
      disabled ||
      showForm ||
      !ids.length ||
      ids.length > 200 ||
      !ids.every(id =>
        cards.some(item =>
          item.id === id && canIssue(item)
        )
      )
    ) {
      setError(
        'Select draft certificates with complete signatory details.'
      );
      return;
    }

    if (!window.confirm(
      `Issue ${ids.length} certificate(s)? Confirm that all certificate details and authorized signatory information have been reviewed. Issued certificates cannot be edited.`
    )) return;

    await mutate(`${base}/issue`, 'POST', {
      certificate_ids: ids,
      confirm_issue: true,
    });
  }

  async function revoke(item: Certificate) {
    if (
      disabled ||
      showForm ||
      item.status === 'revoked'
    ) return;

    const reason = window.prompt(
      `Reason for withdrawing/revoking the certificate of ${item.volunteer_name}:`
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
      'WARNING: Revoked certificates cannot currently be restored or reissued. Continue?'
    )) return;

    await mutate(
      `${base}/${item.id}/revoke`,
      'PATCH',
      {
        revocation_reason: reason.trim(),
      }
    );
  }

  async function preview(item: Certificate) {
    if (lock.current || disabled || showForm) return;

    const token = getAdminToken();

    if (!token) {
      setError(
        'Admin session expired. Please sign in again.'
      );
      return;
    }

    const releaseOperation = beginVolunteerOperation('Certificate management');
    lock.current = true;

    setBusy(true);
    onWorking(true);
    setError('');
    closePreview();

    const controller = new AbortController();

    const timer = window.setTimeout(
      () => controller.abort(),
      60000
    );

    try {
      const response = await fetch(
        `${API_BASE_URL}/admin/volunteer${base}/${item.id}/preview`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/pdf',
          },
          cache: 'no-store',
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        const data =
          await response.json().catch(() => ({}));

        throw new Error(
          data.message || 'Unable to preview certificate'
        );
      }

      const blob = await response.blob();

      if (
        !blob.type.includes('application/pdf') ||
        !blob.size
      ) {
        throw new Error(
          'Server did not return a valid PDF.'
        );
      }

      if (!mounted.current) return;

      const url = URL.createObjectURL(blob);

      latestPdf.current = url;

      setPdfUrl(url);
      setPdfName(item.certificate_number);
    } catch (error) {
      if (mounted.current) {
        setError(
          controller.signal.aborted
            ? 'PDF preview timed out. Please retry.'
            : getErrorMessage(error)
        );
      }
    } finally {
      window.clearTimeout(timer);
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
          onClick={refreshRecords}
        >
          {loading ? 'Loading...' : 'Refresh Records'}
        </button>

        <button
          className="primary"
          type="button"
          disabled={disabled || showForm}
          onClick={startCreate}
        >
          Create Certificate Drafts
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
          <p>
            Refresh records before making further changes.
          </p>
        )}
      </div>

      {ready && (
        <>
          <div className="panel">
            <h3>Certificate Summary</h3>

            <div style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 12,
            }}>
              {[
                ['Eligible Volunteers', members.filter(
                  item => item.can_create
                ).length],
                ['Drafts', cards.filter(
                  item => item.status === 'draft'
                ).length],
                ['Issued', cards.filter(
                  item => item.status === 'issued'
                ).length],
                ['Revoked', cards.filter(
                  item => item.status === 'revoked'
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
                  ? 'Edit Certificate Draft'
                  : 'Create Certificate Drafts'}
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
                      Volunteer: {editing.volunteer_name}
                    </p>
                  ) : (
                    <>
                      <input
                        placeholder="Search completed volunteers"
                        value={memberSearch}
                        onChange={e => {
                          setMemberSearch(e.target.value);
                          setSelectedMembers([]);
                        }}
                      />

                      <p>
                        Selected: {selectedMembers.length} / 200
                      </p>

                      <button
                        type="button"
                        onClick={() =>
                          setSelectedMembers(
                            filteredMembers
                              .filter(item => item.can_create)
                              .slice(0, 200)
                              .map(item => item.member_id)
                          )
                        }
                      >
                        Select Eligible (Filtered)
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedMembers([])}
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
                              <th>Certificate Status</th>
                            </tr>
                          </thead>

                          <tbody>
                            {filteredMembers.map(item => (
                              <tr key={item.member_id}>
                                <td>
                                  <input
                                    type="checkbox"
                                    checked={selectedMembers.includes(
                                      item.member_id
                                    )}
                                    disabled={
                                      !item.can_create ||
                                      (
                                        selectedMembers.length >= 200 &&
                                        !selectedMembers.includes(
                                          item.member_id
                                        )
                                      )
                                    }
                                    onChange={() =>
                                      setSelectedMembers(current =>
                                        toggle(
                                          current,
                                          item.member_id
                                        )
                                      )
                                    }
                                  />
                                </td>

                                <td>
                                  <strong>{item.full_name}</strong>
                                  <div>{item.member_code}</div>
                                  <small>{item.group_name}</small>
                                </td>

                                <td>
                                  {item.can_create
                                    ? 'Eligible'
                                    : item.certificate_status ||
                                      'Already created'}
                                </td>
                              </tr>
                            ))}

                            {!filteredMembers.length && (
                              <tr>
                                <td colSpan={3}>
                                  No completed volunteers found.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  <label>
                    Certificate Title *

                    <input
                      required
                      maxLength={80}
                      value={form.certificate_title}
                      onChange={e =>
                        updateField(
                          'certificate_title',
                          e.target.value
                        )
                      }
                    />
                  </label>

                  <label>
                    Certificate Message

                    <textarea
                      maxLength={400}
                      value={form.certificate_message}
                      onChange={e =>
                        updateField(
                          'certificate_message',
                          e.target.value
                        )
                      }
                    />

                    <small>
                      {form.certificate_message.length}/400
                    </small>
                  </label>

                  <label>
                    Authorized Signatory Name

                    <input
                      maxLength={100}
                      value={form.signatory_name}
                      onChange={e =>
                        updateField(
                          'signatory_name',
                          e.target.value
                        )
                      }
                    />
                  </label>

                  <label>
                    Signatory Designation

                    <input
                      maxLength={120}
                      value={form.signatory_designation}
                      onChange={e =>
                        updateField(
                          'signatory_designation',
                          e.target.value
                        )
                      }
                    />
                  </label>

                  <p>
                    Signatory information is mandatory
                    before issuing a certificate.
                  </p>

                  <p>
                    Volunteer name, programme name,
                    service dates and total service
                    hours are calculated by the server.
                  </p>

                  <button
                    className="primary"
                    type="submit"
                    disabled={
                      disabled ||
                      !form.certificate_title.trim() ||
                      (!editing && !selectedMembers.length)
                    }
                  >
                    {busy
                      ? 'Saving...'
                      : editing
                        ? 'Save Draft'
                        : 'Create Drafts'}
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

          {pdfUrl && (
            <div className="panel">
              <h3>Certificate PDF Preview</h3>

              <p style={{ overflowWrap: 'anywhere' }}>
                {pdfName}
              </p>

              <iframe
                title="Volunteer Certificate Preview"
                src={pdfUrl}
                style={{
                  width: '100%',
                  height: 650,
                  border: '1px solid #ddd',
                  borderRadius: 8,
                }}
              />

              <p>
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open PDF in new tab
                </a>
              </p>

              <button
                type="button"
                onClick={closePreview}
              >
                Close Preview
              </button>
            </div>
          )}

          <div className="panel">
            <h3>Manage Certificates</h3>

            <input
              placeholder="Search certificates or volunteers"
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setSelectedCards([]);
              }}
            />

            <select
              value={filter}
              onChange={e => {
                setFilter(e.target.value);
                setSelectedCards([]);
              }}
            >
              <option value="">All Certificates</option>
              <option value="draft">Draft</option>
              <option value="issued">Issued</option>
              <option value="revoked">Revoked</option>
            </select>

            <p>
              Selected for issuance: {selectedCards.length} / 200
            </p>

            <button
              type="button"
              disabled={disabled || showForm}
              onClick={() =>
                setSelectedCards(
                  filteredCards
                    .filter(canIssue)
                    .slice(0, 200)
                    .map(item => item.id)
                )
              }
            >
              Select Issuable Drafts (Filtered)
            </button>

            <button
              type="button"
              disabled={disabled || showForm}
              onClick={() => setSelectedCards([])}
            >
              Clear Selection
            </button>

            <button
              className="primary"
              type="button"
              disabled={
                disabled ||
                showForm ||
                !selectedCards.length
              }
              onClick={() => {
                if (disabled || showForm || lock.current) return;
                const visibleIds = selectedCards.filter(id =>
                  filteredCards.some(
                    card =>
                      card.id === id &&
                      card.status === 'draft'
                  )
                );
                if (visibleIds.length !== selectedCards.length) {
                  setSelectedCards(visibleIds);
                  setError(
                    'Selection changed. Review the visible certificates before issuing.'
                  );
                  return;
                }
                if (!visibleIds.length) return;
                void issue(visibleIds);
              }}
            >
              {busy
                ? 'Processing...'
                : `Issue ${selectedCards.length} Certificate(s)`}
            </button>

            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Select</th>
                    <th>Volunteer</th>
                    <th>Certificate</th>
                    <th>Service</th>
                    <th>Signatory</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredCards.map(item => (
                    <tr key={item.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedCards.includes(
                            item.id
                          )}
                          disabled={
                            disabled ||
                            showForm ||
                            !canIssue(item) ||
                            (
                              selectedCards.length >= 200 &&
                              !selectedCards.includes(item.id)
                            )
                          }
                          onChange={() =>
                            setSelectedCards(current =>
                              toggle(current, item.id)
                            )
                          }
                        />
                      </td>

                      <td>
                        <strong>{item.volunteer_name}</strong>
                        <div>{item.member_code}</div>
                        <small>{item.group_name}</small>
                      </td>

                      <td style={{
                        maxWidth: 250,
                        overflowWrap: 'anywhere',
                      }}>
                        <strong>
                          {item.certificate_title}
                        </strong>

                        <div>{item.certificate_number}</div>
                        <small>{item.programme_name}</small>
                      </td>

                      <td>
                        {item.attendance_mode === 'none' ? (
                          <>
                            <div>Manually verified service</div>
                            <small>Attendance statistics not required</small>
                          </>
                        ) : (
                          <>
                            {item.service_start_date &&
                             item.service_end_date && (
                              <div>
                                {formatServiceDate(item.service_start_date)}
                                {' - '}
                                {formatServiceDate(item.service_end_date)}
                              </div>
                            )}
                            {item.total_service_days != null && (
                              <div>
                                {item.total_service_days} days
                              </div>
                            )}
                            {item.attendance_mode !== 'simple' &&
                             item.total_service_hours != null && (
                              <div>
                                {item.total_service_hours}
                                {' '}
                                {item.attendance_mode === 'detailed'
                                  ? 'actual hours'
                                  : 'scheduled hours'}
                              </div>
                            )}
                          </>
                        )}
                      </td>

                      <td>
                        {item.signatory_name || 'Not provided'}
                        <div>{item.signatory_designation}</div>
                      </td>

                      <td>
                        <strong style={{
                          color:
                            item.status === 'issued'
                              ? '#15803d'
                              : item.status === 'revoked'
                                ? '#b91c1c'
                                : '#b45309',
                        }}>
                          {item.status.toUpperCase()}
                        </strong>

                        {item.issued_at && (
                          <div>
                            {formatIST(item.issued_at)}
                          </div>
                        )}

                        {item.revocation_reason && (
                          <div>{item.revocation_reason}</div>
                        )}
                      </td>

                      <td>
                        <button
                          type="button"
                          disabled={disabled || showForm}
                          onClick={() => void preview(item)}
                        >
                          Preview PDF
                        </button>

                        {item.status === 'draft' && (
                          <>
                            <button
                              type="button"
                              disabled={disabled || showForm}
                              onClick={() => startEdit(item)}
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              disabled={
                                disabled ||
                                showForm ||
                                !canIssue(item)
                              }
                              onClick={() => void issue([item.id])}
                            >
                              Issue
                            </button>
                          </>
                        )}

                        {item.status !== 'revoked' && (
                          <button
                            type="button"
                            disabled={disabled || showForm}
                            onClick={() => void revoke(item)}
                          >
                            {item.status === 'draft'
                              ? 'Withdraw'
                              : 'Revoke'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}

                  {!filteredCards.length && (
                    <tr>
                      <td colSpan={7}>
                        No certificates found.
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