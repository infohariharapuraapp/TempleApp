import VolunteerPhotoManagement from '@/components/volunteer/VolunteerPhotoManagement';
import VolunteerDailyService from '@/components/volunteer/VolunteerDailyService';
import volunteerI18n from '@/localization/i18n';
import React, {
  useCallback,
  useRef,
  useState,
} from 'react';

import {
  Alert,
  Image,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  router,
  useFocusEffect,
  useLocalSearchParams,
} from 'expo-router';

import { useTranslation } from 'react-i18next';

import {
  getVolunteerRegistrationDetails,
  getVolunteerError,
  formatVolunteerDate,
  formatVolunteerDateTime,
  formatVolunteerTime,
} from '@/services/volunteerApi';


import {
  downloadVolunteerCertificate,
} from '@/services/volunteerCertificate';


import type {
  VolunteerRegistrationDetails,
  VolunteerSevaMember,
  VolunteerDutyAssignment,
} from '@/services/volunteerApi';

import { ApiError } from '@/services/api';

import {
  VOLUNTEER_COLORS as C,
  VolunteerScreen,
  VolunteerCover,
  VolunteerStatusBadge,
  VolunteerLoading,
  VolunteerError,
  VolunteerInfo,
  VolunteerButton,
} from '@/components/volunteer/VolunteerUI';

import VolunteerReporting from '@/components/volunteer/VolunteerReporting';

type Section =
  | 'overview'
  | 'availability'
  | 'reporting'
  | 'duties'
  | 'idcard'
  | 'accommodation'
  | 'attendance'
  | 'certificate';

const SECTIONS: {
  id: Section;
  label: string;
  icon: string;
}[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: '🙏',
  },
  {
    id: 'availability',
    label: 'Availability',
    icon: '📅',
  },
  {
    id: 'reporting',
    label: 'Daily Reporting',
    icon: '📍',
  },
  {
    id: 'duties',
    label: 'Assigned Duties',
    icon: '📋',
  },
  {
    id: 'idcard',
    label: 'Digital ID Card',
    icon: '🪪',
  },
  {
    id: 'accommodation',
    label: 'Accommodation',
    icon: '🏠',
  },
  {
    id: 'attendance',
    label: 'Attendance',
    icon: '✓',
  },
  {
    id: 'certificate',
    label: 'Certificate',
    icon: '🏅',
  },
];

function readableStatus(value?: string | null) {
  if (!value) return '-';
  const statusKey = `volunteer.status.${value}`;
  if (volunteerI18n.exists(statusKey)) {
    return volunteerI18n.t(statusKey);
  }
  const key = `volunteer.${value}`;
  if (volunteerI18n.exists(key)) {
    return volunteerI18n.t(key);
  }

  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, letter =>
      letter.toUpperCase()
    );
}

function displayDateTime(value?: string | null) {
  return value
    ? `${formatVolunteerDateTime(value)} IST`
    : '-';
}

async function callContact(phone: string) {
  const normalized = phone.replace(/[\s()-]/g, '');

  if (!/^\+?[0-9]{7,20}$/.test(normalized)) {
    Alert.alert(
      volunteerI18n.t('volunteer.contactUnavailable'),
      volunteerI18n.t('volunteer.invalidPhone')
    );

    return;
  }

  try {
    await Linking.openURL(`tel:${normalized}`);
  } catch {
    Alert.alert(
      volunteerI18n.t('volunteer.unableToOpenPhone'),
      `Please dial ${phone} manually.`
    );
  }
}

