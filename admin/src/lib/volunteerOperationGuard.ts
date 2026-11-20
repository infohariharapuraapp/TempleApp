import {
  confirmVolunteerDiscardChanges,
} from './volunteerUnsavedChangesGuard';
import { useSyncExternalStore } from 'react';
// ========================================
// ACTIVE VOLUNTEER OPERATIONS
// ========================================
const operations = new Map<symbol, string>();
const listeners = new Set<() => void>();
function notifyListeners(): void {
  for (const listener of listeners) {
    listener();
  }
}
function handleBeforeUnload(
  event: BeforeUnloadEvent
): void {
  if (operations.size === 0) return;
  event.preventDefault();
  event.returnValue = '';
}
// ========================================
// BEGIN AND RELEASE OPERATION
// ========================================
export function beginVolunteerOperation(
  label: string
): () => void {
  const token = Symbol(label);
  operations.set(token, label);
  if (operations.size === 1) {
    window.addEventListener(
      'beforeunload',
      handleBeforeUnload
    );
  }
  notifyListeners();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    operations.delete(token);
    if (operations.size === 0) {
      window.removeEventListener(
        'beforeunload',
        handleBeforeUnload
      );
    }
    notifyListeners();
  };
}
// ========================================
// CURRENT OPERATION STATUS
// ========================================
export function hasActiveVolunteerOperation(): boolean {
  return operations.size > 0;
}
export function getActiveVolunteerOperations(): string[] {
  return Array.from(operations.values());
}
export function canLeaveVolunteerWorkspace(): boolean {
  if (!hasActiveVolunteerOperation()) {
    return confirmVolunteerDiscardChanges();
  }
  window.alert(
    'A volunteer operation is currently in progress. ' +
    'Please wait until it finishes before navigating.'
  );
  return false;
}
// ========================================
// REACT SUBSCRIPTION
// ========================================
function subscribe(
  listener: () => void
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function useVolunteerOperationBusy(): boolean {
  return useSyncExternalStore(
    subscribe,
    hasActiveVolunteerOperation,
    () => false
  );
}