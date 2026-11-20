import { useLayoutEffect } from 'react';
// ========================================
// UNSAVED VOLUNTEER WORKSPACE CHANGES
// ========================================
const unsavedWorkspaces = new Map<symbol, string>();
// ========================================
// BROWSER REFRESH / TAB CLOSE PROTECTION
// ========================================
function handleBeforeUnload(
  event: BeforeUnloadEvent
): void {
  if (unsavedWorkspaces.size === 0) {
    return;
  }
  event.preventDefault();
  event.returnValue = '';
}
// ========================================
// REGISTER UNSAVED WORKSPACE
// ========================================
export function registerVolunteerUnsavedChanges(
  label: string
): () => void {
  const token = Symbol(label);
  unsavedWorkspaces.set(token, label);
  if (unsavedWorkspaces.size === 1) {
    window.addEventListener(
      'beforeunload',
      handleBeforeUnload
    );
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    unsavedWorkspaces.delete(token);
    if (unsavedWorkspaces.size === 0) {
      window.removeEventListener(
        'beforeunload',
        handleBeforeUnload
      );
    }
  };
}
// ========================================
// CURRENT UNSAVED STATUS
// ========================================
export function hasVolunteerUnsavedChanges(): boolean {
  return unsavedWorkspaces.size > 0;
}
export function getVolunteerUnsavedWorkspaces(): string[] {
  return Array.from(
    new Set(unsavedWorkspaces.values())
  );
}
// ========================================
// NAVIGATION CONFIRMATION
// ========================================
export function confirmVolunteerDiscardChanges(): boolean {
  if (!hasVolunteerUnsavedChanges()) {
    return true;
  }
  const workspaces =
    getVolunteerUnsavedWorkspaces();
  return window.confirm(
    'You have unsaved changes in:\n\n' +
    workspaces.map(
      item => '- ' + item
    ).join('\n') +
    '\n\nLeaving this workspace may discard your changes.' +
    '\n\nDo you want to continue?'
  );
}
// ========================================
// REACT COMPONENT INTEGRATION
// ========================================
export function useVolunteerUnsavedChanges(
  label: string,
  dirty: boolean
): void {
  useLayoutEffect(() => {
    if (!dirty) {
      return;
    }
    return registerVolunteerUnsavedChanges(
      label
    );
  }, [label, dirty]);
}
