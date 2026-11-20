// ========================================
// VOLUNTEER ATTENDANCE DRAFT RECONCILIATION
// ========================================
export interface AttendanceDraftSnapshot<T> {
  id: number;
  baseline: string;
  draft: T;
}
export interface AttendanceDraftConflict<T> {
  id: number;
  draft: T;
  reason: 'record_missing' | 'record_changed' | 'record_locked';
}
export interface AttendanceDraftResult<T> {
  drafts: Record<number, T>;
  conflicts: AttendanceDraftConflict<T>[];
  restoredCount: number;
  matchedCount: number;
}
// ========================================
// CAPTURE UNSAVED RECORDS
// ========================================
export function captureAttendanceDrafts<R, D>(
  records: R[],
  drafts: Record<number, D>,
  excludedIds: ReadonlySet<number>,
  getId: (record: R) => number,
  isDirty: (record: R) => boolean,
  getBaseline: (record: R) => string
): AttendanceDraftSnapshot<D>[] {
  const result: AttendanceDraftSnapshot<D>[] = [];
  for (const record of records) {
    const id = getId(record);
    if (
      excludedIds.has(id) ||
      !isDirty(record) ||
      !Object.prototype.hasOwnProperty.call(drafts, id)
    ) {
      continue;
    }
    result.push({
      id,
      baseline: getBaseline(record),
      draft: drafts[id],
    });
  }
  return result;
}
// ========================================
// RECONCILE WITH LATEST SERVER RECORDS
// ========================================
export function reconcileAttendanceDrafts<R, D>(
  records: R[],
  snapshots: AttendanceDraftSnapshot<D>[],
  getId: (record: R) => number,
  toDraft: (record: R) => D,
  getBaseline: (record: R) => string,
  canRestore: (record: R) => boolean,
  matchesServer?: (record: R, draft: D) => boolean
): AttendanceDraftResult<D> {
  const drafts: Record<number, D> = {};
  const conflicts: AttendanceDraftConflict<D>[] = [];
  const recordsById = new Map<number, R>();
  let restoredCount = 0;
  let matchedCount = 0;
  // Initialize from latest server data.
  for (const record of records) {
    const id = getId(record);
    recordsById.set(id, record);
    drafts[id] = toDraft(record);
  }
  // Restore only compatible local drafts.
  for (const snapshot of snapshots) {
    const record = recordsById.get(snapshot.id);
    if (record === undefined) {
      conflicts.push({
        id: snapshot.id,
        draft: snapshot.draft,
        reason: 'record_missing',
      });
      continue;
    }
    if (!canRestore(record)) {
      conflicts.push({
        id: snapshot.id,
        draft: snapshot.draft,
        reason: 'record_locked',
      });
      continue;
    }
    if (
      matchesServer?.(record, snapshot.draft)
    ) {
      matchedCount++;
      continue;
    }
    if (
      getBaseline(record) !== snapshot.baseline
    ) {
      conflicts.push({
        id: snapshot.id,
        draft: snapshot.draft,
        reason: 'record_changed',
      });
      continue;
    }
    drafts[snapshot.id] = snapshot.draft;
    restoredCount++;
  }
  return {
    drafts,
    conflicts,
    restoredCount,
    matchedCount,
  };
}