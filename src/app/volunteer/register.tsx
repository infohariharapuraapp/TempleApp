import React, {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
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
import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

import {
  getVolunteerOpportunity,
  getVolunteerServiceDates,
  getVolunteerShifts,
  formatVolunteerTime,
  submitVolunteerRegistration,
  getMyVolunteerRegistrations,
  getVolunteerError,
  formatVolunteerDate,
} from '@/services/volunteerApi';

import type {
  VolunteerShift,
  VolunteerOpportunity,
  VolunteerMemberInput,
  VolunteerRegistrationInput,
  VolunteerServiceDateAvailability,
} from '@/services/volunteerApi';

import {
  createEmptyMember,
  isValidBirthDate,
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

import VolunteerPhotoPicker, {
  type VolunteerPhotoSelection,
} from '@/components/volunteer/VolunteerPhotoPicker';
import { ApiError } from '@/services/api';

type RegistrationType = 'individual' | 'group';

type TextField = Exclude<
  keyof VolunteerMemberInput,
  'gender' | 'is_team_leader' | 'shift_ids' | 'service_dates' | 'photo_upload_id'
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

  const [serviceDates, setServiceDates] =
    useState<string[]>([]);
  const [serviceDateAvailability, setServiceDateAvailability] =
    useState<VolunteerServiceDateAvailability[]>([]);
  const [shifts, setShifts] =
    useState<VolunteerShift[]>([]);
  const isLegacy =
    (opportunity?.attendance_mode ?? 'legacy') === 'legacy';
  const availableShifts = shifts.filter(shift => {
    const start = Date.parse(
      shift.service_date.slice(0, 10) +
      'T' +
      shift.start_time.slice(0, 8) +
      '+05:30'
    );
    return Number.isFinite(start) && start > Date.now();
  });

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

  const [photos, setPhotos] =
    useState<Record<string, VolunteerPhotoSelection>>({});
  const [photoBusy, setPhotoBusy] =
    useState(false);
  const photoLock = useRef(false);
  const [consent, setConsent] =
    useState(false);

  const mounted = useRef(false);
  const version = useRef(0);
  const scrollRef = useRef<ScrollView>(null);
  const inputRefs = useRef<
    Partial<Record<TextField, TextInput | null>>
  >({});
  const dobInputRef = useRef<TextInput | null>(null);
  const focusOrder: TextField[] = [
    'full_name',
    'mobile',
    'email',
    'country',
    'pincode',
    'state',
    'district',
    'mandal',
    'city',
    'street',
    'door_number',
    'qualification',
    'profession',
    'area_of_interest',
  ];
  function focusNextField(current: TextField) {
    const index = focusOrder.indexOf(current);
    const next = focusOrder[index + 1];
    if (next) {
      inputRefs.current[next]?.focus();
    } else {
      Keyboard.dismiss();
    }
  }

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

      const [item, history] =
        await Promise.all([
          getVolunteerOpportunity(id),
          getMyVolunteerRegistrations(),
        ]);
      const legacy =
        (item.attendance_mode ?? 'legacy') === 'legacy';
      const available = legacy
        ? null
        : await getVolunteerServiceDates(id);
      const loadedShifts = legacy
        ? await getVolunteerShifts(id)
        : [];

      if (
        !mounted.current ||
        requestVersion !== version.current
      ) {
        return;
      }

      setOpportunity(item);
      const capacityDates = available?.registration_open
        ? available.service_dates
        : [];
      setServiceDateAvailability(capacityDates);
      setServiceDates(
        capacityDates.map(item => item.service_date)
      );
      setShifts(loadedShifts);

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
  function handleRegistrationHeaderBack() {
    if (photoLock.current || submitting) {
      return;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/seva-registration');
    }
  }
  function handlePhotoBusy(busy: boolean) {
    photoLock.current = busy;
    setPhotoBusy(busy);
  }
  function handlePhotoChange(
    photo: VolunteerPhotoSelection
  ) {
    if (
      !mounted.current ||
      submissionRunning ||
      uncertain
    ) {
      return;
    }
    setPhotos(previous => ({
      ...previous,
      [photo.uploadId]: photo,
    }));
    setMembers(previous =>
      previous.map((item, index) =>
        index === memberIndex
          ? {
              ...item,
              photo_upload_id: photo.uploadId,
            }
          : item
      )
    );
    setConsent(false);
    setFormError('');
  }
  function hasValidPhoto(
    item: VolunteerMemberInput
  ): boolean {
    if (!item.photo_upload_id) return false;
    const photo = photos[item.photo_upload_id];
    return Boolean(
      photo &&
      Date.parse(photo.expiresAt) > Date.now() + 60000
    );
  }
  const uploadedPhotoCount =
    members.filter(hasValidPhoto).length;

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
    if (photoLock.current) return;
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
    if (photoLock.current) return;
    setMemberIndex(index);
    setFormError('');

    scrollRef.current?.scrollTo({
      y: 0,
      animated: true,
    });
  }

  function addMember() {
    if (photoLock.current) return;
    if (!member || !hasValidPhoto(member)) {
      setFormError(
        t(
          'volunteer.photoRequired',
          'Upload a valid photograph for this member before adding another member.'
        )
      );
      return;
    }
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
      availableShifts,
      isLegacy ? undefined : serviceDates
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
    if (photoLock.current) return;
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
    const selected = member.shift_ids;
    updateMember({
      service_dates: undefined,
      shift_ids: selected.includes(shiftId)
        ? selected.filter(value => value !== shiftId)
        : [...selected, shiftId],
    });
  }
  function getDateAvailability(date: string) {
    return serviceDateAvailability.find(
      item => item.service_date === date
    );
  }
  function toggleServiceDate(date: string) {
    const availability = getDateAvailability(date);
    if (!availability || availability.status === 'full') {
      return;
    }
    const selected = member.service_dates ?? [];
    updateMember({
      shift_ids: [],
      service_dates: selected.includes(date)
        ? selected.filter(value => value !== date)
        : [...selected, date].sort(),
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
    if (photoLock.current) return;
    const invalidPhotoIndex =
      members.findIndex(item => !hasValidPhoto(item));
    if (invalidPhotoIndex !== -1) {
      selectMember(invalidPhotoIndex);
      setFormError(
        `Member ${invalidPhotoIndex + 1}: Upload a valid passport-size photograph before submitting.`
      );
      return;
    }
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
      photo_required: true,
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
        availableShifts,
        isLegacy ? undefined : serviceDates
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
          ref={ref => {
            inputRefs.current[key] = ref;
          }}
          style={[
            styles.input,
            multiline && styles.multiline,
          ]}
          value={String(member?.[key] ?? '')}
          placeholder={placeholder}
          placeholderTextColor={C.muted}
          editable={!submitting && !uncertain && !photoBusy}
          keyboardType={keyboardType}
          multiline={multiline}
          maxLength={maxLength}
          returnKeyType={
            key === 'area_of_interest' ? 'done' : 'next'
          }
          blurOnSubmit={multiline}
          onSubmitEditing={() => {
            if (key === 'email') {
              dobInputRef.current?.focus();
            } else if (key === 'area_of_interest') {
              Keyboard.dismiss();
            } else {
              focusNextField(key);
            }
          }}
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

  const todayIST = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const today = ['year', 'month', 'day']
    .map(type =>
      todayIST.find(part => part.type === type)?.value
    )
    .join('-');
  const availableDates = serviceDates
    .filter(date => date >= today)
    .sort();

  return (
    <VolunteerScreen onBack={handleRegistrationHeaderBack}
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
        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={
            Platform.OS === 'ios'
              ? 'padding'
              : 'height'
          }
          keyboardVerticalOffset={0}
        >
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          style={styles.keyboardContainer}
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
                  disabled={submitting || uncertain || photoBusy}
                  onPress={() =>
                    switchType('individual')
                  }
                />
              )}

              {opportunity.allow_group && (
                <Choice
                  label={t('volunteer.group')}
                  selected={type === 'group'}
                  disabled={submitting || uncertain || photoBusy}
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
                  editable={!submitting && !uncertain && !photoBusy}
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
                      disabled={submitting || uncertain || photoBusy}
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
                disabled={submitting || uncertain || photoBusy}
                onPress={selectLeader}
              />
            )}

            <VolunteerPhotoPicker
              key={`${id}-${memberIndex}`}
              opportunityId={id}
              value={
                member.photo_upload_id
                  ? photos[member.photo_upload_id]
                  : undefined
              }
              disabled={
                submitting ||
                uncertain ||
                !registrationOpen
              }
              onBusyChange={handlePhotoBusy}
              onChange={handlePhotoChange}
            />
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

            <VolunteerBirthDateField
              key={`${id}-${memberIndex}-dob`}
              value={member.date_of_birth}
              firstInputRef={dobInputRef}
              onNext={() => inputRefs.current.country?.focus()}
              disabled={
                submitting ||
                uncertain ||
                photoBusy ||
                !registrationOpen
              }
              onChange={value =>
                updateMember({
                  date_of_birth: value,
                })
              }
            />

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
                    disabled={submitting || uncertain || photoBusy}
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

            {isLegacy ? (
              <>
                <Text style={styles.description}>
                  {t(
                    'volunteer.chooseShifts',
                    'Select your available service shifts.'
                  )}
                </Text>
                {availableShifts.length === 0 && (
                  <Text style={styles.error}>
                    {t(
                      'volunteer.noShifts',
                      'No service shifts are currently available.'
                    )}
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
                        disabled: submitting || uncertain || photoBusy,
                      }}
                      disabled={submitting || uncertain || photoBusy}
                      onPress={() => toggleShift(shift.id)}
                      style={{
                        padding: 14,
                        marginTop: 10,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: selected
                          ? C.maroon
                          : C.border,
                        backgroundColor: selected
                          ? C.lightGold
                          : C.white,
                      }}
                    >
                      <Text style={{
                        color: C.maroon,
                        fontWeight: '700',
                        fontSize: 15,
                      }}>
                        {selected ? '✓ ' : ''}
                        {shift.shift_name}
                      </Text>
                      <Text style={styles.description}>
                        {formatVolunteerDate(
                          shift.service_date
                        )}
                      </Text>
                      <Text style={styles.description}>
                        {formatVolunteerTime(
                          shift.start_time
                        )}
                        {' - '}
                        {formatVolunteerTime(
                          shift.end_time
                        )}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                <Text style={{
                  marginTop: 12,
                  fontWeight: '700',
                  color: C.maroon,
                }}>
                  {t(
                    'volunteer.selectedShifts',
                    'Selected shifts'
                  )}
                  {': '}
                  {member.shift_ids.length}
                </Text>
              </>
            ) : (
              <>
            <Text style={styles.description}>
              {t(
                'volunteer.chooseServiceDates',
                'Choose the dates on which you are available to perform Seva.'
              )}
            </Text>
            {availableDates.length === 0 ? (
              <Text style={styles.error}>
                {t(
                  'volunteer.noServiceDates',
                  'No service dates are currently available.'
                )}
              </Text>
            ) : (
              <>
                <View style={{
                  flexDirection: 'row',
                  gap: 8,
                  marginVertical: 12,
                }}>
                  <View style={{ flex: 1 }}>
                    <VolunteerButton
                      title={t(
                        'volunteer.selectAllDates',
                        'Select All'
                      )}
                      secondary
                      disabled={submitting || uncertain || photoBusy}
                      onPress={() =>
                        updateMember({
                          shift_ids: [],
                          service_dates: availableDates.filter(date =>
                            getDateAvailability(date)?.status !== 'full'
                          ),
                        })
                      }
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <VolunteerButton
                      title={t(
                        'volunteer.clearDates',
                        'Clear All'
                      )}
                      secondary
                      disabled={submitting || uncertain || photoBusy}
                      onPress={() =>
                        updateMember({
                          shift_ids: [],
                          service_dates: [],
                        })
                      }
                    />
                  </View>
                </View>
                <View style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 8,
                }}>
                  {availableDates.map(date => {
                    const selected =
                      (member.service_dates ?? []).includes(date);
                    const availability = getDateAvailability(date);
                    if (!availability) return null;
                    const isFull = availability.status === 'full';
                    const isLimited = availability.status === 'limited';
                    const cardBackground = isFull
                      ? '#FFEBEE'
                      : isLimited
                        ? '#FFF8E1'
                        : '#E8F5E9';
                    const cardBorder = isFull
                      ? '#C62828'
                      : isLimited
                        ? '#F9A825'
                        : '#2E7D32';
                    const cardText = isFull
                      ? '#B71C1C'
                      : isLimited
                        ? '#795500'
                        : '#1B5E20';
                    return (
                      <TouchableOpacity
                        key={date}
                        accessibilityRole="checkbox"
                        accessibilityLabel={`${formatVolunteerDate(date)}, ${availability.remaining} slots remaining`}
                        accessibilityState={{
                          checked: selected,
                          disabled: isFull || submitting || uncertain || photoBusy,
                        }}
                        disabled={
                          isFull || submitting || uncertain || photoBusy
                        }
                        onPress={() => toggleServiceDate(date)}
                        style={{
                          width: '47%',
                          padding: 12,
                          borderRadius: 12,
                          borderWidth: selected ? 2 : 1,
                          borderColor: selected ? C.maroon : cardBorder,
                          backgroundColor: cardBackground,
                          opacity: isFull ? 0.8 : 1,
                        }}
                      >
                        <Text style={{
                          color: cardText,
                          fontWeight: '700',
                          textAlign: 'center',
                        }}>
                          {selected ? '✓ ' : ''}
                          {formatVolunteerDate(date)}
                        </Text>
                        <Text style={{
                          color: cardText,
                          fontSize: 12,
                          fontWeight: '600',
                          textAlign: 'center',
                          marginTop: 6,
                        }}>
                          {isFull
                            ? 'FULL'
                            : isLimited
                              ? 'LIMITED'
                              : 'AVAILABLE'}
                        </Text>
                        <Text style={{
                          color: cardText,
                          fontSize: 11,
                          textAlign: 'center',
                          marginTop: 4,
                        }}>
                          Required: {availability.capacity}
                        </Text>
                        <Text style={{
                          color: cardText,
                          fontSize: 11,
                          textAlign: 'center',
                        }}>
                          Registered: {availability.registered}
                        </Text>
                        <Text style={{
                          color: cardText,
                          fontSize: 12,
                          fontWeight: '700',
                          textAlign: 'center',
                          marginTop: 3,
                        }}>
                          Remaining: {availability.remaining}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
            <View style={{
              backgroundColor: C.lightGold,
              padding: 12,
              borderRadius: 12,
              marginTop: 14,
            }}>
              <Text style={styles.label}>
                {t(
                  'volunteer.selectedServiceDates',
                  'Selected Service Dates'
                )}
                {': '}
                {(member.service_dates ?? []).length}
              </Text>
              <Text style={styles.description}>
                {(member.service_dates ?? [])
                  .map(date => formatVolunteerDate(date))
                  .join(', ')}
              </Text>
            </View>
            <Text style={styles.description}>
              {t(
                'volunteer.reportingAfterApproval',
                'Reporting time and coordinator details will be communicated after approval.'
              )}
            </Text>
              </>
            )}
          </View>

          {type === 'group' && (
            <View style={styles.panel}>
              <VolunteerButton
                title={'＋ ' + t('volunteer.addMember')}
                secondary
                disabled={
                  submitting ||
                  uncertain ||
                  photoBusy ||
                  members.length >= Math.min(
                    500,
                    opportunity.maximum_group_size
                  )
                }
                onPress={addMember}
              />

              {members.length > 1 && (
                <TouchableOpacity
                  disabled={submitting || uncertain || photoBusy}
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
            <Text style={{
              color:
                uploadedPhotoCount === members.length
                  ? C.green
                  : C.red,
              fontWeight: '700',
              fontSize: 13,
              marginBottom: 10,
            }}>
              {t(
                'volunteer.photosUploaded',
                'Photographs uploaded'
              )}
              {': '}
              {uploadedPhotoCount} / {members.length}
            </Text>

            <Text style={styles.label}>
              {t('volunteer.remarksOptional')}
            </Text>

            <TextInput
              style={[styles.input, styles.multiline]}
              value={remarks}
              multiline
              maxLength={5000}
              editable={!submitting && !uncertain && !photoBusy}
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
              disabled={submitting || uncertain || photoBusy}
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
                  photoBusy ||
                  uploadedPhotoCount !== members.length ||
                  !registrationOpen ||
                  (isLegacy
                    ? availableShifts.length === 0
                    : availableDates.length === 0) ||
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
        </KeyboardAvoidingView>
      )}
    </VolunteerScreen>
  );
}

// ========================================
// VOLUNTEER DATE OF BIRTH
// ========================================
function VolunteerBirthDateField({
  value,
  disabled = false,
  onChange,
  firstInputRef,
  onNext,
}: {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  firstInputRef: React.RefObject<TextInput | null>;
  onNext: () => void;
}) {
  const { t } = useTranslation();
  const monthInputRef = useRef<TextInput | null>(null);
  const yearInputRef = useRef<TextInput | null>(null);
  const [showPicker, setShowPicker] =
    useState(false);
  const todayParts =
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
  const todayISO = ['year', 'month', 'day']
    .map(type =>
      todayParts.find(
        part => part.type === type
      )?.value
    )
    .join('-');
  function parseLocalDate(input: string): Date {
    const [year, month, day] =
      input.split('-').map(Number);
    const result = new Date(2000, 0, 1, 12);
    result.setFullYear(
      year,
      month - 1,
      day
    );
    return result;
  }
  function toISODate(date: Date): string {
    const year = String(
      date.getFullYear()
    ).padStart(4, '0');
    const month = String(
      date.getMonth() + 1
    ).padStart(2, '0');
    const day = String(
      date.getDate()
    ).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  const maximumDate =
    parseLocalDate(todayISO);
  maximumDate.setHours(
    23,
    59,
    59,
    999
  );
  const selectedDate =
    isValidBirthDate(value)
      ? parseLocalDate(value)
      : parseLocalDate(todayISO);
  const [draftDate, setDraftDate] =
    useState(selectedDate);
  const displayValue =
    isValidBirthDate(value)
      ? value.split('-').reverse().join('-')
      : '';
  const [manualDay, setManualDay] = useState(
    value ? value.slice(8, 10) : ''
  );
  const [manualMonth, setManualMonth] = useState(
    value ? value.slice(5, 7) : ''
  );
  const [manualYear, setManualYear] = useState(
    value ? value.slice(0, 4) : ''
  );
  useEffect(() => {
    if (isValidBirthDate(value)) {
      setManualDay(value.slice(8, 10));
      setManualMonth(value.slice(5, 7));
      setManualYear(value.slice(0, 4));
    }
  }, [value]);
  function updateManualDate(
    day: string,
    month: string,
    year: string
  ) {
    if (disabled) return;
    if (
      day.length === 2 &&
      month.length === 2 &&
      year.length === 4
    ) {
      const iso = `${year}-${month}-${day}`;
      if (isValidBirthDate(iso)) {
        onChange(iso);
      } else {
        onChange('');
      }
    } else {
      onChange('');
    }
  }
  function saveDate(date: Date) {
    if (disabled) return;
    const formatted = toISODate(date);
    if (isValidBirthDate(formatted)) {
      onChange(formatted);
    }
  }
  function openPicker() {
    if (disabled) return;
    Keyboard.dismiss();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: selectedDate,
        mode: 'date',
        display: 'default',
        maximumDate,
        onChange: (event, date) => {
          if (
            event.type === 'set' &&
            date
          ) {
            saveDate(date);
          }
        },
      });
      return;
    }
    setDraftDate(selectedDate);
    setShowPicker(true);
  }
  return (
    <View style={styles.dobField}>
      <Text style={styles.label}>
        {t('volunteer.dateOfBirth', 'Date of Birth')} *
      </Text>
      <View style={styles.dobManualRow}>
        <TextInput
          style={styles.dobManualInput}
          ref={firstInputRef}
          placeholder="DD"
          placeholderTextColor={C.muted}
          keyboardType="number-pad"
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => monthInputRef.current?.focus()}
          maxLength={2}
          editable={!disabled}
          value={manualDay}
          onChangeText={text => {
            const day = text.replace(/\D/g, '');
            setManualDay(day);
            updateManualDate(day, manualMonth, manualYear);
          }}
        />
        <TextInput
          style={styles.dobManualInput}
          ref={monthInputRef}
          placeholder="MM"
          placeholderTextColor={C.muted}
          keyboardType="number-pad"
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => yearInputRef.current?.focus()}
          maxLength={2}
          editable={!disabled}
          value={manualMonth}
          onChangeText={text => {
            const month = text.replace(/\D/g, '');
            setManualMonth(month);
            updateManualDate(manualDay, month, manualYear);
          }}
        />
        <TextInput
          style={styles.dobManualInput}
          ref={yearInputRef}
          placeholder="YYYY"
          placeholderTextColor={C.muted}
          keyboardType="number-pad"
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={onNext}
          maxLength={4}
          editable={!disabled}
          value={manualYear}
          onChangeText={text => {
            const year = text.replace(/\D/g, '');
            setManualYear(year);
            updateManualDate(manualDay, manualMonth, year);
          }}
        />
      </View>
      {Platform.OS === 'web' ? (
        <TextInput
          value={value}
          editable={!disabled}
          onChangeText={onChange}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={C.muted}
          maxLength={10}
          style={styles.dobWebInput}
        />
      ) : (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={
            t(
              'volunteer.dateOfBirth',
              'Date of Birth'
            ) + ': ' + (
              displayValue || 'Select date'
            )
          }
          accessibilityState={{ disabled }}
          disabled={disabled}
          activeOpacity={0.8}
          onPress={openPicker}
          style={[
            styles.dobButton,
            disabled && styles.dobDisabled,
          ]}
        >
          <Text
            style={[
              styles.dobValue,
              !displayValue &&
                styles.dobPlaceholder,
            ]}
          >
            {displayValue ||
              t(
                'volunteer.selectBirthDate',
                'Select Date of Birth'
              )}
          </Text>
          <View style={styles.dobIcon}>
            <Ionicons
              name="calendar-outline"
              size={21}
              color={C.maroon}
            />
          </View>
        </TouchableOpacity>
      )}
      <Text style={styles.dobHint}>
        {Platform.OS === 'web'
          ? 'YYYY-MM-DD'
          : t(
              'volunteer.birthDateHint',
              'DD-MM-YYYY - Tap to select date'
            )}
      </Text>
      {Platform.OS === 'ios' &&
        showPicker &&
        !disabled && (
          <View style={styles.dobPickerPanel}>
            <DateTimePicker
              value={draftDate}
              mode="date"
              display="spinner"
              maximumDate={maximumDate}
              onChange={(event, date) => {
                if (
                  event.type === 'set' &&
                  date
                ) {
                  setDraftDate(date);
                }
              }}
            />
            <View style={styles.dobPickerActions}>
              <View style={styles.dobActionItem}>
                <VolunteerButton
                  title={t('common.cancel', 'Cancel')}
                  secondary
                  onPress={() =>
                    setShowPicker(false)
                  }
                />
              </View>
              <View style={styles.dobActionItem}>
                <VolunteerButton
                  title={t('common.done', 'Done')}
                  onPress={() => {
                    saveDate(draftDate);
                    setShowPicker(false);
                  }}
                />
              </View>
            </View>
          </View>
        )}
    </View>
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
  keyboardContainer: {
    flex: 1,
  },
  dobManualRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  dobManualInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#E2D1B5',
    borderRadius: 12,
    backgroundColor: '#FFFDF8',
    paddingHorizontal: 10,
    color: '#38251C',
    fontSize: 15,
    textAlign: 'center',
  },
  dobField: {
    marginBottom: 15,
  },
  dobButton: {
    minHeight: 55,
    borderWidth: 1,
    borderColor: '#E2D1B5',
    borderRadius: 13,
    backgroundColor: '#FFFDF8',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dobDisabled: {
    opacity: 0.5,
  },
  dobValue: {
    flex: 1,
    color: '#38251C',
    fontSize: 15,
    fontWeight: '600',
  },
  dobPlaceholder: {
    color: '#85756A',
    fontWeight: '400',
  },
  dobIcon: {
    height: 36,
    width: 36,
    borderRadius: 10,
    backgroundColor: '#F7EBD7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dobHint: {
    color: '#85756A',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 6,
  },
  dobPickerPanel: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EADFCC',
    borderRadius: 15,
    marginTop: 10,
    padding: 12,
  },
  dobPickerActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  dobActionItem: {
    flex: 1,
  },
  dobWebInput: {
    minHeight: 55,
    borderWidth: 1,
    borderColor: '#E2D1B5',
    borderRadius: 13,
    backgroundColor: '#FFFDF8',
    paddingHorizontal: 14,
    color: '#38251C',
    fontSize: 15,
  },
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