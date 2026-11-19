import volunteerI18n from '@/localization/i18n';
import {
  apiRequest,
  ApiError,
} from '@/services/api';

import { getToken } from '@/services/authStorage';

// ========================================
// TYPES
// ========================================

export type RegistrationStatus =
  | 'draft'
  | 'upcoming'
  | 'open'
  | 'closed';

export type VolunteerStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface VolunteerOpportunity {
  id: number;
  title: string;
  description: string | null;
  instructions: string | null;
  image_url: string | null;

  registration_start_at: string;
  registration_end_at: string;

  service_start_date: string;
  service_end_date: string;

  required_volunteers: number;

  allow_individual: boolean;
  allow_group: boolean;

  minimum_group_size: number;
  maximum_group_size: number;

  registration_status: RegistrationStatus;
}

export interface VolunteerShift {
  id: number;
  opportunity_id: number;
  shift_name: string;
  service_date: string;
  start_time: string;
  end_time: string;
}

export interface VolunteerMemberInput {
  full_name: string;
  mobile: string;
  email?: string;

  date_of_birth: string;

  gender: 'male' | 'female' | 'other';

  country: string;
  pincode: string;
  state: string;
  district: string;

  mandal?: string;
  city?: string;
  street?: string;
  door_number?: string;

  qualification?: string;
  profession?: string;
  area_of_interest?: string;

  is_team_leader: boolean;
  shift_ids: number[];
}

export interface VolunteerRegistrationInput {
  opportunity_id: number;

  registration_type:
    | 'individual'
    | 'group';

  group_name?: string;
  devotee_remarks?: string;

  members: VolunteerMemberInput[];
}

export interface VolunteerRegistration {
  id: number;
  registration_code: string;
  opportunity_id: number;
  opportunity_title: string;

  registration_type:
    | 'individual'
    | 'group';

  group_name: string | null;
  total_members: number;
  status: VolunteerStatus;

  created_at: string;
}

export interface MyVolunteerRegistration
  extends VolunteerRegistration {
  image_url: string | null;

  service_start_date: string;
  service_end_date: string;

  rejection_reason: string | null;

  reviewed_at: string | null;
  completed_at: string | null;

  total_assignments: number;
}

interface VolunteerResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

// ========================================
// BOUNDED TOKEN RETRIEVAL
// ========================================

async function getVolunteerToken(): Promise<string> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    const token = await Promise.race([
      getToken(),

      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(
            new ApiError(
              volunteerI18n.t('volunteer.sessionRestoreFailed')
            )
          );
        }, 5000);
      }),
    ]);

    if (!token) {
      throw new ApiError(
        volunteerI18n.t('volunteer.loginRequired'),
        401
      );
    }

    return token;
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

// ========================================
// SHARED API REQUEST
// ========================================

async function volunteerRequest<T>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST';
    body?: unknown;
    authenticated?: boolean;
  } = {}
): Promise<T> {
  const token = options.authenticated
    ? await getVolunteerToken()
    : '';

  const response =
    await apiRequest<VolunteerResponse<T>>(
      `/volunteer${endpoint}`,
      {
        method: options.method ?? 'GET',
        body: options.body,
        token,
        timeoutMs: 60000,
      }
    );

  if (
    !response ||
    response.success !== true ||
    response.data === undefined ||
    response.data === null
  ) {
    throw new ApiError(
      response?.message ||
        'Unable to load volunteer information.'
    );
  }

  return response.data;
}

// ========================================
// PUBLIC API
// ========================================

export async function getVolunteerOpportunities() {
  const data =
    await volunteerRequest<VolunteerOpportunity[]>(
      '/opportunities'
    );

  if (!Array.isArray(data)) {
    throw new ApiError(
      'Invalid opportunities response.'
    );
  }

  return data;
}

export function getVolunteerOpportunity(
  id: number
) {
  return volunteerRequest<VolunteerOpportunity>(
    `/opportunities/${id}`
  );
}

export async function getVolunteerShifts(
  opportunityId: number
) {
  const data =
    await volunteerRequest<VolunteerShift[]>(
      `/opportunities/${opportunityId}/shifts`
    );

  if (!Array.isArray(data)) {
    throw new ApiError(
      'Invalid service shifts response.'
    );
  }

  return data;
}

// ========================================
// AUTHENTICATED API
// ========================================

export function submitVolunteerRegistration(
  body: VolunteerRegistrationInput
) {
  return volunteerRequest<VolunteerRegistration>(
    '/registrations',
    {
      method: 'POST',
      authenticated: true,
      body,
    }
  );
}

export async function getMyVolunteerRegistrations() {
  const data =
    await volunteerRequest<MyVolunteerRegistration[]>(
      '/my-registrations',
      {
        authenticated: true,
      }
    );

  if (!Array.isArray(data)) {
    throw new ApiError(
      'Invalid registrations response.'
    );
  }

  return data;
}

// ========================================
// FORMATTING
// ========================================

