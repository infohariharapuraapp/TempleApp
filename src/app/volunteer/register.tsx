import React, {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  router,
  useLocalSearchParams,
} from 'expo-router';

import { useTranslation } from 'react-i18next';

import {
  getVolunteerOpportunity,
  getVolunteerShifts,
  submitVolunteerRegistration,
  getMyVolunteerRegistrations,
  getVolunteerError,
  formatVolunteerDate,
  formatVolunteerTime,
} from '@/services/volunteerApi';

import type {
  VolunteerOpportunity,
  VolunteerShift,
  VolunteerMemberInput,
  VolunteerRegistrationInput,
} from '@/services/volunteerApi';

import {
  createEmptyMember,
  normalizeVolunteerMember,
  validateVolunteerMember,
  validateVolunteerRegistration,
} from '@/services/volunteerValidation';

import {
  VOLUNTEER_COLORS as C,
  VolunteerScreen,
  VolunteerButton,
  VolunteerLoading,
  VolunteerError,
} from '@/components/volunteer/VolunteerUI';

import { ApiError } from '@/services/api';

type RegistrationType = 'individual' | 'group';

type TextField = Exclude<
  keyof VolunteerMemberInput,
  'gender' | 'is_team_leader' | 'shift_ids'
>;

let submissionRunning = false;

const ACTIVE_STATUSES = [
  'pending',
  'approved',
  'assigned',
  'in_progress',
  'completed',
];

