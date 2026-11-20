import {
  confirmVolunteerDiscardChanges,
} from './volunteerUnsavedChangesGuard';
import {
  hasActiveVolunteerOperation,
} from './volunteerOperationGuard';
// ========================================
// TRACKED ADMIN HISTORY
// ========================================
const HISTORY_KEY = '__templeAdminHistoryIndex';
const SESSION_KEY = '__templeAdminHistorySession';
const RESTORE_TIMEOUT_MS = 2000;
let initialized = false;
let currentIndex = 0;
let currentUrl = '';
let historySession = createSession();
let restoring = false;
let restoreTimer: number | null = null;
function createSession(): string {
  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}
function readIndex(state: unknown): number | null {
  if (!state || typeof state !== 'object') {
    return null;
  }
  const record = state as Record<string, unknown>;
  if (record[SESSION_KEY] !== historySession) {
    return null;
  }
  const value = record[HISTORY_KEY];
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0
  )
    ? value
    : null;
}
function createState(index: number) {
  const existing = window.history.state;
  return {
    ...(existing && typeof existing === 'object'
      ? existing
      : {}),
    [HISTORY_KEY]: index,
    [SESSION_KEY]: historySession,
  };
}
// ========================================
// RESTORATION RECOVERY
// ========================================
function clearRestoration(): void {
  restoring = false;
  if (restoreTimer !== null) {
    window.clearTimeout(restoreTimer);
    restoreTimer = null;
  }
}
function resetTracking(href: string): void {
  historySession = createSession();
  currentIndex = 0;
  currentUrl = href;
  window.history.replaceState(
    createState(currentIndex),
    '',
    href
  );
}
function recoverRestoration(): void {
  clearRestoration();
  // Preserve the displayed workspace when browser
  // history restoration cannot be completed.
  resetTracking(currentUrl);
}
function beginRestoration(delta: number): void {
  clearRestoration();
  restoring = true;
  restoreTimer = window.setTimeout(
    recoverRestoration,
    RESTORE_TIMEOUT_MS
  );
  try {
    window.history.go(delta);
  } catch {
    recoverRestoration();
  }
}
// ========================================
// BROWSER HISTORY PROTECTION
// ========================================
function handlePopState(event: PopStateEvent): void {
  const nextIndex = readIndex(event.state);
  if (restoring) {
    if (
      nextIndex === currentIndex &&
      window.location.href === currentUrl
    ) {
      clearRestoration();
      event.stopImmediatePropagation();
      return;
    }
    clearRestoration();
  }
  const operationActive =
    hasActiveVolunteerOperation();
  const discardDeclined =
    !operationActive &&
    window.location.href !== currentUrl &&
    !confirmVolunteerDiscardChanges();
  if (operationActive || discardDeclined) {
    event.stopImmediatePropagation();
    if (
      nextIndex !== null &&
      nextIndex !== currentIndex
    ) {
      beginRestoration(
        currentIndex - nextIndex
      );
      return;
    }
    // Unknown entries cannot be restored safely
    // using an assumed history offset.
    resetTracking(currentUrl);
    return;
  }
  // No active operation: allow React listeners
  // to restore the destination workspace.
  if (nextIndex === null) {
    resetTracking(window.location.href);
  } else {
    currentIndex = nextIndex;
    currentUrl = window.location.href;
  }
}
// ========================================
// INITIALIZATION
// ========================================
export function initializeAdminNavigationHistory(): void {
  if (initialized) return;
  const existing = window.history.state;
  if (existing && typeof existing === 'object') {
    const session = existing[SESSION_KEY];
    if (
      typeof session === 'string' &&
      session.length > 0
    ) {
      historySession = session;
    }
  }
  const existingIndex = readIndex(existing);
  currentIndex = existingIndex ?? 0;
  currentUrl = window.location.href;
  window.history.replaceState(
    createState(currentIndex),
    '',
    currentUrl
  );
  window.addEventListener(
    'popstate',
    handlePopState,
    true
  );
  initialized = true;
}
// ========================================
// PROTECTED HISTORY PUSH
// ========================================
export function pushAdminHistory(
  href: string
): boolean {
  initializeAdminNavigationHistory();
  if (
    restoring ||
    hasActiveVolunteerOperation()
  ) {
    return false;
  }
  const url = new URL(
    href,
    window.location.href
  );
  if (url.origin !== window.location.origin) {
    return false;
  }
  if (url.href === window.location.href) {
    return true;
  }
  const nextIndex = currentIndex + 1;
  window.history.pushState(
    createState(nextIndex),
    '',
    url.href
  );
  currentIndex = nextIndex;
  currentUrl = url.href;
  return true;
}
// ========================================
// PROTECTED HISTORY REPLACEMENT
// ========================================
export function replaceAdminHistory(
  href: string
): boolean {
  initializeAdminNavigationHistory();
  if (
    restoring ||
    hasActiveVolunteerOperation()
  ) {
    return false;
  }
  const url = new URL(
    href,
    window.location.href
  );
  if (url.origin !== window.location.origin) {
    return false;
  }
  if (url.href === window.location.href) {
    return true;
  }
  window.history.replaceState(
    createState(currentIndex),
    '',
    url.href
  );
  currentUrl = url.href;
  return true;
}
