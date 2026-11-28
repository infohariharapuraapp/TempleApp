interface AccountIdentity {
  id: number;
  full_name: string;
  phone: string | null;
}
interface VolunteerIdentity {
  user_id: number | null;
  full_name: string;
  mobile: string | null;
}
function normalizeName(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}
function normalizeMobile(value: unknown): string {
  if (typeof value !== 'string') return '';
  const cleaned = value.trim();
  if (/^[6-9][0-9]{9}$/.test(cleaned)) {
    return cleaned;
  }
  if (/^\+91[6-9][0-9]{9}$/.test(cleaned)) {
    return cleaned.slice(3);
  }
  return '';
}
export type AccountDeletionOwnership =
  | 'matching_identity'
  | 'manual_review'
  | 'unrelated';
export function classifyVolunteerOwnership(
  account: AccountIdentity,
  member: VolunteerIdentity
): AccountDeletionOwnership {
  if (
    !Number.isSafeInteger(account.id) ||
    account.id <= 0
  ) {
    return 'manual_review';
  }
  if (member.user_id !== account.id) {
    return 'unrelated';
  }
  const accountName = normalizeName(account.full_name);
  const memberName = normalizeName(member.full_name);
  const accountMobile = normalizeMobile(account.phone);
  const memberMobile = normalizeMobile(member.mobile);
  if (
    !accountName ||
    !memberName ||
    !accountMobile ||
    !memberMobile
  ) {
    return 'manual_review';
  }
  if (
    accountName === memberName &&
    accountMobile === memberMobile
  ) {
    return 'matching_identity';
  }
  return 'manual_review';
}