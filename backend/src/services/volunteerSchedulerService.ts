import {
  cleanupExpiredVolunteerPhotos,
} from './volunteerPhotoCleanupService';
import {
  processVolunteerNotificationQueue,
} from './volunteerNotificationWorker';

import {
  validateVolunteerNotificationEvent,
} from './volunteerNotificationValidationService';

import {
  processVolunteerRegistrationNotifications,
} from './volunteerRegistrationNotificationScheduler';

import {
  processVolunteerDutyNotifications,
} from './volunteerDutyNotificationScheduler';

import {
  processVolunteerPushReceipts,
} from './volunteerNotificationReceiptService';

import {
  cleanupTerminalVolunteerNotificationJobs,
  reconcileTerminalVolunteerNotificationSummaries,
} from './volunteerNotificationCleanupService';

import {
  syncRecentVolunteerReceipts,
} from './volunteerNotificationSummaryService';

// ========================================
// SCHEDULER CONFIGURATION
// ========================================

const QUEUE_INTERVAL_MS = 30 * 1000;

const EVENT_INTERVAL_MS = 60 * 1000;

const RECEIPT_INTERVAL_MS = 5 * 60 * 1000;

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

const STARTUP_DELAY_MS = 10 * 1000;

// ========================================
// TYPES
// ========================================

type SchedulerTask = () => Promise<unknown>;

type SchedulerTimer = ReturnType<typeof setTimeout>;

// ========================================
// SCHEDULER STATE
// ========================================

let schedulerStarted = false;

let schedulerGeneration = 0;

const timers = new Set<SchedulerTimer>();

const activeTasks = new Set<string>();

// ========================================
// SAFE TASK EXECUTION
// ========================================

async function runTask(
  name: string,
  task: SchedulerTask
): Promise<void> {
  if (activeTasks.has(name)) {
    return;
  }

  activeTasks.add(name);

  try {
    await task();
  } catch (error) {
    console.error(
      `[Volunteer Scheduler] ${name} failed:`,
      error
    );
  } finally {
    activeTasks.delete(name);
  }
}

// ========================================
// RECURRING TASK
// ========================================

function scheduleTask(
  name: string,
  task: SchedulerTask,
  intervalMs: number,
  initialDelayMs: number,
  generation: number
): void {
  if (
    !schedulerStarted ||
    generation !== schedulerGeneration
  ) {
    return;
  }

  const timer = setTimeout(async () => {
    timers.delete(timer);

    if (
      !schedulerStarted ||
      generation !== schedulerGeneration
    ) {
      return;
    }

    try {
      await runTask(name, task);
    } finally {
      if (
        schedulerStarted &&
        generation === schedulerGeneration
      ) {
        scheduleTask(
          name,
          task,
          intervalMs,
          intervalMs,
          generation
        );
      }
    }
  }, initialDelayMs);

  timers.add(timer);
}

// ========================================
// REGISTRATION AND DUTY EVENTS
// ========================================

async function processVolunteerEvents(): Promise<void> {
  await runTask(
    'Registration notifications',
    processVolunteerRegistrationNotifications
  );

  await runTask(
    'Duty reminders',
    processVolunteerDutyNotifications
  );
}

// ========================================
// NOTIFICATION QUEUE
// ========================================

async function processVolunteerQueue(): Promise<void> {
  await processVolunteerNotificationQueue(
    validateVolunteerNotificationEvent
  );
}

// ========================================
// RECEIPTS AND SUMMARY RECONCILIATION
// ========================================

async function processVolunteerReceipts(): Promise<void> {
  await runTask(
    'Push receipts',
    () => processVolunteerPushReceipts()
  );

  await runTask(
    'Recent receipt summaries',
    () => syncRecentVolunteerReceipts()
  );

  await runTask(
    'Terminal notification summaries',
    () => reconcileTerminalVolunteerNotificationSummaries()
  );
}

// ========================================
// NOTIFICATION CLEANUP
// ========================================

async function processVolunteerCleanup(): Promise<void> {
  await runTask(
    'Terminal notification cleanup',
    cleanupTerminalVolunteerNotificationJobs
  );
  await runTask(
    'Expired volunteer photograph cleanup',
    cleanupExpiredVolunteerPhotos
  );
}

// ========================================
// START SCHEDULER
// ========================================

export function startVolunteerScheduler(): void {
  if (schedulerStarted) {
    return;
  }

  if (
    process.env.VOLUNTEER_SCHEDULER_ENABLED !== 'true'
  ) {
    console.log(
      '[Volunteer Scheduler] Disabled'
    );

    return;
  }

  schedulerStarted = true;

  const generation = ++schedulerGeneration;

  console.log(
    '[Volunteer Scheduler] Starting'
  );

  scheduleTask(
    'Volunteer events',
    processVolunteerEvents,
    EVENT_INTERVAL_MS,
    STARTUP_DELAY_MS,
    generation
  );

  scheduleTask(
    'Volunteer notification queue',
    processVolunteerQueue,
    QUEUE_INTERVAL_MS,
    STARTUP_DELAY_MS + 5000,
    generation
  );

  scheduleTask(
    'Volunteer receipt processing',
    processVolunteerReceipts,
    RECEIPT_INTERVAL_MS,
    STARTUP_DELAY_MS + 20000,
    generation
  );

  scheduleTask(
    'Volunteer notification cleanup',
    processVolunteerCleanup,
    CLEANUP_INTERVAL_MS,
    CLEANUP_INTERVAL_MS,
    generation
  );

  console.log(
    '[Volunteer Scheduler] Started successfully'
  );
}

// ========================================
// STOP SCHEDULER
// ========================================

export function stopVolunteerScheduler(): void {
  if (!schedulerStarted) {
    return;
  }

  schedulerStarted = false;

  schedulerGeneration++;

  for (const timer of timers) {
    clearTimeout(timer);
  }

  timers.clear();

  console.log(
    '[Volunteer Scheduler] Stopped'
  );
}