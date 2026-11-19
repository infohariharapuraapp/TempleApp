import i18n from '@/localization/i18n';

import type {
  VolunteerMemberInput,
  VolunteerOpportunity,
  VolunteerRegistrationInput,
  VolunteerShift,
} from '@/services/volunteerApi';

export function createEmptyMember(): VolunteerMemberInput {
  return {
    full_name: '',
    mobile: '',
    email: '',
    date_of_birth: '',
    gender: '' as VolunteerMemberInput['gender'],
    country: 'India',
    pincode: '',
    state: '',
    district: '',
    mandal: '',
    city: '',
    street: '',
    door_number: '',
    qualification: '',
    profession: '',
    area_of_interest: '',
    is_team_leader: false,
    shift_ids: [],
  };
}

function getTodayIST(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  return ['year', 'month', 'day']
    .map(type =>
      parts.find(part => part.type === type)?.value
    )
    .join('-');
}

export function isValidBirthDate(
  value: string
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value &&
    value <= getTodayIST()
  );
}

export function normalizeVolunteerMember(
  member: VolunteerMemberInput
): VolunteerMemberInput {
  return {
    ...member,
    full_name: member.full_name.trim(),
    mobile: member.mobile.replace(/[\s-]/g, ''),
    email: member.email?.trim(),
    country: member.country.trim(),
    pincode: member.pincode.trim(),
    state: member.state.trim(),
    district: member.district.trim(),
    mandal: member.mandal?.trim(),
    city: member.city?.trim(),
    street: member.street?.trim(),
    door_number: member.door_number?.trim(),
    qualification: member.qualification?.trim(),
    profession: member.profession?.trim(),
    area_of_interest: member.area_of_interest?.trim(),
    shift_ids: [...new Set(member.shift_ids)],
  };
}

export function validateVolunteerMember(
  member: VolunteerMemberInput,
  availableShifts: VolunteerShift[]
): string | null {
  const m = normalizeVolunteerMember(member);

  if (!m.full_name || m.full_name.length > 255) {
    return i18n.t('volunteer.invalidName');
  }

  if (
    member.mobile.trim().length > 20 ||
    !/^\+?[0-9]{10,15}$/.test(m.mobile)
  ) {
    return i18n.t('volunteer.invalidMobile');
  }

  if (
    m.email &&
    (
      m.email.length > 255 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.email)
    )
  ) {
    return i18n.t('volunteer.invalidEmail');
  }

  if (!isValidBirthDate(m.date_of_birth)) {
    return i18n.t('volunteer.invalidBirthDate');
  }

  if (!['male', 'female', 'other'].includes(m.gender)) {
    return i18n.t('volunteer.selectGender');
  }

  if (!m.country || m.country.length > 100) {
    return i18n.t('volunteer.invalidCountry');
  }

  if (!m.pincode || m.pincode.length > 20) {
    return i18n.t('volunteer.invalidPincode');
  }

  if (
    m.country.toLowerCase() === 'india' &&
    !/^[1-9]\d{5}$/.test(m.pincode)
  ) {
    return i18n.t('volunteer.invalidIndianPincode');
  }

  if (!m.state || m.state.length > 100) {
    return i18n.t('volunteer.invalidState');
  }

  if (!m.district || m.district.length > 100) {
    return i18n.t('volunteer.invalidDistrict');
  }

  const optionalFields = [
    ['Mandal', m.mandal, 100],
    ['City', m.city, 100],
    ['Street', m.street, 5000],
    ['Door number', m.door_number, 100],
    ['Qualification', m.qualification, 150],
    ['Profession', m.profession, 150],
    ['Area of interest', m.area_of_interest, 5000],
  ] as const;

  for (const [label, value, limit] of optionalFields) {
    if (value && value.length > limit) {
      return `${label} is too long.`;
    }
  }

  if (
    m.shift_ids.length === 0 ||
    m.shift_ids.length > 500
  ) {
    return i18n.t('volunteer.selectShift');
  }

  const availableIds = new Set(
    availableShifts
      .filter(shift => {
        const startAt = Date.parse(
          `${shift.service_date.slice(0, 10)}T${shift.start_time.slice(0, 8)}+05:30`
        );

        return (
          Number.isFinite(startAt) &&
          startAt > Date.now()
        );
      })
      .map(shift => shift.id)
  );

  if (
    m.shift_ids.some(id => !availableIds.has(id))
  ) {
    return i18n.t('volunteer.shiftUnavailable');
  }

  return null;
}

export function validateVolunteerRegistration(
  input: VolunteerRegistrationInput,
  opportunity: VolunteerOpportunity,
  shifts: VolunteerShift[]
): string | null {
  if (input.opportunity_id !== opportunity.id) {
    return i18n.t('volunteer.invalidOpportunity');
  }

  if (
    opportunity.registration_status !== 'open' ||
    !(Date.parse(opportunity.registration_start_at) <= Date.now()) ||
    !(Date.parse(opportunity.registration_end_at) > Date.now())
  ) {
    return i18n.t('volunteer.registrationClosed');
  }

  if (
    input.registration_type !== 'individual' &&
    input.registration_type !== 'group'
  ) {
    return i18n.t('volunteer.invalidRegistrationType');
  }

  if (
    input.members.length === 0 ||
    input.members.length > 500
  ) {
    return i18n.t('volunteer.invalidVolunteerCount');
  }

  if (input.registration_type === 'individual') {
    if (!opportunity.allow_individual) {
      return i18n.t('volunteer.individualDisabled');
    }

    if (input.members.length !== 1) {
      return i18n.t('volunteer.individualCount');
    }
  }

  if (input.registration_type === 'group') {
    if (!opportunity.allow_group) {
      return i18n.t('volunteer.groupDisabled');
    }

    if (
      input.members.length < opportunity.minimum_group_size ||
      input.members.length > opportunity.maximum_group_size
    ) {
      return (
        `Group size must be between ` +
        `${opportunity.minimum_group_size} and ` +
        `${opportunity.maximum_group_size} members.`
      );
    }

    if (
      input.members.filter(
        member => member.is_team_leader
      ).length !== 1
    ) {
      return i18n.t('volunteer.selectOneLeader');
    }

    if ((input.group_name?.trim().length || 0) > 255) {
      return i18n.t('volunteer.groupNameTooLong');
    }
  }

  if (
    (input.devotee_remarks?.trim().length || 0) > 5000
  ) {
    return i18n.t('volunteer.remarksTooLong');
  }

  const identities = new Set<string>();

  for (let index = 0; index < input.members.length; index++) {
    const member = normalizeVolunteerMember(
      input.members[index]
    );

    const error = validateVolunteerMember(
      member,
      shifts
    );

    if (error) {
      return `Member ${index + 1}: ${error}`;
    }

    const identity = [
      member.full_name.toLowerCase(),
      member.mobile,
      member.date_of_birth,
    ].join('|');

    if (identities.has(identity)) {
      return `Member ${index + 1}: Duplicate volunteer profile.`;
    }

    identities.add(identity);
  }

  return null;
}