export default function VolunteerRegisterScreen() {
  const { t } = useTranslation();

  const params = useLocalSearchParams<{
    opportunityId: string;
  }>();

  const id = Number(params.opportunityId);

  const [opportunity, setOpportunity] =
    useState<VolunteerOpportunity | null>(null);

  const [shifts, setShifts] =
    useState<VolunteerShift[]>([]);

  const [type, setType] =
    useState<RegistrationType>('individual');

  const [members, setMembers] =
    useState<VolunteerMemberInput[]>([
      createEmptyMember(),
    ]);

  const [memberIndex, setMemberIndex] =
    useState(0);

  const [groupName, setGroupName] =
    useState('');

  const [remarks, setRemarks] =
    useState('');

  const [loading, setLoading] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState('');

  const [formError, setFormError] =
    useState('');

  const [uncertain, setUncertain] =
    useState(false);

  const [registeredCode, setRegisteredCode] =
    useState('');

  const [consent, setConsent] =
    useState(false);

  const mounted = useRef(false);
  const version = useRef(0);
  const scrollRef = useRef<ScrollView>(null);

  async function load() {
    const requestVersion = ++version.current;

    setLoading(true);
    setError('');

    try {
      if (
        !Number.isSafeInteger(id) ||
        id <= 0 ||
        id > 2147483647
      ) {
        throw new ApiError('Invalid opportunity.');
      }

      const [item, available, history] =
        await Promise.all([
          getVolunteerOpportunity(id),
          getVolunteerShifts(id),
          getMyVolunteerRegistrations(),
        ]);

      if (
        !mounted.current ||
        requestVersion !== version.current
      ) {
        return;
      }

      setOpportunity(item);
      setShifts(available);

      const existing = history.find(
        record =>
          Number(record.opportunity_id) === id &&
          ACTIVE_STATUSES.includes(record.status)
      );

      if (existing) {
        setRegisteredCode(existing.registration_code);
      }

      if (!item.allow_individual && item.allow_group) {
        setType('group');

        setMembers([
          {
            ...createEmptyMember(),
            is_team_leader: true,
          },
        ]);
      }
    } catch (err) {
      if (
        mounted.current &&
        requestVersion === version.current
      ) {
        setError(getVolunteerError(err));
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
  }, [id]);

  const member = members[memberIndex];

  function updateMember(
    changes: Partial<VolunteerMemberInput>
  ) {
    if (submissionRunning || uncertain) return;

    setMembers(previous =>
      previous.map((item, index) =>
        index === memberIndex
          ? { ...item, ...changes }
          : item
      )
    );

    setFormError('');
    setConsent(false);
  }

  function switchType(next: RegistrationType) {
    if (
      next === type ||
      submitting ||
      uncertain
    ) {
      return;
    }

    const apply = () => {
      setType(next);
      setMemberIndex(0);
      setMembers([
        {
          ...members[0],
          is_team_leader: next === 'group',
        },
      ]);
      setConsent(false);
      setFormError('');
    };

    if (next === 'individual' && members.length > 1) {
      Alert.alert(
        t('volunteer.changeRegistrationType'),
        t('volunteer.removeAdditionalMembers'),
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue', onPress: apply },
        ]
      );
    } else {
      apply();
    }
  }

  function selectMember(index: number) {
    setMemberIndex(index);
    setFormError('');

    scrollRef.current?.scrollTo({
      y: 0,
      animated: true,
    });
  }

  function addMember() {
    if (
      !opportunity ||
      submitting ||
      uncertain ||
      type !== 'group' ||
      members.length >= Math.min(
        500,
        opportunity.maximum_group_size
      )
    ) {
      return;
    }

    const validation = validateVolunteerMember(
      member,
      shifts
    );

    if (validation) {
      setFormError(validation);
      return;
    }

    setMembers(previous => [
      ...previous,
      createEmptyMember(),
    ]);

    selectMember(members.length);
    setConsent(false);
  }

  function removeMember() {
    if (
      members.length <= 1 ||
      submitting ||
      uncertain
    ) {
      return;
    }

    Alert.alert(
      t('volunteer.removeMemberConfirm'),
      t('volunteer.removeMemberMessage'),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            const remaining = members.filter(
              (_, index) => index !== memberIndex
            );

            if (
              !remaining.some(
                item => item.is_team_leader
              )
            ) {
              remaining[0] = {
                ...remaining[0],
                is_team_leader: true,
              };
            }

            setMembers(remaining);

            selectMember(
              Math.min(
                memberIndex,
                remaining.length - 1
              )
            );

            setConsent(false);
          },
        },
      ]
    );
  }

  function selectLeader() {
    if (submitting || uncertain) return;

    setMembers(previous =>
      previous.map((item, index) => ({
        ...item,
        is_team_leader: index === memberIndex,
      }))
    );

    setConsent(false);
  }

  function toggleShift(shiftId: number) {
    const selected = member.shift_ids.includes(shiftId);

    updateMember({
      shift_ids: selected
        ? member.shift_ids.filter(
            value => value !== shiftId
          )
        : [...member.shift_ids, shiftId],
    });
  }

  async function checkRegistration() {
    if (submissionRunning) return;

    submissionRunning = true;
    setSubmitting(true);
    setFormError('');

    try {
      const history =
        await getMyVolunteerRegistrations();

      const existing = history.find(
        item =>
          Number(item.opportunity_id) === id &&
          ACTIVE_STATUSES.includes(item.status)
      );

      if (!mounted.current) return;

      if (existing) {
        setRegisteredCode(existing.registration_code);
        setUncertain(false);
      } else {
        setFormError(
          t('volunteer.registrationStillProcessing')
        );
      }
    } catch (err) {
      if (mounted.current) {
        setFormError(getVolunteerError(err));
      }
    } finally {
      submissionRunning = false;

      if (mounted.current) {
        setSubmitting(false);
      }
    }
  }

  async function submit() {
    if (
      !opportunity ||
      submissionRunning ||
      submitting ||
      uncertain ||
      registeredCode
    ) {
      return;
    }

    const payload: VolunteerRegistrationInput = {
      opportunity_id: id,
      registration_type: type,

      group_name:
        type === 'group'
          ? groupName.trim()
          : undefined,

      devotee_remarks: remarks.trim(),

      members: members.map((item, index) => ({
        ...normalizeVolunteerMember(item),

        is_team_leader:
          type === 'individual'
            ? index === 0
            : item.is_team_leader,
      })),
    };

    const validation =
      validateVolunteerRegistration(
        payload,
        opportunity,
        shifts
      );

    if (validation) {
      setFormError(validation);
      return;
    }

    if (!consent) {
      setFormError(
        t('volunteer.consentRequired')
      );
      return;
    }

    submissionRunning = true;
    setSubmitting(true);
    setFormError('');

    let requestStarted = false;

    try {
      const history =
        await getMyVolunteerRegistrations();

      const existing = history.find(
        item =>
          Number(item.opportunity_id) === id &&
          ACTIVE_STATUSES.includes(item.status)
      );

      if (!mounted.current) return;

      if (existing) {
        setRegisteredCode(existing.registration_code);
        return;
      }

      requestStarted = true;

      const result =
        await submitVolunteerRegistration(payload);

      if (!mounted.current) return;

      if (!result.registration_code) {
        setUncertain(true);

        setFormError(
          t('volunteer.registrationUnconfirmed')
        );

        return;
      }

      setRegisteredCode(result.registration_code);
      setUncertain(false);
    } catch (err) {
      if (!mounted.current) return;

      if (
        requestStarted &&
        (
          !(err instanceof ApiError) ||
          !err.status ||
          err.status >= 500 ||
          err.status === 409 ||
          err.status === 408
        )
      ) {
        setUncertain(true);

        setFormError(
          t('volunteer.submissionUnconfirmed')
        );
      } else {
        setFormError(getVolunteerError(err));
      }
    } finally {
      submissionRunning = false;

      if (mounted.current) {
        setSubmitting(false);
      }
    }
  }

  function field(
    key: TextField,
    label: string,
    placeholder = '',
    keyboardType:
      | 'default'
      | 'phone-pad'
      | 'email-address' = 'default',
    multiline = false,
    maxLength = 255
  ) {
    return (
      <View style={styles.field} key={key}>
        <Text style={styles.label}>
          {label}
        </Text>

        <TextInput
          style={[
            styles.input,
            multiline && styles.multiline,
          ]}
          value={String(member?.[key] ?? '')}
          placeholder={placeholder}
          placeholderTextColor={C.muted}
          editable={!submitting && !uncertain}
          keyboardType={keyboardType}
          multiline={multiline}
          maxLength={maxLength}
          onChangeText={value =>
            updateMember({ [key]: value })
          }
        />
      </View>
    );
  }

  const registrationOpen =
    opportunity?.registration_status === 'open' &&
    Date.parse(opportunity.registration_end_at) > Date.now();

  const availableShifts = shifts.filter(shift => {
    const time = Date.parse(
      `${shift.service_date.slice(0, 10)}T${shift.start_time.slice(0, 8)}+05:30`
    );

    return Number.isFinite(time) && time > Date.now();
  });

  return (
    <VolunteerScreen
      title={t(
        'volunteer.register',
        'Volunteer Registration'
      )}
    >
      {loading ? (
        <VolunteerLoading />
      ) : error ? (
        <View style={styles.content}>
          <VolunteerError
            message={error}
            onRetry={() => void load()}
          />

          <VolunteerButton
            title={t('common.login', 'Login')}
            secondary
            onPress={() => router.push('/login')}
          />
        </View>
      ) : registeredCode ? (
        <ScrollView
          contentContainerStyle={styles.content}
        >
          <View style={styles.panel}>
            <Text style={styles.successIcon}>
              ✓
            </Text>

            <Text style={styles.successTitle}>
              {t('volunteer.registrationRecorded')}
            </Text>

            <Text style={styles.description}>
              {t('volunteer.registrationSavedNote')}
            </Text>

            <Text selectable style={styles.code}>
              {registeredCode}
            </Text>

            <VolunteerButton
              title={t('volunteer.viewMySevas')}
              onPress={() => router.replace('/my-sevas')}
            />
          </View>
        </ScrollView>
      ) : !opportunity || !member ? (
        <VolunteerError
          message={t('volunteer.registrationInfoUnavailable')}
          onRetry={() => void load()}
        />
      ) : (
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <View style={styles.hero}>
            <Text style={styles.heroLabel}>
              VOLUNTEER SEVA
            </Text>

            <Text style={styles.heroTitle}>
              {opportunity.title}
            </Text>

            <Text style={styles.heroText}>
              {formatVolunteerDate(
                opportunity.service_start_date
              )}
              {' – '}
              {formatVolunteerDate(
                opportunity.service_end_date
              )}
            </Text>
          </View>

          {!registrationOpen && (
            <Text style={styles.error}>
              {t('volunteer.registrationClosed')}
            </Text>
          )}

          <View style={styles.panel}>
            <Text style={styles.heading}>
              {t('volunteer.registrationType')}
            </Text>

            <View style={styles.row}>
              {opportunity.allow_individual && (
                <Choice
                  label={t('volunteer.individual')}
                  selected={type === 'individual'}
                  disabled={submitting || uncertain}
                  onPress={() =>
                    switchType('individual')
                  }
                />
              )}

              {opportunity.allow_group && (
                <Choice
                  label={t('volunteer.group')}
                  selected={type === 'group'}
                  disabled={submitting || uncertain}
                  onPress={() =>
                    switchType('group')
                  }
                />
              )}
            </View>

            {type === 'group' && (
              <>
                <Text style={styles.description}>
                  Group size: {opportunity.minimum_group_size}
                  {' – '}
                  {opportunity.maximum_group_size} members
                </Text>

                <Text style={styles.label}>
                  {t('volunteer.groupName')}
                </Text>

                <TextInput
                  style={styles.input}
                  value={groupName}
                  maxLength={255}
                  editable={!submitting && !uncertain}
                  placeholder={t('volunteer.enterGroupName')}
                  placeholderTextColor={C.muted}
                  onChangeText={value => {
                    setGroupName(value);
                    setConsent(false);
                  }}
                />

                <Text style={styles.heading}>
                  Members ({members.length})
                </Text>

                <View style={styles.wrap}>
                  {members.map((item, index) => (
                    <Choice
                      key={index}
                      label={
                        `Member ${index + 1}` +
                        (item.is_team_leader ? ' ★' : '')
                      }
                      selected={index === memberIndex}
                      disabled={submitting || uncertain}
                      onPress={() => selectMember(index)}
                    />
                  ))}
                </View>
              </>
            )}
          </View>

          <View style={styles.panel}>
            <Text style={styles.heading}>
              {type === 'group'
                ? `Member ${memberIndex + 1} Details`
                : t('volunteer.personalDetails')}
            </Text>

            {type === 'group' && (
              <Choice
                label={
                  member.is_team_leader
                    ? '★ ' + t('volunteer.groupLeader')
                    : t('volunteer.setGroupLeader')
                }
                selected={member.is_team_leader}
                disabled={submitting || uncertain}
                onPress={selectLeader}
              />
            )}

            {field('full_name', t('volunteer.fullName') + ' *')}

            {field(
              'mobile',
              t('volunteer.mobile') + ' *',
              t('volunteer.enterMobile'),
              'phone-pad',
              false,
              20
            )}

            {field(
              'email',
              t('volunteer.emailOptional'),
              t('volunteer.enterEmail'),
              'email-address'
            )}

            {field(
              'date_of_birth',
              t('volunteer.dateOfBirth') + ' *',
              'YYYY-MM-DD',
              'default',
              false,
              10
            )}

            <Text style={styles.label}>
              {t("volunteer.gender")} *
            </Text>

            <View style={styles.row}>
              {(['male', 'female', 'other'] as const)
                .map(gender => (
                  <Choice
                    key={gender}
                    label={
                      t(`volunteer.${gender}`)
                    }
                    selected={member.gender === gender}
                    disabled={submitting || uncertain}
                    onPress={() =>
                      updateMember({ gender })
                    }
                  />
                ))}
            </View>
          </View>

          <View style={styles.panel}>
            <Text style={styles.heading}>
              {t('volunteer.addressDetails')}
            </Text>

            {field('country', t('volunteer.country') + ' *', '', 'default', false, 100)}

            {field('pincode', t('volunteer.pincode') + ' *', '', 'default', false, 20)}

            {field('state', t('volunteer.state') + ' *', '', 'default', false, 100)}

            {field('district', t('volunteer.district') + ' *', '', 'default', false, 100)}

            {field('mandal', t('volunteer.mandalOptional'), '', 'default', false, 100)}

            {field('city', t('volunteer.cityOptional'), '', 'default', false, 100)}

            {field('street', t('volunteer.streetOptional'), '', 'default', true, 5000)}

            {field('door_number', t('volunteer.doorOptional'), '', 'default', false, 100)}
          </View>

          <View style={styles.panel}>
            <Text style={styles.heading}>
              {t('volunteer.additionalInformation')}
            </Text>

            {field('qualification', t('volunteer.qualificationOptional'), '', 'default', false, 150)}

            {field('profession', t('volunteer.professionOptional'), '', 'default', false, 150)}

            {field(
              'area_of_interest',
              t('volunteer.interestOptional'),
              t('volunteer.howToServe'),
              'default',
              true,
              5000
            )}
          </View>

          <View style={styles.panel}>
            <Text style={styles.heading}>
              {t("volunteer.availability")} *
            </Text>

            <Text style={styles.description}>
              {t('volunteer.selectAvailableShifts')}
            </Text>

            {availableShifts.length === 0 && (
              <Text style={styles.error}>
                {t('volunteer.noFutureShifts')}
              </Text>
            )}

            {availableShifts.map(shift => {
              const selected =
                member.shift_ids.includes(shift.id);

              return (
                <TouchableOpacity
                  key={shift.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{
                    checked: selected,
                    disabled: submitting || uncertain,
                  }}
                  disabled={submitting || uncertain}
                  style={[
                    styles.shift,
                    selected && styles.selectedShift,
                  ]}
                  onPress={() => toggleShift(shift.id)}
                >
                  <Text style={styles.shiftTitle}>
                    {selected ? '☑' : '☐'}
                    {'  '}
                    {shift.shift_name}
                  </Text>

                  <Text style={styles.description}>
                    {formatVolunteerDate(shift.service_date)}
                  </Text>

                  <Text style={styles.description}>
                    {formatVolunteerTime(shift.start_time)}
                    {' – '}
                    {formatVolunteerTime(shift.end_time)}
                    {' IST'}
                  </Text>
                </TouchableOpacity>
              );
            })}

            <Text style={styles.label}>
              Selected shifts: {member.shift_ids.length}
            </Text>
          </View>

          {type === 'group' && (
            <View style={styles.panel}>
              <VolunteerButton
                title={'＋ ' + t('volunteer.addMember')}
                secondary
                disabled={
                  submitting ||
                  uncertain ||
                  members.length >= Math.min(
                    500,
                    opportunity.maximum_group_size
                  )
                }
                onPress={addMember}
              />

              {members.length > 1 && (
                <TouchableOpacity
                  disabled={submitting || uncertain}
                  onPress={removeMember}
                >
                  <Text style={styles.remove}>
                    {t('volunteer.removeMember')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <View style={styles.panel}>
            <Text style={styles.heading}>
              {t('volunteer.registrationSummary')}
            </Text>

            <Text style={styles.description}>
              Type: {type === 'group' ? 'Group' : 'Individual'}
            </Text>

            <Text style={styles.description}>
              Total volunteers: {members.length}
            </Text>

            <Text style={styles.label}>
              {t('volunteer.remarksOptional')}
            </Text>

            <TextInput
              style={[styles.input, styles.multiline]}
              value={remarks}
              multiline
              maxLength={5000}
              editable={!submitting && !uncertain}
              placeholder={t('volunteer.additionalInformation')}
              placeholderTextColor={C.muted}
              onChangeText={value => {
                setRemarks(value);
                setConsent(false);
              }}
            />

            <TouchableOpacity
              accessibilityRole="checkbox"
              accessibilityState={{ checked: consent }}
              disabled={submitting || uncertain}
              style={styles.consent}
              onPress={() => setConsent(!consent)}
            >
              <Text style={styles.consentText}>
                {consent ? '☑' : '☐'}
                {'  '}
                {t('volunteer.consentStatement')}
              </Text>
            </TouchableOpacity>

            {!!formError && (
              <Text style={styles.error}>
                {formError}
              </Text>
            )}

            {uncertain ? (
              <VolunteerButton
                title={
                  submitting
                    ? t('volunteer.checking')
                    : t('volunteer.checkRegistrationStatus')
                }
                disabled={submitting}
                onPress={() => void checkRegistration()}
              />
            ) : (
              <VolunteerButton
                title={
                  submitting
                    ? t('volunteer.submitting')
                    : t('volunteer.submitRegistration')
                }
                disabled={
                  submitting ||
                  !registrationOpen ||
                  availableShifts.length === 0 ||
                  !consent
                }
                onPress={() => void submit()}
              />
            )}

            <Text style={styles.note}>
              {t('volunteer.approvalNote')}
            </Text>
          </View>
        </ScrollView>
      )}
    </VolunteerScreen>
  );
}

function Choice({
  label,
  selected,
  onPress,
  disabled = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.choice,
        selected && styles.selectedChoice,
      ]}
    >
      <Text
        style={[
          styles.choiceText,
          selected && styles.selectedChoiceText,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 45,
  },

  hero: {
    backgroundColor: C.maroon,
    borderRadius: 20,
    padding: 22,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.gold,
  },

  heroLabel: {
    color: '#EAD19A',
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: '700',
  },

  heroTitle: {
    color: '#FFFFFF',
    fontSize: 23,
    fontWeight: '800',
    marginTop: 10,
  },

  heroText: {
    color: '#F7EBD7',
    fontSize: 13,
    marginTop: 9,
  },

  panel: {
    backgroundColor: C.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    padding: 17,
    marginBottom: 15,
  },

  heading: {
    color: C.maroon,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },

  field: {
    marginBottom: 14,
  },

  label: {
    color: C.text,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 8,
  },

  input: {
    color: C.text,
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    minHeight: 48,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 14,
  },

  multiline: {
    minHeight: 90,
    textAlignVertical: 'top',
  },

  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  choice: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 12,
    backgroundColor: C.lightGold,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 5,
  },

  selectedChoice: {
    backgroundColor: C.maroon,
    borderColor: C.maroon,
  },

  choiceText: {
    color: C.maroon,
    fontSize: 13,
    fontWeight: '600',
  },

  selectedChoiceText: {
    color: '#FFFFFF',
  },

  description: {
    color: C.muted,
    fontSize: 13,
    lineHeight: 21,
    marginBottom: 8,
  },

  shift: {
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    marginTop: 8,
    backgroundColor: C.background,
  },

  selectedShift: {
    borderColor: C.maroon,
    backgroundColor: C.lightGold,
  },

  shiftTitle: {
    color: C.maroon,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 7,
  },

  remove: {
    color: C.red,
    textAlign: 'center',
    padding: 15,
    fontWeight: '600',
  },

  consent: {
    backgroundColor: C.lightGold,
    borderRadius: 12,
    padding: 14,
    marginVertical: 15,
  },

  consentText: {
    color: C.text,
    fontSize: 13,
    lineHeight: 21,
  },

  error: {
    color: C.red,
    backgroundColor: C.lightRed,
    padding: 13,
    borderRadius: 10,
    lineHeight: 20,
    fontSize: 13,
    marginVertical: 10,
  },

  note: {
    color: C.muted,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 14,
    textAlign: 'center',
  },

  successIcon: {
    color: C.green,
    fontSize: 58,
    textAlign: 'center',
  },

  successTitle: {
    color: C.maroon,
    fontSize: 23,
    textAlign: 'center',
    fontWeight: '800',
    marginVertical: 15,
  },

  code: {
    backgroundColor: C.lightGold,
    color: C.maroon,
    borderRadius: 12,
    padding: 15,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginVertical: 18,
  },
});