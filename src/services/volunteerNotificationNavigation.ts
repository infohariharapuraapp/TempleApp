import { router } from 'expo-router';
type SevaSection =
  | 'overview'
  | 'reporting'
  | 'duties'
  | 'idcard'
  | 'accommodation'
  | 'attendance'
  | 'certificate';
const EVENT_SECTIONS: Record<string, SevaSection> = {
  registration_approved: 'overview',
  registration_rejected: 'overview',
  photo_verified: 'overview',
  photo_correction_required: 'overview',
  photo_resubmitted: 'overview',
  duty_assigned: 'duties',
  duty_reassigned: 'duties',
  duty_cancelled: 'duties',
  duty_reminder_24h: 'duties',
  duty_reminder_2h: 'duties',
  reporting_sent: 'reporting',
  reporting_updated: 'reporting',
  reporting_cancelled: 'reporting',
  reporting_contact_requested: 'reporting',
  reporting_withdrawn: 'reporting',
  id_card_issued: 'idcard',
  id_card_revoked: 'idcard',
  accommodation_available: 'accommodation',
  service_completed: 'attendance',
  certificate_issued: 'certificate',
  certificate_revoked: 'certificate',
};
export function openVolunteerSevaNotification(
  value: unknown
): void {
  if (!value || typeof value !== 'object') {
    router.push('/my-sevas');
    return;
  }
  const data = value as Record<string, unknown>;
  if (data.type !== 'volunteer_seva') {
    return;
  }
  const event =
    typeof data.event === 'string'
      ? data.event
      : '';
  // Registration submission and public opportunity
  // announcements should open the Seva listing.
  if (

    event === 'registration_submitted' ||
    event === 'registration_opened' ||
    event === 'registration_extended' ||
    event === 'registration_closing_reminder'
  ) {
    router.push('/my-sevas');
    return;
  }
  const rawId = data.registrationId;
  const registrationId =
    typeof rawId === 'number' ||
    typeof rawId === 'string'
      ? String(rawId)
      : '';
  // Strict positive 32-bit integer validation.
  // Never use arbitrary notification URLs.
  if (
    !/^[1-9]\d*$/.test(registrationId) ||
    !Number.isSafeInteger(Number(registrationId)) ||
    Number(registrationId) > 2147483647
  ) {
    router.push('/my-sevas');
    return;
  }
  const section = 'overview';
  // The destination screen fetches registration data
  // through the authenticated backend API.
  router.push({
    pathname: '/volunteer/registration-details',
    params: {
      registrationId,
      section,
      milestone: String(
        event === 'registration_submitted' ? 0 :
        event === 'registration_approved' ||
        event === 'registration_rejected' ? 1 :
        event === 'photo_verified' ||
        event === 'photo_correction_required' ||
        event === 'photo_resubmitted' ||
        event === 'id_card_issued' ||
        event === 'id_card_revoked' ? 2 :
        event.startsWith('reporting_') ||
        event.startsWith('duty_') ||
        event === 'accommodation_available' ? 3 :
        event.startsWith('attendance_') ? 4 :
        event === 'service_completed' ? 5 :
        event.startsWith('certificate_') ? 6 : 0
      ),
    },
  });
}