export function formatVolunteerDate(
  value?: string | null
): string {
  if (!value) return '—';

  const date = new Date(
    `${value.slice(0, 10)}T00:00:00+05:30`
  );

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatVolunteerDateTime(
  value?: string | null
): string {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatVolunteerTime(
  value?: string | null
): string {
  if (!value) return '—';

  const [hour, minute] =
    value.split(':').map(Number);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return '—';
  }

  return `${hour % 12 || 12}:${String(
    minute
  ).padStart(2, '0')} ${
    hour >= 12 ? 'PM' : 'AM'
  }`;
}

export function getVolunteerError(
  error: unknown
): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return volunteerI18n.t('volunteer.loginAgain');
    }

    if (error.status === 404) {
      return volunteerI18n.t('volunteer.informationUnavailable');
    }

    if (
      error.status &&
      error.status >= 500
    ) {
      return volunteerI18n.t('volunteer.serverUnavailable');
    }

    return error.message;
  }

  return volunteerI18n.t('volunteer.networkError');
}

// ========================================
// MY SEVA DETAILS
// ========================================

export interface VolunteerRegistrationDetails {
  registration: {
    id: number;
    registration_code: string;
    opportunity_id: number;
    programme_name: string;
    registration_type: 'individual' | 'group';
    group_name: string | null;
    total_members: number;
    status: VolunteerStatus;
    description: string | null;
    instructions: string | null;
    image_url: string | null;
    service_start_date: string;
    service_end_date: string;
    registration_start_at: string;
    registration_end_at: string;
    devotee_remarks: string | null;
    rejection_reason: string | null;
    created_at: string;
    updated_at: string;
    reviewed_at: string | null;
    completed_at: string | null;
    is_registration_owner: boolean;
    registration_window_open: boolean;
  };

  stats: {
    total_members: number;
    visible_members: number;
    approved_members: number;
    completed_members: number;
    total_assignments: number;
    upcoming_assignments: number;
    current_assignments: number;
    certificates_issued: number;
  };

  next_duty: VolunteerDutyAssignment & {
    volunteer_name: string;
    member_code: string;
  } | null;

  members: VolunteerSevaMember[];
}

export interface VolunteerDutyAssignment {
  assignment_id: number;
  member_id: number;
  requirement_id: number;
  shift_id: number;

  duty_id: number;
  duty_name: string;
  duty_description: string | null;
  responsibilities: string | null;

  status: string;

  display_status:
    | 'upcoming'
    | 'current'
    | 'awaiting_review'
    | 'completed';

  reporting_location: string | null;
  reporting_time: string | null;
  coordinator_name: string | null;
  coordinator_phone: string | null;
  special_instructions: string | null;
  general_instructions: string | null;

  male_dress_code: string | null;
  female_dress_code: string | null;
  male_dress_image_url: string | null;
  female_dress_image_url: string | null;

  shift_name: string;
  service_date: string;
  start_time: string;
  end_time: string;
  shift_start_at: string;
  shift_end_at: string;

  assigned_at: string;
  completed_at: string | null;

  attendance_status: string;
  attendance_finalized: boolean;
  service_hours: number | string | null;
}

export interface VolunteerSevaMember {
  id: number;
  member_code: string;
  full_name: string;
  gender: string;
  photo_url: string | null;

  is_team_leader: boolean;
  status: string;
  created_at: string;

  availability: {
    member_id: number;
    shift_id: number;
    shift_name: string;
    service_date: string;
    start_time: string;
    end_time: string;
    is_active: boolean;
  }[];

  assignments: VolunteerDutyAssignment[];

  attendance_summary: {
    total_assignments: number;
    present: number;
    absent: number;
    excused: number;
    finalized: number;
    pending: number;
    attendance_percentage: number | null;
    total_service_days: number;
    total_service_hours: number;
  };

  id_card: VolunteerIDCard | null;

  accommodation: VolunteerAccommodation[];

  certificate: VolunteerCertificate | null;
}

export interface VolunteerIDCard {
  id: number;
  member_id: number;
  card_number: string;
  photo_url: string | null;
  valid_from: string;
  valid_until: string;
  issued_at: string;
  status: string;
}

export interface VolunteerAccommodation {
  id: number;
  member_id: number;
  accommodation_name: string;
  building_name: string | null;
  room_number: string | null;
  address: string | null;
  check_in_at: string | null;
  check_out_at: string | null;
  contact_person: string | null;
  contact_phone: string | null;
  instructions: string | null;
}

export interface VolunteerCertificate {
  id: number;
  member_id: number;
  certificate_number: string;
  volunteer_name: string;
  programme_name: string;
  certificate_title: string;
  certificate_message: string | null;

  service_start_date: string;
  service_end_date: string;
  total_service_days: number;
  total_service_hours: number | string;

  certificate_url: string | null;
  signatory_name: string | null;
  signatory_designation: string | null;
  issued_at: string;
  status: string;
}

export async function getVolunteerRegistrationDetails(
  registrationId: number
): Promise<VolunteerRegistrationDetails> {
  if (
    !Number.isSafeInteger(registrationId) ||
    registrationId <= 0 ||
    registrationId > 2147483647
  ) {
    throw new ApiError('Invalid registration ID.');
  }

  const data =
    await volunteerRequest<VolunteerRegistrationDetails>(
      `/my-registrations/${registrationId}`,
      {
        authenticated: true,
      }
    );

  if (
    !data.registration ||
    !data.stats ||
    !Array.isArray(data.members)
  ) {
    throw new ApiError(
      'Invalid registration details response.'
    );
  }

  return data;
}