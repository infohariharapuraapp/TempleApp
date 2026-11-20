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

interface Member {
  member_id: number;
  full_name: string;
  member_code: string;
  photo_url: string | null;
  photo_status: string;
  photo_revision: number;
  group_name: string | null;
  registration_type: string;
  existing_card_id: number | null;
  existing_card_status: string | null;
  valid_from: string;
  valid_until: string;
  total_assignments: number;
  can_issue: boolean;
}

function isPhotoVerified(member: Member): boolean {
  return (
    member.photo_status === 'verified' &&
    Number.isInteger(member.photo_revision) &&
    member.photo_revision > 0
  );
}
function photoStatusLabel(status: string): string {
  switch (status) {
    case 'missing':
      return 'Photograph required';
    case 'pending':
      return 'Awaiting verification';
    case 'correction_required':
      return 'Correction required';
    case 'resubmitted':
      return 'Awaiting re-verification';
    case 'verified':
      return 'Verified';
    default:
      return 'Verification required';
  }
}
interface Card {
  id: number;
  member_id: number;
  card_number: string;
  full_name: string;
  member_code: string;
  photo_url: string | null;
  programme_name: string;
  group_name: string | null;
  valid_from: string;
  valid_until: string;
  stored_status: string;
  effective_status: string;
  authorized_service_dates: string[];
  issued_at: string;
  issued_by_name: string | null;
  revocation_reason: string | null;
}

export default function IdCards({
  opportunities,
  selectedProgrammeId,
}: Props) {
  const selectedProgramme = opportunities.find(
    item => String(item.id) === selectedProgrammeId
  );
  const opportunityId = selectedProgramme
    ? String(selectedProgramme.id)
    : '';

  return (
    <section>
      <div className="panel">
        <h2>Volunteer ID Cards</h2>

        <p>
          Verify volunteer photographs and manage
          digital service identity cards.
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
        <CardManager
          key={opportunityId}
          opportunityId={opportunityId} opportunitiesMode={opportunities.find(item => String(item.id) === opportunityId)?.attendance_mode ?? "legacy"}
        />
      )}
    </section>
  );
}