export default function RegistrationDetailsScreen() {
  const { t, i18n } = useTranslation();

  const params = useLocalSearchParams<{
    registrationId: string;
  }>();

  const rawId =
    typeof params.registrationId === 'string'
      ? params.registrationId
      : '';

  const id = Number(rawId);

  const [data, setData] =
    useState<VolunteerRegistrationDetails | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState('');

  const [loginRequired, setLoginRequired] =
    useState(false);

  const [selectedMemberId, setSelectedMemberId] =
    useState<number | null>(null);

  const [section, setSection] =
    useState<Section>('overview');

  const version = useRef(0);
  const photoLock = useRef(false);
  const [photoBusy, setPhotoBusy] =
    useState(false);
  const [photoRefreshKey, setPhotoRefreshKey] =
    useState(0);
  function handlePhotoBusy(busy: boolean) {
    photoLock.current = busy;
    setPhotoBusy(busy);
  }

  const load = useCallback(
    async (refresh = false) => {
      const requestVersion = ++version.current;

      setError('');
      setLoginRequired(false);

      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
        setData(null);
      }

      try {
        if (
          !/^[1-9]\d*$/.test(rawId) ||
          !Number.isSafeInteger(id) ||
          id > 2147483647
        ) {
          throw new ApiError(
            'Invalid registration ID.',
            400
          );
        }

        const result =
          await getVolunteerRegistrationDetails(id);

        if (requestVersion !== version.current) {
          return;
        }

        setData(result);

        setSelectedMemberId(previous => {
          const available =
            result.members.some(
              member => member.id === previous
            );

          return available
            ? previous
            : result.members[0]?.id ?? null;
        });
      } catch (err) {
        if (requestVersion !== version.current) {
          return;
        }

        setData(null);

        setLoginRequired(
          err instanceof ApiError &&
          err.status === 401
        );

        setError(getVolunteerError(err));
      } finally {
        if (requestVersion === version.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [id, rawId]
  );

  useFocusEffect(
    useCallback(() => {
      photoLock.current = false;
      setPhotoBusy(false);
      void load();
      return () => {
        version.current++;
        photoLock.current = false;
      };
    }, [load, i18n.language])
  );

  const registration = data?.registration;

  const member =
    data?.members.find(
      item => item.id === selectedMemberId
    ) ?? data?.members[0];

  const nextDuty = data?.next_duty;
  async function refreshPhotoDetails() {
    await load(true);
    setPhotoRefreshKey(previous => previous + 1);
  }

  return (
    <VolunteerScreen
      title={t(
        'bookingScreens.registrationDetails',
        'Registration Details'
      )}
    >
      {loading ? (
        <VolunteerLoading />
      ) : error || !data || !registration ? (
        <View style={styles.content}>
          <VolunteerError
            message={
              error ||
              'Registration details are unavailable.'
            }
            onRetry={() => void load()}
          />

          {loginRequired && (
            <VolunteerButton
              title={volunteerI18n.t('volunteer.login')}
              onPress={() => router.push('/login')}
            />
          )}
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                if (!photoLock.current) {
                  void load(true);
                }
              }}
              enabled={!photoBusy}
              colors={[C.maroon]}
              tintColor={C.maroon}
            />
          }
        >
          <View style={styles.hero}>
            <VolunteerCover
              uri={registration.image_url}
            />

            <View style={styles.heroBody}>
              <VolunteerStatusBadge
                status={registration.status}
              />

              <Text style={styles.heroTitle}>
                {registration.programme_name}
              </Text>

              <Text selectable style={styles.heroCode}>
                {registration.registration_code}
              </Text>

              <Text style={styles.heroDescription}>
                {registration.registration_type ===
                'group'
                  ? 'Group Volunteer Seva'
                  : 'Individual Volunteer Seva'}
              </Text>

              {!!registration.group_name && (
                <Text style={styles.heroDescription}>
                  {registration.group_name}
                </Text>
              )}

              <Text style={styles.heroDescription}>
                {formatVolunteerDate(
                  registration.service_start_date
                )}
                {' - '}
                {formatVolunteerDate(
                  registration.service_end_date
                )}
              </Text>
            </View>
          </View>

          {registration.status === 'pending' && (
            <Message
              title={volunteerI18n.t('volunteer.awaitingApproval')}
              message={volunteerI18n.t('volunteer.registrationReceived')}
            />
          )}

          {registration.status === 'rejected' && (
            <Message
              title={volunteerI18n.t('volunteer.registrationRejected')}
              message={
                registration.rejection_reason ||
                volunteerI18n.t('volunteer.notApproved')
              }
              danger
            />
          )}

          {registration.status === 'cancelled' && (
            <Message
              title={volunteerI18n.t('volunteer.registrationCancelled')}
              message={volunteerI18n.t('volunteer.registrationInactive')}
              danger
            />
          )}

          <View style={styles.statsRow}>
            <Stat
              label={volunteerI18n.t('volunteer.volunteers')}
              value={data.stats.total_members}
            />

            <Stat
              label={volunteerI18n.t('volunteer.duties')}
              value={data.stats.total_assignments}
            />

            <Stat
              label={volunteerI18n.t('volunteer.certificates')}
              value={data.stats.certificates_issued}
            />
          </View>

          {!!nextDuty && (
            <View style={styles.nextDuty}>
              <Text style={styles.nextLabel}>
                {volunteerI18n.t('volunteer.nextDuty')}
              </Text>

              <Text style={styles.nextTitle}>
                {nextDuty.duty_name}
              </Text>

              <Text style={styles.description}>
                Volunteer: {nextDuty.volunteer_name}
              </Text>

              <Text style={styles.description}>
                {formatVolunteerDate(
                  nextDuty.service_date
                )}
                {' | '}
                {formatVolunteerTime(
                  nextDuty.start_time
                )}
                {' IST'}
              </Text>

              {!!nextDuty.reporting_location && (
                <Text style={styles.description}>
                  Reporting: {nextDuty.reporting_location}
                </Text>
              )}
            </View>
          )}

          {data.members.length > 1 && (
            <View style={styles.panel}>
              <Text style={styles.heading}>
                {volunteerI18n.t('volunteer.selectVolunteer')}
              </Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
              >
                {data.members.map(item => (
                  <TouchableOpacity
                    key={item.id}
                    accessibilityRole="button"
                    accessibilityState={{
                      selected:
                        member?.id === item.id,
                    }}
                    disabled={photoBusy || refreshing}
                    onPress={() => {
                      if (!photoLock.current) {
                        setSelectedMemberId(item.id);
                      }
                    }}
                    style={[
                      styles.memberOption,
                      member?.id === item.id &&
                        styles.memberSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.memberOptionText,
                        member?.id === item.id &&
                          styles.selectedText,
                      ]}
                    >
                      {item.is_team_leader ? '★ ' : ''}
                      {item.full_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {!!member && (
            <View style={styles.panel}>
              <Text style={styles.smallLabel}>
                {volunteerI18n.t('volunteer.selectedVolunteer')}
              </Text>

              <Text style={styles.memberName}>
                {member.full_name}
              </Text>

              <Text selectable style={styles.description}>
                {member.member_code}
              </Text>

              {!!member.is_team_leader && (
                <Text style={styles.goldText}>
                  {volunteerI18n.t('volunteer.groupLeader')}
                </Text>
              )}

              <Text style={styles.description}>
                Status: {readableStatus(member.status)}
              </Text>
            </View>
          )}

          {!!member && (
            <VolunteerPhotoManagement
              key={`${id}-${member.id}-${member.photo_revision ?? 0}-${member.photo_status ?? 'unknown'}-${photoRefreshKey}`}
              registrationId={id}
              opportunityId={registration.opportunity_id}
              member={member}
              disabled={refreshing}
              onBusyChange={handlePhotoBusy}
              onRefresh={refreshPhotoDetails}
            />
          )}
          <View style={styles.navigationGrid}>
            {SECTIONS.filter(item => {
      if (!member?.attendance_mode ||
          member.attendance_mode === 'legacy') {
        return true;
      }
      if (item.id === 'duties') {
        return (
          member.assignments.length > 0 ||
          section === 'duties'
        );
      }
      return true;
    }).map(item => (
              <TouchableOpacity
                key={item.id}
                accessibilityRole="button"
                accessibilityState={{
                  selected: section === item.id,
                }}
                onPress={() =>
                  setSection(item.id)
                }
                style={[
                  styles.navigationItem,
                  section === item.id &&
                    styles.navigationSelected,
                ]}
              >
                <Text style={styles.navigationIcon}>
                  {item.icon}
                </Text>

                <Text
                  style={[
                    styles.navigationLabel,
                    section === item.id &&
                      styles.selectedText,
                  ]}
                >
                  {item.id === 'availability' &&
      member?.attendance_mode &&
      member.attendance_mode !== 'legacy'
      ? t(
          'volunteer.selectedServiceDates',
          'Selected Service Dates'
        )
      : item.id === 'attendance' &&
        member?.attendance_mode === 'none'
        ? t(
            'volunteer.dailyServiceProgress',
            'Service Progress'
          )
        : t(
            'volunteer.sections.' + item.id,
            item.label
          )}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {section === 'reporting' && !!member && (
            <VolunteerReporting
              key={`${id}-${member.id}`}
              registrationId={id}
              memberId={member.id}
              programmeName={registration.programme_name}
              registrationStatus={registration.status}
            />
          )}
          {section === 'overview' && (
            <View style={styles.panel}>
              <Text style={styles.heading}>
                {volunteerI18n.t('volunteer.registrationInformation')}
              </Text>

              <VolunteerInfo
                label={volunteerI18n.t('volunteer.registrationType')}
                value={readableStatus(
                  registration.registration_type
                )}
              />

              <VolunteerInfo
                label={volunteerI18n.t('volunteer.approvalStatus')}
                value={readableStatus(
                  registration.status
                )}
              />

              <VolunteerInfo
                label={volunteerI18n.t('volunteer.registeredOn')}
                value={displayDateTime(
                  registration.created_at
                )}
              />

              <VolunteerInfo
                label={volunteerI18n.t('volunteer.totalVolunteers')}
                value={registration.total_members}
              />

              <VolunteerInfo
                label={volunteerI18n.t('volunteer.approvedVolunteers')}
                value={data.stats.approved_members}
              />

              <VolunteerInfo
                label={volunteerI18n.t('volunteer.completedVolunteers')}
                value={data.stats.completed_members}
              />

              {!!registration.reviewed_at && (
                <VolunteerInfo
                  label={volunteerI18n.t('volunteer.reviewedOn')}
                  value={displayDateTime(
                    registration.reviewed_at
                  )}
                />
              )}

              {!!registration.completed_at && (
                <VolunteerInfo
                  label={volunteerI18n.t('volunteer.completedOn')}
                  value={displayDateTime(
                    registration.completed_at
                  )}
                />
              )}

              {!!registration.devotee_remarks && (
                <InfoText
                  label={volunteerI18n.t('volunteer.registrationRemarks')}
                  value={registration.devotee_remarks}
                />
              )}

              {!!registration.instructions && (
                <InfoText
                  label={volunteerI18n.t('volunteer.importantInstructions')}
                  value={registration.instructions}
                />
              )}

              {!!registration.description && (
                <InfoText
                  label={volunteerI18n.t('volunteer.aboutProgramme')}
                  value={registration.description}
                />
              )}
            </View>
          )}

          {section !== 'overview' && !member && (
            <Message
              title={volunteerI18n.t('volunteer.noVolunteerDetails')}
              message={volunteerI18n.t('volunteer.volunteerUnavailable')}
            />
          )}

          {!!member && section === 'availability' && (
            member.attendance_mode &&
    member.attendance_mode !== 'legacy' ? (
      <VolunteerDailyService
        member={member}
        section="availability"
      />
    ) : (
      <AvailabilitySection member={member} />
    )
          )}

          {!!member && section === 'duties' && (
            <DutiesSection member={member} />
          )}

          {!!member && section === 'idcard' && (
            <IDCardSection
              member={member}
              refreshing={refreshing}
              onRefresh={() => {
                if (!photoLock.current && !refreshing) {
                  void load(true);
                }
              }}
            />
          )}

          {!!member && section === 'accommodation' && (
            <AccommodationSection member={member} />
          )}

          {!!member && section === 'attendance' && (
            member.attendance_mode &&
    member.attendance_mode !== 'legacy' ? (
      <VolunteerDailyService
        member={member}
        section="attendance"
      />
    ) : (
      <AttendanceSection member={member} />
    )
          )}

          {!!member && section === 'certificate' && (
            <CertificateSection member={member} />
          )}

          <Text style={styles.footer}>
            {volunteerI18n.t('volunteer.refreshNote')}
          </Text>
        </ScrollView>
      )}
    </VolunteerScreen>
  );
}

// ========================================
// AVAILABILITY
// ========================================

function AvailabilitySection({
  member,
}: {
  member: VolunteerSevaMember;
}) {
  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>
        {volunteerI18n.t('volunteer.selectedAvailability')}
      </Text>

      <Text style={styles.description}>
        {volunteerI18n.t('volunteer.availabilityNote')}
      </Text>

      {!member.availability.length && (
        <Text style={styles.description}>
          {volunteerI18n.t('volunteer.noAvailability')}
        </Text>
      )}

      {member.availability.map(shift => (
        <View
          key={shift.shift_id}
          style={styles.innerCard}
        >
          <Text style={styles.cardTitle}>
            {shift.shift_name}
          </Text>

          <Text style={styles.description}>
            {formatVolunteerDate(shift.service_date)}
          </Text>

          <Text style={styles.description}>
            {formatVolunteerTime(shift.start_time)}
            {' - '}
            {formatVolunteerTime(shift.end_time)}
            {' IST'}
          </Text>

          {!shift.is_active && (
            <Text style={styles.dangerText}>
              {volunteerI18n.t('volunteer.shiftInactive')}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

// ========================================
// DUTY ASSIGNMENTS
// ========================================

function DutiesSection({
  member,
}: {
  member: VolunteerSevaMember;
}) {
  if (!member.assignments.length) {
    return (
      <Message
        title={volunteerI18n.t('volunteer.noAssignedDuties')}
        message={volunteerI18n.t('volunteer.dutyPendingNote')}
      />
    );
  }

  return (
    <View>
      <Text style={styles.sectionHeading}>
        {volunteerI18n.t('volunteer.assignedDuties')} ({member.assignments.length})
      </Text>

      {member.assignments.map(duty => (
        <DutyCard
          key={duty.assignment_id}
          duty={duty}
          gender={member.gender}
        />
      ))}
    </View>
  );
}

function DutyCard({
  duty,
  gender,
}: {
  duty: VolunteerDutyAssignment;
  gender: string;
}) {
  const dressCode =
    gender === 'male'
      ? duty.male_dress_code
      : gender === 'female'
        ? duty.female_dress_code
        : null;

  const dressImage =
    gender === 'male'
      ? duty.male_dress_image_url
      : gender === 'female'
        ? duty.female_dress_image_url
        : null;

  return (
    <View style={styles.panel}>
      <View style={styles.statusPill}>
        <Text style={styles.statusPillText}>
          {readableStatus(duty.display_status)}
        </Text>
      </View>

      <Text style={styles.heading}>
        {duty.duty_name}
      </Text>

      <VolunteerInfo
        label={volunteerI18n.t('volunteer.serviceDate')}
        value={formatVolunteerDate(
          duty.service_date
        )}
      />

      <VolunteerInfo
        label={volunteerI18n.t('volunteer.shift')}
        value={duty.shift_name}
      />

      <VolunteerInfo
        label={volunteerI18n.t('volunteer.dutyTiming')}
        value={
          `${formatVolunteerTime(duty.start_time)}` +
          ` - ${formatVolunteerTime(duty.end_time)} IST`
        }
      />

      {!!duty.reporting_time && (
        <VolunteerInfo
          label={volunteerI18n.t('volunteer.reportingTime')}
          value={
            `${formatVolunteerTime(duty.reporting_time)} IST`
          }
        />
      )}

      {!!duty.reporting_location && (
        <InfoText
          label={volunteerI18n.t('volunteer.reportingLocation')}
          value={duty.reporting_location}
        />
      )}

      {!!duty.duty_description && (
        <InfoText
          label={volunteerI18n.t('volunteer.dutyDescription')}
          value={duty.duty_description}
        />
      )}

      {!!duty.responsibilities && (
        <InfoText
          label={volunteerI18n.t('volunteer.responsibilities')}
          value={duty.responsibilities}
        />
      )}

      {!!dressCode && (
        <InfoText
          label={volunteerI18n.t('volunteer.dressCode')}
          value={dressCode}
        />
      )}

      {!!dressImage && (
        <SafeImage
          uri={dressImage}
          style={styles.dressImage}
        />
      )}

      {gender !== 'male' &&
        gender !== 'female' && (
          <>
            {!!duty.male_dress_code && (
              <InfoText
                label={volunteerI18n.t('volunteer.maleDress')}
                value={duty.male_dress_code}
              />
            )}

            {!!duty.female_dress_code && (
              <InfoText
                label={volunteerI18n.t('volunteer.femaleDress')}
                value={duty.female_dress_code}
              />
            )}
          </>
        )}

      {!!duty.general_instructions && (
        <InfoText
          label={volunteerI18n.t('volunteer.generalInstructions')}
          value={duty.general_instructions}
        />
      )}

      {!!duty.special_instructions && (
        <InfoText
          label={volunteerI18n.t('volunteer.specialInstructions')}
          value={duty.special_instructions}
        />
      )}

      {!!duty.coordinator_name && (
        <VolunteerInfo
          label={volunteerI18n.t('volunteer.coordinator')}
          value={duty.coordinator_name}
        />
      )}

      {!!duty.coordinator_phone && (
        <View style={styles.buttonGap}>
          <VolunteerButton
            title={`Call ${duty.coordinator_phone}`}
            secondary
            onPress={() =>
              void callContact(
                duty.coordinator_phone!
              )
            }
          />
        </View>
      )}

      <View style={styles.innerCard}>
        <VolunteerInfo
          label={volunteerI18n.t('volunteer.attendance')}
          value={
            duty.attendance_finalized
              ? readableStatus(
                  duty.attendance_status
                )
              : volunteerI18n.t('volunteer.awaitingFinalization')
          }
        />

        {duty.attendance_finalized && (
          <VolunteerInfo
            label={volunteerI18n.t('volunteer.serviceHours')}
            value={String(
              duty.service_hours ?? 0
            )}
          />
        )}
      </View>
    </View>
  );
}

// ========================================
// DIGITAL ID CARD
// ========================================

function IDCardSection({
  member,
  refreshing,
  onRefresh,
}: {
  member: VolunteerSevaMember;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const card = member.id_card;

  if (!card) {
    return (
      <Message
        title={volunteerI18n.t('volunteer.noIDCard')}
        message={volunteerI18n.t('volunteer.idCardPendingNote')}
      />
    );
  }

  return (
    <View>
      <View style={styles.idCard}>
        <View style={styles.idHeader}>
          <Text style={styles.idTemple}>
            DIVYAKSHETRA HARIHARAPURA
          </Text>

          <Text style={styles.idHeading}>
            {volunteerI18n.t('volunteer.volunteerIDCard')}
          </Text>
        </View>

        <View style={styles.idBody}>
          <SafeImage
            uri={card.photo_url}
            style={styles.idPhoto}
            fallback="👤"
          />
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Refresh ID card photograph"
            disabled={refreshing}
            onPress={onRefresh}
            style={{
              paddingVertical: 9,
              paddingHorizontal: 14,
              marginTop: 8,
              marginBottom: 6,
              borderWidth: 1,
              borderColor: C.border,
              borderRadius: 8,
              opacity: refreshing ? 0.5 : 1,
            }}
          >
            <Text style={{
              color: C.maroon,
              fontSize: 12,
              fontWeight: '700',
              textAlign: 'center',
            }}>
              {refreshing
                ? 'Refreshing...'
                : 'Refresh ID Card'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.idName}>
            {member.full_name}
          </Text>

          <Text style={styles.idNumber} selectable>
            {card.card_number}
          </Text>

          <Text style={styles.description}>
            {member.member_code}
          </Text>

          <View
            style={[
              styles.idStatus,
              {
                backgroundColor:
                  card.status === 'active'
                    ? C.lightGreen
                    : C.lightGold,
              },
            ]}
          >
            <Text
              style={{
                color:
                  card.status === 'active'
                    ? C.green
                    : C.maroon,
                fontWeight: '800',
              }}
            >
              {readableStatus(card.status)}
            </Text>
          </View>

          <View style={styles.idValidity}>
            <VolunteerInfo
              label={volunteerI18n.t('volunteer.validFrom')}
              value={formatVolunteerDate(
                card.valid_from
              )}
            />

            <VolunteerInfo
              label={volunteerI18n.t('volunteer.validUntil')}
              value={formatVolunteerDate(
                card.valid_until
              )}
            />

            <VolunteerInfo
              label={volunteerI18n.t('volunteer.issuedOn')}
              value={displayDateTime(
                card.issued_at
              )}
            />
          </View>
        </View>

        <View style={styles.idFooter}>
          <Text style={styles.idFooterText}>
            {volunteerI18n.t('volunteer.officialID')}
          </Text>
        </View>
      </View>

      <Text style={styles.footer}>
        {card.status === 'active'
          ? 'Show this card at the designated volunteer reporting area when required. Refresh the screen to confirm current validity.'
          : 'This card is not currently active and should not be used as valid identification.'}
      </Text>
    </View>
  );
}

// ========================================
// ACCOMMODATION
// ========================================

function AccommodationSection({
  member,
}: {
  member: VolunteerSevaMember;
}) {
  if (!member.accommodation.length) {
    return (
      <Message
        title={volunteerI18n.t('volunteer.noAccommodation')}
        message={volunteerI18n.t('volunteer.accommodationPendingNote')}
      />
    );
  }

  return (
    <View>
      {member.accommodation.map(item => (
        <View
          key={item.id}
          style={styles.panel}
        >
          <Text style={styles.heading}>
            {item.accommodation_name}
          </Text>

          {!!item.building_name && (
            <VolunteerInfo
              label={volunteerI18n.t('volunteer.building')}
              value={item.building_name}
            />
          )}

          {!!item.room_number && (
            <VolunteerInfo
              label={volunteerI18n.t('volunteer.roomNumber')}
              value={item.room_number}
            />
          )}

          {!!item.address && (
            <InfoText
              label={volunteerI18n.t('volunteer.address')}
              value={item.address}
            />
          )}

          {!!item.check_in_at && (
            <VolunteerInfo
              label={volunteerI18n.t('volunteer.checkIn')}
              value={displayDateTime(
                item.check_in_at
              )}
            />
          )}

          {!!item.check_out_at && (
            <VolunteerInfo
              label={volunteerI18n.t('volunteer.checkOut')}
              value={displayDateTime(
                item.check_out_at
              )}
            />
          )}

          {!!item.contact_person && (
            <VolunteerInfo
              label={volunteerI18n.t('volunteer.contactPerson')}
              value={item.contact_person}
            />
          )}

          {!!item.instructions && (
            <InfoText
              label={volunteerI18n.t('volunteer.accommodationInstructions')}
              value={item.instructions}
            />
          )}

          {!!item.contact_phone && (
            <View style={styles.buttonGap}>
              <VolunteerButton
                title={`Call ${item.contact_phone}`}
                secondary
                onPress={() =>
                  void callContact(
                    item.contact_phone!
                  )
                }
              />
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

// ========================================
// ATTENDANCE AND SERVICE PROGRESS
// ========================================

function AttendanceSection({
  member,
}: {
  member: VolunteerSevaMember;
}) {
  const summary = member.attendance_summary;

  const percentage =
    summary.attendance_percentage;

  const progress = Math.min(
    100,
    Math.max(
      0,
      Number(percentage ?? 0) || 0
    )
  );

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>
        {volunteerI18n.t('volunteer.attendanceProgress')}
      </Text>

      <View style={styles.attendanceHero}>
        <Text style={styles.percentage}>
          {percentage === null
            ? '-'
            : `${progress}%`}
        </Text>

        <Text style={styles.description}>
          {volunteerI18n.t('volunteer.attendancePercentage')}
        </Text>

        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${progress}%`,
              },
            ]}
          />
        </View>
      </View>

      <View style={styles.attendanceGrid}>
        <AttendanceStat
          label={volunteerI18n.t('volunteer.present')}
          value={summary.present}
        />

        <AttendanceStat
          label={volunteerI18n.t('volunteer.absent')}
          value={summary.absent}
        />

        <AttendanceStat
          label={volunteerI18n.t('volunteer.excused')}
          value={summary.excused}
        />

        <AttendanceStat
          label={volunteerI18n.t('volunteer.pending')}
          value={summary.pending}
        />

        <AttendanceStat
          label={volunteerI18n.t('volunteer.serviceDays')}
          value={summary.total_service_days}
        />

        <AttendanceStat
          label={volunteerI18n.t('volunteer.serviceHours')}
          value={summary.total_service_hours}
        />
      </View>

      <VolunteerInfo
        label={volunteerI18n.t('volunteer.totalAssignedDuties')}
        value={summary.total_assignments}
      />

      <VolunteerInfo
        label={volunteerI18n.t('volunteer.finalizedAttendance')}
        value={summary.finalized}
      />

      <Text style={styles.footer}>
        {volunteerI18n.t('volunteer.attendanceNote')}
      </Text>

      {member.status === 'completed' && (
        <View style={styles.completionBox}>
          <Text style={styles.completionText}>
            {'✓ ' + volunteerI18n.t('volunteer.serviceCompleted')}
          </Text>
        </View>
      )}
    </View>
  );
}

// ========================================
// CERTIFICATE INFORMATION
// ========================================

function CertificateSection({
  member,
}: {
  member: VolunteerSevaMember;
}) {
  const { t } = useTranslation();

  const [downloading, setDownloading] =
    useState(false);

  const downloadLock = useRef(false);

  const certificate = member.certificate;

  async function handleDownload() {
    if (
      !certificate ||
      certificate.status !== 'issued' ||
      downloadLock.current
    ) {
      return;
    }

    downloadLock.current = true;
    setDownloading(true);

    try {
      await downloadVolunteerCertificate(
        certificate.id
      );
    } catch (error) {
      Alert.alert(
        t(
          'volunteer.downloadFailed',
          'Certificate Download Failed'
        ),
        getVolunteerError(error)
      );
    } finally {
      downloadLock.current = false;
      setDownloading(false);
    }
  }

  if (!certificate) {
    return (
      <Message
        title={volunteerI18n.t('volunteer.noCertificate')}
        message={volunteerI18n.t('volunteer.certificatePendingNote')}
      />
    );
  }

  return (
    <View style={styles.certificate}>
      <Text style={styles.certificateIcon}>
        🏅
      </Text>

      <Text style={styles.certificateTemple}>
        DIVYAKSHETRA HARIHARAPURA
      </Text>

      <Text style={styles.certificateTitle}>
        {certificate.certificate_title}
      </Text>

      <Text style={styles.description}>
        {volunteerI18n.t('volunteer.presentedTo')}
      </Text>

      <Text style={styles.certificateName}>
        {certificate.volunteer_name}
      </Text>

      <Text style={styles.certificateProgramme}>
        {certificate.programme_name}
      </Text>

      {!!certificate.certificate_message && (
        <Text style={styles.certificateMessage}>
          {certificate.certificate_message}
        </Text>
      )}

      {(certificate.attendance_mode ??
        member.attendance_mode ??
        'legacy') === 'none' ? (
        <View style={styles.innerCard}>
          <Text style={styles.cardTitle}>
            {t(
              'volunteer.dailyManualVerification',
              'Manual Service Verification'
            )}
          </Text>
          <Text style={styles.description}>
            {t(
              'volunteer.dailyCompletionVerified',
              'Your service has been verified by the temple administration.'
            )}
          </Text>
          <Text style={styles.description}>
            {t(
              'volunteer.certificateNoAttendance',
              'Attendance statistics are not recorded for this programme.'
            )}
          </Text>
        </View>
      ) : (
        <>
          {!!certificate.service_start_date &&
            !!certificate.service_end_date && (
              <VolunteerInfo
                label={t(
                  'volunteer.certificateServicePeriod',
                  'Service period'
                )}
                value={
                  formatVolunteerDate(
                    certificate.service_start_date
                  ) +
                  ' - ' +
                  formatVolunteerDate(
                    certificate.service_end_date
                  )
                }
              />
            )}
          {certificate.total_service_days != null && (
            <VolunteerInfo
              label={volunteerI18n.t(
                'volunteer.serviceDays'
              )}
              value={certificate.total_service_days}
            />
          )}
          {(certificate.attendance_mode ??
            member.attendance_mode ??
            'legacy') !== 'simple' &&
            certificate.total_service_hours != null && (
              <VolunteerInfo
                label={
                  (certificate.attendance_mode ??
                    member.attendance_mode ??
                    'legacy') === 'detailed'
                    ? t(
                        'volunteer.actualServiceHours',
                        'Actual service hours'
                      )
                    : volunteerI18n.t(
                        'volunteer.serviceHours'
                      )
                }
                value={String(
                  certificate.total_service_hours
                )}
              />
            )}
        </>
      )}

      <VolunteerInfo
        label={volunteerI18n.t('volunteer.issuedOn')}
        value={displayDateTime(
          certificate.issued_at
        )}
      />

      {!!certificate.signatory_name && (
        <Text style={styles.signatory}>
          {certificate.signatory_name}
        </Text>
      )}

      {!!certificate.signatory_designation && (
        <Text style={styles.description}>
          {certificate.signatory_designation}
        </Text>
      )}

      <Text
        selectable
        style={styles.certificateNumber}
      >
        {certificate.certificate_number}
      </Text>

      <View style={styles.completionBox}>
        <Text style={styles.completionText}>
          {'✓ ' + volunteerI18n.t('volunteer.certificateIssued')}
        </Text>
      </View>

      <View style={styles.buttonGap}>
  <VolunteerButton
    title={
      downloading
        ? t(
            'volunteer.downloading',
            'Downloading Certificate...'
          )
        : t(
            'volunteer.downloadCertificate',
            'Download Certificate PDF'
          )
    }
    disabled={
      downloading ||
      certificate.status !== 'issued'
    }
    onPress={() => void handleDownload()}
  />
</View>

<Text style={styles.footer}>
  {t(
    'volunteer.certificateDownloadNote',
    'Save or share your official certificate using the available device options.'
  )}
</Text>
    </View>
  );
}

// ========================================
// REUSABLE COMPONENTS
// ========================================

function Message({
  title,
  message,
  danger = false,
}: {
  title: string;
  message: string;
  danger?: boolean;
}) {
  return (
    <View
      style={[
        styles.message,
        danger && {
          backgroundColor: C.lightRed,
          borderColor: C.red,
        },
      ]}
    >
      <Text
        style={[
          styles.messageTitle,
          danger && { color: C.red },
        ]}
      >
        {title}
      </Text>

      <Text style={styles.description}>
        {message}
      </Text>
    </View>
  );
}

function InfoText({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoText}>
      <Text style={styles.infoLabel}>
        {label}
      </Text>

      <Text selectable style={styles.infoValue}>
        {value}
      </Text>
    </View>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statNumber}>
        {value}
      </Text>

      <Text style={styles.statLabel}>
        {label}
      </Text>
    </View>
  );
}

function AttendanceStat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <View style={styles.attendanceStat}>
      <Text style={styles.attendanceNumber}>
        {value}
      </Text>

      <Text style={styles.statLabel}>
        {label}
      </Text>
    </View>
  );
}

function SafeImage({
  uri,
  style,
  fallback = 'Image unavailable',
}: {
  uri?: string | null;
  style: any;
  fallback?: string;
}) {
  const [failedUri, setFailedUri] =
    useState<string | null>(null);

  if (
    !uri ||
    !/^https:\/\//i.test(uri) ||
    failedUri === uri
  ) {
    return (
      <View
        style={[
          style,
          styles.imageFallback,
        ]}
      >
        <Text style={styles.fallbackText}>
          {fallback}
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={style}
      resizeMode="contain"
      onError={() => setFailedUri(uri)}
    />
  );
}

// ========================================
// STYLES
// ========================================

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 45,
  },

  hero: {
    backgroundColor: C.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    marginBottom: 15,
  },

  heroBody: {
    padding: 18,
  },

  heroTitle: {
    fontSize: 24,
    lineHeight: 31,
    fontWeight: '800',
    color: C.maroon,
    marginTop: 12,
  },

  heroCode: {
    color: C.muted,
    fontSize: 11,
    fontWeight: '700',
    marginVertical: 10,
  },

  heroDescription: {
    color: C.text,
    fontSize: 13,
    lineHeight: 21,
  },

  panel: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 18,
    padding: 17,
    marginBottom: 15,
  },

  heading: {
    color: C.maroon,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },

  sectionHeading: {
    color: C.maroon,
    fontSize: 21,
    fontWeight: '800',
    marginBottom: 14,
  },

  description: {
    color: C.muted,
    fontSize: 13,
    lineHeight: 21,
    marginTop: 5,
  },

  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 15,
  },

  stat: {
    flex: 1,
    backgroundColor: C.lightGold,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    paddingVertical: 17,
  },

  statNumber: {
    color: C.maroon,
    fontSize: 26,
    fontWeight: '800',
  },

  statLabel: {
    color: C.muted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 5,
  },

  nextDuty: {
    backgroundColor: C.lightGold,
    borderWidth: 1,
    borderColor: C.gold,
    borderRadius: 17,
    padding: 18,
    marginBottom: 15,
  },

  nextLabel: {
    color: C.maroon,
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: '800',
  },

  nextTitle: {
    color: C.maroon,
    fontSize: 20,
    fontWeight: '800',
    marginVertical: 8,
  },

  smallLabel: {
    color: C.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },

  memberName: {
    color: C.maroon,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 7,
  },

  goldText: {
    color: '#956413',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 6,
  },

  memberOption: {
    backgroundColor: C.lightGold,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginRight: 8,
  },

  memberSelected: {
    backgroundColor: C.maroon,
  },

  memberOptionText: {
    color: C.maroon,
    fontSize: 13,
    fontWeight: '600',
  },

  selectedText: {
    color: '#FFFFFF',
  },

  navigationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },

  navigationItem: {
    width: '31%',
    flexGrow: 1,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    minHeight: 80,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },

  navigationSelected: {
    backgroundColor: C.maroon,
    borderColor: C.maroon,
  },

  navigationIcon: {
    fontSize: 22,
    marginBottom: 6,
  },

  navigationLabel: {
    color: C.maroon,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },

  message: {
    padding: 18,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.lightGold,
    borderRadius: 17,
    marginBottom: 15,
  },

  messageTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: C.maroon,
    marginBottom: 5,
  },

  innerCard: {
    padding: 14,
    backgroundColor: C.background,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    marginTop: 12,
  },

  cardTitle: {
    color: C.maroon,
    fontSize: 15,
    fontWeight: '700',
  },

  dangerText: {
    color: C.red,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 7,
  },

  statusPill: {
    backgroundColor: C.lightGold,
    alignSelf: 'flex-start',
    borderRadius: 15,
    paddingHorizontal: 11,
    paddingVertical: 6,
    marginBottom: 12,
  },

  statusPillText: {
    color: C.maroon,
    fontSize: 11,
    fontWeight: '700',
  },

  infoText: {
    marginVertical: 10,
  },

  infoLabel: {
    color: C.maroon,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 5,
  },

  infoValue: {
    color: C.text,
    fontSize: 13,
    lineHeight: 22,
  },

  dressImage: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    backgroundColor: C.background,
    marginVertical: 12,
  },

  buttonGap: {
    marginTop: 12,
  },

  idCard: {
    borderRadius: 22,
    borderWidth: 2,
    borderColor: C.gold,
    overflow: 'hidden',
    backgroundColor: C.white,
  },

  idHeader: {
    backgroundColor: C.maroon,
    padding: 20,
    alignItems: 'center',
  },

  idTemple: {
    color: '#F7EBD7',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '800',
  },

  idHeading: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 8,
  },

  idBody: {
    alignItems: 'center',
    padding: 20,
  },

  idPhoto: {
    width: 110,
    height: 135,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: C.gold,
    backgroundColor: C.lightGold,
  },

  idName: {
    fontSize: 23,
    color: C.maroon,
    fontWeight: '800',
    marginTop: 15,
    textAlign: 'center',
  },

  idNumber: {
    color: C.maroon,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 9,
    textAlign: 'center',
  },

  idStatus: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 12,
  },

  idValidity: {
    width: '100%',
    backgroundColor: C.background,
    padding: 14,
    borderRadius: 12,
    marginTop: 16,
  },

  idFooter: {
    backgroundColor: C.maroon,
    padding: 13,
  },

  idFooterText: {
    color: '#F7EBD7',
    fontSize: 10,
    textAlign: 'center',
    letterSpacing: 0.8,
    fontWeight: '700',
  },

  imageFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  fallbackText: {
    color: C.muted,
    textAlign: 'center',
    padding: 8,
  },

  attendanceHero: {
    backgroundColor: C.lightGold,
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    marginBottom: 15,
  },

  percentage: {
    color: C.maroon,
    fontSize: 38,
    fontWeight: '800',
  },

  progressTrack: {
    height: 9,
    width: '100%',
    backgroundColor: C.border,
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 16,
  },

  progressFill: {
    backgroundColor: C.green,
    height: '100%',
    borderRadius: 10,
  },

  attendanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 15,
  },

  attendanceStat: {
    width: '31%',
    flexGrow: 1,
    padding: 13,
    backgroundColor: C.background,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    alignItems: 'center',
  },

  attendanceNumber: {
    color: C.maroon,
    fontSize: 24,
    fontWeight: '800',
  },

  completionBox: {
    backgroundColor: C.lightGreen,
    borderRadius: 12,
    padding: 14,
    marginTop: 15,
  },

  completionText: {
    fontSize: 13,
    color: C.green,
    fontWeight: '700',
    textAlign: 'center',
  },

  certificate: {
    padding: 22,
    borderWidth: 2,
    borderColor: C.gold,
    borderRadius: 18,
    backgroundColor: '#FFFDF8',
  },

  certificateIcon: {
    fontSize: 46,
    textAlign: 'center',
  },

  certificateTemple: {
    color: C.maroon,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 12,
  },

  certificateTitle: {
    color: C.maroon,
    textAlign: 'center',
    fontSize: 26,
    fontWeight: '800',
    marginVertical: 15,
  },

  certificateName: {
    color: C.maroon,
    fontSize: 25,
    fontWeight: '800',
    textAlign: 'center',
    marginVertical: 11,
  },

  certificateProgramme: {
    color: C.text,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 17,
  },

  certificateMessage: {
    color: C.text,
    fontSize: 13,
    lineHeight: 23,
    textAlign: 'center',
    marginBottom: 18,
  },

  signatory: {
    color: C.maroon,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 18,
  },

  certificateNumber: {
    color: C.muted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 18,
  },

  footer: {
    color: C.muted,
    fontSize: 12,
    lineHeight: 19,
    marginVertical: 14,
    textAlign: 'center',
  },
});