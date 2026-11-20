import {
  pushAdminHistory,
} from '../../lib/adminNavigationHistory';
type ProgrammeReference = {
  id: number;
};
export function readProgrammeSelection(
  opportunities: ProgrammeReference[]
): string {
  const value = new URLSearchParams(
    window.location.search
  ).get('opportunity');
  if (!value || !/^[1-9]\d*$/.test(value)) {
    return '';
  }
  const id = Number(value);
  if (
    !Number.isSafeInteger(id) ||
    id > 2147483647
  ) {
    return '';
  }
  return opportunities.some(
    item => String(item.id) === value
  )
    ? value
    : '';
}
export function writeProgrammeSelection(
  value: string
): void {
  const url = new URL(window.location.href);
  if (
    url.searchParams.get('page') !==
    'volunteer-seva'
  ) {
    return;
  }
  if (value) {
    if (
      !/^[1-9]\d*$/.test(value) ||
      !Number.isSafeInteger(Number(value)) ||
      Number(value) > 2147483647
    ) {
      return;
    }
    url.searchParams.set(
      'opportunity',
      value
    );
  } else {
    url.searchParams.delete('opportunity');
  }
  if (url.href !== window.location.href) {
    if (!pushAdminHistory(url.href)) return;
  }
}