function CardManager({ opportunitiesMode,
  opportunityId,
}: {
  opportunityId: string; opportunitiesMode: string;
}) {
  const base =
    `/opportunities/${opportunityId}/id-cards`;

  const [members, setMembers] =
    useState<Member[]>([]);

  const [cards, setCards] =
    useState<Card[]>([]);

  const [selected, setSelected] =
    useState<number[]>([]);

  const [verified, setVerified] =
    useState(false);

  const [search, setSearch] = useState('');

  const [cardSearch, setCardSearch] =
    useState('');

  const [statusFilter, setStatusFilter] =
    useState('');

  const [preview, setPreview] =
    useState<Card | null>(null);

  const [refreshCard, setRefreshCard] =
    useState<Card | null>(null);

  const [refreshVerified, setRefreshVerified] =
    useState(false);

  const [reactivate, setReactivate] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const lock = useRef(false);
  const version = useRef(0);
  const mounted = useRef(true);

  async function load() {
    const requestVersion = ++version.current;

    setLoading(true);
    setReady(false);
    setError('');
    setSelected([]);
    setVerified(false);
    setPreview(null);
    setRefreshCard(null);

    try {
      const [memberResponse, cardResponse] =
        await Promise.all([
          volunteerRequest<Member[]>(
            `${base}/eligible-members`
          ),
          volunteerRequest<Card[]>(base),
        ]);

      if (
        !mounted.current ||
        requestVersion !== version.current
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

  const disabled = loading || busy || !ready;

  const filteredMembers = members.filter(item =>
    [
      item.full_name,
      item.member_code,
      item.group_name || '',
    ].join(' ').toLowerCase().includes(
      search.toLowerCase()
    )
  );

  const filteredCards = cards.filter(item =>
    (!statusFilter ||
      item.effective_status === statusFilter) &&
    [
      item.full_name,
      item.member_code,
      item.card_number,
      item.group_name || '',
    ].join(' ').toLowerCase().includes(
      cardSearch.toLowerCase()
    )
  );

  function toggleMember(memberId: number) {
    setVerified(false);

    setSelected(current =>
      current.includes(memberId)
        ? current.filter(id => id !== memberId)
        : current.length < 500
          ? [...current, memberId]
          : current
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

    const releaseOperation = beginVolunteerOperation('Volunteer ID cards');
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
      }
    }
  }

  async function issueCards() {
    if (
      !verified ||
      !selected.length ||
      selected.length > 500 ||
      !selected.every(id =>
        members.some(member =>
          member.member_id === id &&
          member.can_issue &&
          isPhotoVerified(member)
        )
      )
    ) {
      setError(
        'Select eligible members and verify their photographs.'
      );

      return;
    }

    if (!window.confirm(
      `Issue ${selected.length} volunteer ID card(s)?`
    )) return;

    await mutate(
      base,
      'POST',
      {
        member_ids: selected,
        photos_verified: true,
        photo_revisions: Object.fromEntries(
          members
            .filter(member =>
              selected.includes(member.member_id)
            )
            .map(member => [
              String(member.member_id),
              member.photo_revision,
            ])
        ),
      },
      'ID cards issued successfully'
    );
  }

  async function revokeCard(card: Card) {
    const reason = window.prompt(
      `Revocation reason for ${card.full_name}:`
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
      'Revoke this volunteer ID card?'
    )) return;

    await mutate(
      `${base}/${card.id}/revoke`,
      'PATCH',
      {
        revocation_reason: reason.trim(),
      },
      'ID card revoked'
    );
  }

  async function submitRefresh() {
    if (
      !refreshCard ||
      !refreshVerified
    ) return;

    if (
      refreshCard.stored_status === 'revoked' &&
      !reactivate
    ) {
      setError(
        'Confirm reactivation of the revoked card.'
      );

      return;
    }

    const member = members.find(
      item => item.member_id === refreshCard.member_id
    );
    if (!member || !isPhotoVerified(member)) {
      setError(
        'Verify the volunteer photograph in Registrations before refreshing the ID card.'
      );
      return;
    }
    await mutate(
      `${base}/${refreshCard.id}/refresh`,
      'PATCH',
      {
        photo_verified: true,
        photo_revision: member.photo_revision,
        confirm_reactivation: reactivate,
      },
      'ID card refreshed successfully'
    );
  }

  return (
    <>
      <div className="panel">
        <button
          type="button"
          disabled={loading || busy}
          onClick={() => void load()}
        >
          {loading
            ? 'Loading...'
            : 'Refresh Records'}
        </button>

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
            <h3>ID Card Summary</h3>
            <p style={{
              fontSize: 13,
              color: '#6B1720',
            }}>
              Photographs use temporary secure links.
              If a photograph becomes unavailable,
              use Refresh Records to reload it.
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 12,
            }}>
              {[
                ['Issued Cards', cards.length],
                ['Eligible to Issue', members.filter(
                  m => m.can_issue
                ).length],
                ['Active Today', cards.filter(
                  c => c.effective_status === 'active'
                ).length],
                ['Revoked', cards.filter(
                  c => c.stored_status === 'revoked'
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
            <h3>Issue Volunteer ID Cards</h3>
            <p style={{
              color: '#6B1720',
              background: '#FFFDF8',
              border: '1px solid #E8D8B8',
              borderRadius: 8,
              padding: 12,
            }}>
              Only volunteers with verified photographs
              can receive ID cards. Review photographs
              in the Registrations section.
            </p>

            <fieldset
              disabled={disabled}
              style={{ border: 0, padding: 0 }}
            >
              <input
                placeholder="Search volunteer or group"
                value={search}
                onChange={e =>
                  setSearch(e.target.value)
                }
              />

              <p>Selected: {selected.length}</p>

              <button
                type="button"
                onClick={() => {
                  setSelected([]);
                  setVerified(false);
                }}
              >
                Clear Selection
              </button>

              <div style={{
                overflowX: 'auto',
                maxHeight: 500,
                overflowY: 'auto',
              }}>
                <table>
                  <thead>
                    <tr>
                      <th>Select</th>
                      <th>Photo</th>
                      <th>Volunteer</th>
                      <th>Service Validity</th>
                      <th>Eligibility</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredMembers.map(item => (
                      <tr key={item.member_id}>
                        <td>
                          <input
                            type="checkbox" style={{ width: 18, height: 18, minWidth: 18, padding: 0, margin: 0, flexShrink: 0, accentColor: "#6B1720" }}
                            checked={selected.includes(
                              item.member_id
                            )}
                            disabled={
                              !item.can_issue ||
                              !isPhotoVerified(item) ||
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
                          {item.photo_url ? (
                            <a
                              href={item.photo_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <img
                                onError={event => {
                                  event.currentTarget.style.display = 'none';
                                  setError(
                                    'Photograph unavailable or expired. Use Refresh Records to reload securely.'
                                  );
                                }}
                                onLoad={event => {
                                  event.currentTarget.style.display = '';
                                }}
                                src={item.photo_url}
                                alt={item.full_name}
                                referrerPolicy="no-referrer"
                                style={{
                                  width: 65,
                                  height: 80,
                                  objectFit: 'cover',
                                  borderRadius: 6,
                                }}
                              />
                            </a>
                          ) : (
                            <small>Photo unavailable</small>
                          )}
                        </td>

                        <td>
                          <strong>{item.full_name}</strong>
                          <div style={{ fontSize: 11, overflowWrap: "anywhere", maxWidth: 220, marginTop: 4 }}>{item.member_code}</div>
                          <small>
                            {item.group_name ||
                              item.registration_type}
                          </small>
                        </td>

                        <td>
                          {formatServiceDate(
                            item.valid_from
                          )}

                          {' - '}

                          {formatServiceDate(
                            item.valid_until
                          )}

                          <div>
                            {item.total_assignments} {opportunitiesMode === "legacy" ? (item.total_assignments === 1 ? "duty" : "duties") : (item.total_assignments === 1 ? "service day" : "service days")}
                          </div>
                        </td>

                        <td>
                          {item.existing_card_id
                            ? 'Already issued'
                            : item.can_issue
                              ? 'Eligible'
                              : photoStatusLabel(item.photo_status)}
                        </td>
                      </tr>
                    ))}

                    {!filteredMembers.length && (
                      <tr>
                        <td colSpan={5}>
                          No eligible members found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <label style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="checkbox" style={{ width: 18, height: 18, minWidth: 18, padding: 0, margin: 0, flexShrink: 0, accentColor: "#6B1720" }}
                  checked={verified}
                  disabled={!selected.length}
                  onChange={e =>
                    setVerified(e.target.checked)
                  }
                />

                I confirm ID card issuance for volunteers
                with administrator-verified photographs.
              </label>

              <button
                className="primary"
                type="button"
                disabled={
                  !selected.length ||
                  !verified ||
                  disabled
                }
                onClick={() => void issueCards()}
              >
                {busy
                  ? 'Processing...'
                  : `Issue ${selected.length} ID Card(s)`}
              </button>
            </fieldset>
          </div>

          {preview && (
            <div className="panel">
              <h3>ID Card Preview</h3>

              <div style={{
                width: '100%',
                maxWidth: 340,
                margin: '20px auto',
                background: '#FFFDF8',
                border: '2px solid #C69A3A',
                borderRadius: 16,
                overflow: 'hidden',
                textAlign: 'center',
                color: '#6B1720',
              }}>
                <div style={{
                  background: '#6B1720',
                  color: '#ffffff',
                  padding: 18,
                }}>
                  <h3>Divyakshetra Hariharapura</h3>
                  <p>VOLUNTEER IDENTITY CARD</p>
                </div>

                <div style={{ padding: 20 }}>
                  {preview.photo_url && (
                    <img
                                onError={event => {
                                  event.currentTarget.style.display = 'none';
                                  setError(
                                    'Photograph unavailable or expired. Use Refresh Records to reload securely.'
                                  );
                                }}
                                onLoad={event => {
                                  event.currentTarget.style.display = '';
                                }}
                      src={preview.photo_url}
                      alt={preview.full_name}
                      referrerPolicy="no-referrer"
                      style={{
                        width: 110,
                        height: 135,
                        objectFit: 'cover',
                        border: '2px solid #C69A3A',
                        borderRadius: 8,
                      }}
                    />
                  )}

                  <h2>{preview.full_name}</h2>

                  <p>{preview.member_code}</p>

                  <strong>
                    {preview.programme_name}
                  </strong>

                  <p style={{
                    fontSize: 12,
                    overflowWrap: 'anywhere',
                  }}>
                    {preview.card_number}
                  </p>

                  <p>
                    Valid From:{' '}
                    {formatServiceDate(preview.valid_from)}
                  </p>

                  <p>
                    Valid Until:{' '}
                    {formatServiceDate(preview.valid_until)}
                  </p>

                  <strong>
                    {preview.effective_status
                      .replace(/_/g, ' ')
                      .toUpperCase()}
                  </strong>

                  <p>
                    Authorized Service Dates
                  </p>

                  {(preview.authorized_service_dates || [])
                    .map(date => (
                      <div key={date}>
                        {formatServiceDate(date)}
                      </div>
                    ))}
                </div>
              </div>

              <p>
                Administrative preview. Current
                server status determines card validity.
              </p>

              <button
                type="button"
                onClick={() => setPreview(null)}
              >
                Close Preview
              </button>
            </div>
          )}

          {refreshCard && (
            <div className="panel">
              <h3>
                {refreshCard.stored_status === 'revoked'
                  ? 'Reactivate ID Card'
                  : 'Refresh ID Card'}
              </h3>

              <p>{refreshCard.full_name}</p>

              {(() => {
                const member = members.find(
                  m => m.member_id === refreshCard.member_id
                );

                return member?.photo_url ? (
                  <a
                    href={member.photo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <img
                                onError={event => {
                                  event.currentTarget.style.display = 'none';
                                  setError(
                                    'Photograph unavailable or expired. Use Refresh Records to reload securely.'
                                  );
                                }}
                                onLoad={event => {
                                  event.currentTarget.style.display = '';
                                }} referrerPolicy="no-referrer"
                      src={member.photo_url}
                      alt={member.full_name}
                      style={{
                        width: 110,
                        height: 135,
                        objectFit: 'cover',
                      }}
                    />
                  </a>
                ) : (
                  <p>
                    Current eligible member photo
                    unavailable.
                  </p>
                );
              })()}

              <fieldset
                disabled={disabled}
                style={{ border: 0, padding: 0 }}
              >
                <label>
                  <input
                    type="checkbox" style={{ width: 18, height: 18, minWidth: 18, padding: 0, margin: 0, flexShrink: 0, accentColor: "#6B1720" }}
                    checked={refreshVerified}
                    disabled={!members.some(m =>
                      m.member_id === refreshCard.member_id &&
                      isPhotoVerified(m)
                    )}
                    onChange={e =>
                      setRefreshVerified(e.target.checked)
                    }
                  />

                  Current volunteer photograph verified.
                </label>

                {refreshCard.stored_status === 'revoked' && (
                  <label>
                    <input
                      type="checkbox" style={{ width: 18, height: 18, minWidth: 18, padding: 0, margin: 0, flexShrink: 0, accentColor: "#6B1720" }}
                      checked={reactivate}
                      onChange={e =>
                        setReactivate(e.target.checked)
                      }
                    />

                    Confirm reactivation of revoked ID card.
                  </label>
                )}

                <button
                  className="primary"
                  type="button"
                  disabled={
                    !refreshVerified ||
                    (
                      refreshCard.stored_status === 'revoked' &&
                      !reactivate
                    )
                  }
                  onClick={() => void submitRefresh()}
                >
                  Confirm Update
                </button>

                <button
                  type="button"
                  onClick={() => setRefreshCard(null)}
                >
                  Cancel
                </button>
              </fieldset>
            </div>
          )}

          <div className="panel">
            <h3>Issued ID Cards</h3>

            <input
              placeholder="Search cards or volunteers"
              value={cardSearch}
              onChange={e =>
                setCardSearch(e.target.value)
              }
            />

            <select
              value={statusFilter}
              onChange={e =>
                setStatusFilter(e.target.value)
              }
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="upcoming">Upcoming</option>
              <option value="inactive">Inactive</option>
              <option value="expired">Expired</option>
              <option value="revoked">Revoked</option>
              <option value="not_scheduled_today">
                Not Scheduled Today
              </option>
            </select>

            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Volunteer</th>
                    <th>Card Number</th>
                    <th>Validity</th>
                    <th>Status</th>
                    <th>Issued</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredCards.map(card => (
                    <tr key={card.id}>
                      <td>
                        <strong>{card.full_name}</strong>
                        <div>{card.member_code}</div>
                      </td>

                      <td style={{
                        minWidth: 160,
                        overflowWrap: 'anywhere',
                      }}>
                        {card.card_number}
                      </td>

                      <td>
                        {formatServiceDate(card.valid_from)}
                        {' - '}
                        {formatServiceDate(card.valid_until)}
                      </td>

                      <td>
                        {card.effective_status
                          .replace(/_/g, ' ')}

                        {card.revocation_reason && (
                          <div>
                            {card.revocation_reason}
                          </div>
                        )}
                      </td>

                      <td>
                        {formatIST(card.issued_at)}

                        <div>
                          {card.issued_by_name}
                        </div>
                      </td>

                      <td>
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            setPreview(card);
                            setRefreshCard(null);
                          }}
                        >
                          Preview
                        </button>

                        <button
                          type="button"
                          disabled={
                            disabled ||
                            !members.some(m =>
                              m.member_id === card.member_id &&
                              isPhotoVerified(m)
                            )
                          }
                          onClick={() => {
                            setRefreshCard(card);
                            setRefreshVerified(false);
                            setReactivate(false);
                            setPreview(null);
                          }}
                        >
                          {card.stored_status === 'revoked'
                            ? 'Reactivate'
                            : 'Refresh'}
                        </button>

                        {card.stored_status !== 'revoked' && (
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() =>
                              void revokeCard(card)
                            }
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}

                  {!filteredCards.length && (
                    <tr>
                      <td colSpan={6}>
                        No ID cards found.
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