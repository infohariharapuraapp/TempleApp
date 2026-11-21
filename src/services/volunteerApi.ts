import { File } from 'expo-file-system';
import { fetch as expoFetch } from 'expo/fetch';
import volunteerI18n from '@/localization/i18n';
import {
  apiRequest,
  ApiError,
  API_BASE_URL,
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
  accommodation_enabled?: boolean;
  attendance_mode?: VolunteerAttendanceMode;
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
  photo_upload_id?: string;
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
  service_dates?: string[];
}

export interface VolunteerRegistrationInput {
  photo_required?: boolean;
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
  accommodation_enabled?: boolean;
  attendance_mode?: VolunteerAttendanceMode;
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

export async function getVolunteerOpportunities(
  includeClosed = false
) {
  const data =
    await volunteerRequest<VolunteerOpportunity[]>(
      includeClosed
        ? '/opportunities?include_closed=true'
        : '/opportunities'
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
  if (!value) return 'â€”';

  const date = new Date(
    `${value.slice(0, 10)}T00:00:00+05:30`
  );

  if (Number.isNaN(date.getTime())) {
    return 'â€”';
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
  if (!value) return 'â€”';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'â€”';
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
  if (!value) return 'â€”';

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
    return 'â€”';
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
    accommodation_enabled?: boolean;
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

export type VolunteerAttendanceMode =
  | 'legacy'
  | 'simple'
  | 'detailed'
  | 'none';
export interface VolunteerDailyAttendance {
  service_date_id: number;
  service_date: string;
  attendance_status:
    | 'not_marked'
    | 'present'
    | 'absent'
    | 'excused';
  is_finalized: boolean;
  check_in_at: string | null;
  check_out_at: string | null;
  service_hours: number | string | null;
}
export interface VolunteerDailyServiceSummary {
  attendance_mode: VolunteerAttendanceMode;
  total_selected_dates: number;
  finalized_dates: number | null;
  remaining_dates: number;
  present: number | null;
  absent: number | null;
  excused: number | null;
  attendance_percentage: number | null;
  total_service_days: number | null;
  total_service_hours: number | string | null;
  service_start_date: string | null;
  service_end_date: string | null;
  is_completed: boolean;
}
export type VolunteerPhotoStatus =
  | 'missing'
  | 'pending'
  | 'correction_required'
  | 'resubmitted'
  | 'verified';
export interface VolunteerSevaMember {
  photo_status?: VolunteerPhotoStatus;
  photo_revision?: number;
  photo_review_comment?: string | null;
  photo_uploaded_at?: string | null;
  photo_reviewed_at?: string | null;
  can_resubmit_photo?: boolean;
  attendance_mode?: VolunteerAttendanceMode;
  service_dates?: string[];
  daily_attendance?: VolunteerDailyAttendance[];
  daily_service_summary?: VolunteerDailyServiceSummary | null;
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
  attendance_mode?: VolunteerAttendanceMode;
  id: number;
  member_id: number;
  certificate_number: string;
  volunteer_name: string;
  programme_name: string;
  certificate_title: string;
  certificate_message: string | null;

  service_start_date: string | null;
  service_end_date: string | null;
  total_service_days: number | null;
  total_service_hours: number | string | null;

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
}export interface VolunteerServiceDates {
  opportunity_id: number;
  programme_name: string;
  service_start_date: string;
  service_end_date: string;
  registration_open: boolean;
  total_available_dates: number;
  service_dates: string[];
}
export async function getVolunteerServiceDates(
  opportunityId: number
): Promise<VolunteerServiceDates> {
  if (
    !Number.isSafeInteger(opportunityId) ||
    opportunityId <= 0 ||
    opportunityId > 2147483647
  ) {
    throw new ApiError(
      'Invalid opportunity ID.'
    );
  }
  const data =
    await volunteerRequest<VolunteerServiceDates>(
      `/opportunities/${opportunityId}/service-dates`
    );
  if (
    !data ||
    data.opportunity_id !== opportunityId ||
    typeof data.registration_open !== 'boolean' ||
    !Array.isArray(data.service_dates) ||
    !data.service_dates.every(date =>
      typeof date === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(date)
    )
  ) {
    throw new ApiError(
      'Invalid service dates response.'
    );
  }
  return data;
}
export interface VolunteerDailyReporting {
  service_date_id: number;
  service_date: string;
  member_id: number;
  member_code: string;
  full_name: string;
  reporting_id: number | null;
  reporting_status: string;
  reporting_time: string | null;
  reporting_location: string | null;
  coordinator_name: string | null;
  coordinator_phone: string | null;
  special_instructions: string | null;
  revision: number | null;
  responded_at: string | null;
  can_confirm: boolean;
  attendance_status: 'not_marked' | 'present' | 'absent' | 'excused';
  attendance_finalized: boolean;
}
export async function getMyVolunteerReporting(
  registrationId: number
): Promise<VolunteerDailyReporting[]> {
  if (
    !Number.isSafeInteger(registrationId) ||
    registrationId <= 0 ||
    registrationId > 2147483647
  ) {
    throw new ApiError('Invalid registration ID.');
  }
  const data =
    await volunteerRequest<VolunteerDailyReporting[]>(
      `/my-registrations/${registrationId}/reporting`,
      {
        authenticated: true,
      }
    );
  if (
    !Array.isArray(data) ||
    !data.every(item =>
      item &&
      Number.isSafeInteger(item.service_date_id) &&
      Number.isSafeInteger(item.member_id) &&
      typeof item.service_date === 'string' &&
      typeof item.reporting_status === 'string' &&
      typeof item.can_confirm === 'boolean' &&
      typeof item.attendance_finalized === 'boolean'
    )
  ) {
    throw new ApiError(
      'Invalid reporting response.'
    );
  }
  return data;
}
export async function confirmVolunteerReporting(
  reportingId: number,
  revision: number
): Promise<void> {
  if (
    !Number.isSafeInteger(reportingId) ||
    reportingId <= 0 ||
    reportingId > 2147483647 ||
    !Number.isSafeInteger(revision) ||
    revision <= 0
  ) {
    throw new ApiError(
      'Invalid reporting confirmation.'
    );
  }
  await volunteerRequest<unknown>(
    `/reporting/${reportingId}/confirm`,
    {
      method: 'POST',
      authenticated: true,
      body: { revision },
    }
  );
}
export async function markVolunteerCoordinatorContacted(
  reportingId: number,
  revision: number
): Promise<void> {
  if (
    !Number.isSafeInteger(reportingId) ||
    reportingId <= 0 ||
    reportingId > 2147483647 ||
    !Number.isSafeInteger(revision) ||
    revision <= 0 ||
    revision > 2147483647
  ) {
    throw new ApiError(
      'Invalid coordinator contact reporting details.'
    );
  }
  await volunteerRequest<unknown>(
    `/reporting/${reportingId}/contacted-coordinator`,
    {
      method: 'POST',
      authenticated: true,
      body: { revision },
    }
  );
}export async function withdrawVolunteerReporting(
  reportingId: number,
  revision: number
): Promise<void> {
  if (
    !Number.isSafeInteger(reportingId) ||
    reportingId <= 0 ||
    reportingId > 2147483647 ||
    !Number.isSafeInteger(revision) ||
    revision <= 0
  ) {
    throw new ApiError(
      'Invalid reporting withdrawal.'
    );
  }
  await volunteerRequest<unknown>(
    `/reporting/${reportingId}/withdraw`,
    {
      method: 'POST',
      authenticated: true,
      body: { revision },
    }
  );
}export interface VolunteerPhotoUploadResult {
  upload_id: string;
  expires_at: string;
}
export async function uploadVolunteerPhoto(
  opportunityId: number,
  photo: {
    uri: string;
    mimeType: string;
    fileSize?: number;
  }
): Promise<VolunteerPhotoUploadResult> {
  if (
    !Number.isSafeInteger(opportunityId) ||
    opportunityId <= 0
  ) {
    throw new ApiError('Invalid opportunity.');
  }
  const extensions: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };
  const extension = extensions[photo.mimeType];
  if (!extension) {
    throw new ApiError(
      'Only JPG, PNG and WebP photographs are supported.'
    );
  }
  if (
    photo.fileSize !== undefined &&
    photo.fileSize > 5 * 1024 * 1024
  ) {
    throw new ApiError(
      'Photograph must not exceed 5 MB.'
    );
  }
  const token = await getVolunteerToken();
  const formData = new FormData();
  formData.append(
    'opportunity_id',
    String(opportunityId)
  );
  const imageFile = new File(photo.uri);
  if (!imageFile.exists) {
    throw new ApiError(
      'Photograph file is unavailable. Please select it again.'
    );
  }
  if (imageFile.size <= 0) {
    throw new ApiError(
      'Photograph file is empty. Please select another photograph.'
    );
  }
  if (imageFile.size > 5 * 1024 * 1024) {
    throw new ApiError(
      'Photograph must not exceed 5 MB.'
    );
  }
  formData.append(
    'image',
    imageFile,
    `volunteer-photo.${extension}`
  );
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    60000
  );
  try {
    const response = await expoFetch(
      `${API_BASE_URL}/volunteer/photos/upload`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        body: formData,
        signal: controller.signal,
      }
    );
    const result = await response
      .json()
      .catch(() => null);
    if (!response.ok || result?.success !== true) {
      throw new ApiError(
        result?.message ||
          'Unable to upload photograph.',
        response.status
      );
    }
    const data = result.data;
    if (
      typeof data?.upload_id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        .test(data.upload_id) ||
      typeof data.expires_at !== 'string' ||
      !(Date.parse(data.expires_at) > Date.now())
    ) {
      throw new ApiError(
        'Invalid photograph upload response.'
      );
    }
    return {
      upload_id: data.upload_id,
      expires_at: data.expires_at,
    };
  } catch (error) {
    if (controller.signal.aborted) {
      throw new ApiError(
        'Photograph upload timed out. Please retry.',
        408
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
export interface VolunteerPhotoResubmissionResult {
  id: number;
  photo_status: VolunteerPhotoStatus;
  photo_revision: number;
  photo_uploaded_at: string;
}
export async function resubmitVolunteerPhoto(
  registrationId: number,
  memberId: number,
  uploadId: string,
  revision: number
): Promise<VolunteerPhotoResubmissionResult> {
  if (
    !Number.isSafeInteger(registrationId) ||
    registrationId <= 0 ||
    registrationId > 2147483647 ||
    !Number.isSafeInteger(memberId) ||
    memberId <= 0 ||
    memberId > 2147483647 ||
    !Number.isSafeInteger(revision) ||
    revision < 0 ||
    revision >= 2147483647 ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uploadId)
  ) {
    throw new ApiError(
      'Invalid photograph submission.'
    );
  }
  const data =
    await volunteerRequest<VolunteerPhotoResubmissionResult>(
      `/my-registrations/${registrationId}/members/${memberId}/photo`,
      {
        method: 'POST',
        authenticated: true,
        body: {
          photo_upload_id: uploadId,
          photo_revision: revision,
        },
      }
    );
  if (
    data.id !== memberId ||
    data.photo_revision !== revision + 1 ||
    !['pending', 'resubmitted'].includes(
      data.photo_status
    )
  ) {
    throw new ApiError(
      'Unable to confirm photograph submission. Refresh My Sevas.'
    );
  }
  return data;
}
export async function requestVolunteerReportingTime(
  reportingId: number,
  revision: number,
  requestedReportingTime: string,
  volunteerMessage?: string
): Promise<void> {
  if (
    !Number.isSafeInteger(reportingId) ||
    reportingId <= 0 ||
    !Number.isSafeInteger(revision) ||
    revision <= 0
  ) {
    throw new Error('Invalid reporting details');
  }
  if (
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(requestedReportingTime)
  ) {
    throw new Error('Enter a valid reporting time in HH:MM format');
  }
  if (
    volunteerMessage !== undefined &&
    volunteerMessage.length > 1000
  ) {
    throw new Error('Message must not exceed 1000 characters');
  }
  await volunteerRequest(
    `/reporting/${reportingId}/request-time`,
    {
      method: 'POST',
      authenticated: true,
      body: {
        revision,
        requested_reporting_time: requestedReportingTime,
        volunteer_message: volunteerMessage?.trim() || null,
      },
    }
  );
}