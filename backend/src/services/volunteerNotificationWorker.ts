import { pool } from '../db';

import {
  VolunteerNotificationJob,
  claimVolunteerNotificationJob,
  renewVolunteerNotificationLock,
  ownsVolunteerNotificationJob,
  completeVolunteerNotificationJob,
  failVolunteerNotificationJob,
  cancelVolunteerNotificationJob,
  continueVolunteerNotificationJob,
  expireClaimedVolunteerNotificationJob,
  expireVolunteerNotificationJobs,
  recoverVolunteerNotificationJobs,
} from './volunteerNotificationQueueService';

import {
  prepareVolunteerNotification,
  VolunteerDeliveryContent,
} from './volunteerNotificationDeliveryService';

import {
  initializeVolunteerPushDevices,
  skipUnavailableVolunteerDevices,
  recoverInterruptedVolunteerDevices,
  sendNextVolunteerPushDevice,
  getVolunteerPushSummary,
} from './volunteerPushDeliveryService';

import {
  syncVolunteerNotificationSummaries,
  markVolunteerUsersWithoutDevices,
} from './volunteerNotificationSummaryService';

// ========================================
// CONFIGURATION
// ========================================

const MAX_JOBS_PER_EXECUTION = 5;

const MAX_DEVICES_PER_JOB = 50;

const HEARTBEAT_INTERVAL_MS = 30000;

const CONTINUATION_DELAY_MS = 30000;

let workerRunning = false;

// ========================================
// TYPES
// ========================================

export type VolunteerEventValidator = (
  job: VolunteerNotificationJob
) => Promise<VolunteerDeliveryContent | null>;

interface WorkerSummary {
  claimed: number;
  completed: number;
  continued: number;
  cancelled: number;
  expired: number;
  failed: number;
  errors: number;
}

type JobResult =
  | 'completed'
  | 'continued'
  | 'cancelled'
  | 'expired'
  | 'failed';

// ========================================
// UPDATE NOTIFICATION STATUS
// ========================================

async function updateVolunteerNotificationStatus(
  job: VolunteerNotificationJob,
  notificationId: number,
  status: string
): Promise<boolean> {

  const result = await pool.query(
    `
    UPDATE notifications n

    SET
      status = $4::varchar,

      sent_at = CASE

        WHEN $4::varchar = 'sent'
        THEN COALESCE(n.sent_at, NOW())

        ELSE n.sent_at

      END,

      updated_at = NOW()

    FROM volunteer_notification_jobs j

    WHERE j.id = $1

      AND j.lock_token = $2

      AND j.status = 'processing'

      AND j.notification_id = n.id

      AND n.id = $3

      AND n.notification_type = 'volunteer_seva'

      AND n.status <> 'cancelled'

    RETURNING n.id
    `,
    [
      job.id,
      job.lock_token,
      notificationId,
      status,
    ]
  );

  return result.rowCount === 1;
}

// ========================================
// VERIFY WORKER LOCK
// ========================================

async function assertWorkerOwnership(
  job: VolunteerNotificationJob
): Promise<void> {

  if (!job.lock_token) {

    throw new Error(
      'Missing volunteer notification lock'
    );
  }

  const ownsJob =
    await ownsVolunteerNotificationJob(
      job.id,
      job.lock_token
    );

  if (!ownsJob) {

    throw new Error(
      'Volunteer notification worker lock lost or expired'
    );
  }
}

// ========================================
// PROCESS ONE NOTIFICATION JOB
// ========================================

async function processVolunteerNotificationJob(
  job: VolunteerNotificationJob,

  validateEvent: VolunteerEventValidator

): Promise<JobResult> {

  const lockToken = job.lock_token;

  if (!lockToken) {

    throw new Error(
      'Claimed job does not have a lock token'
    );
  }

  let heartbeatFailed = false;

  let heartbeatRunning = false;

  let heartbeatTask: Promise<void> | null = null;

  const heartbeat = setInterval(() => {

    if (
      heartbeatRunning ||
      heartbeatFailed
    ) {
      return;
    }

    heartbeatRunning = true;

    heartbeatTask = (async () => {

      try {

        const renewed =
          await renewVolunteerNotificationLock(
            job.id,
            lockToken
          );

        if (!renewed) {
          heartbeatFailed = true;
        }

      } catch (error) {

        heartbeatFailed = true;

        console.error(
          '[Volunteer Worker] Heartbeat failed:',
          job.id,
          error
        );

      } finally {

        heartbeatRunning = false;
      }

    })();

  }, HEARTBEAT_INTERVAL_MS);

  try {

    // ========================================
    // STEP 1: VERIFY JOB OWNERSHIP
    // ========================================

    await assertWorkerOwnership(job);

    // ========================================
    // STEP 2: VALIDATE CURRENT EVENT
    // ========================================

    const content =
      await validateEvent(job);

    if (!content) {

      const cancelled =
        await cancelVolunteerNotificationJob(
          job.id,
          lockToken,
          'Volunteer event no longer eligible'
        );

      if (!cancelled) {

        throw new Error(
          'Unable to cancel notification job'
        );
      }

      return 'cancelled';
    }

    // ========================================
    // STEP 3: PREPARE NOTIFICATION RECORD
    // ========================================

    const prepared =
      await prepareVolunteerNotification(
        job,
        content
      );

    const notificationId =
      prepared.notificationId;

    // ========================================
    // STEP 4: INITIALIZE DEVICE RECORDS
    // ========================================

    await assertWorkerOwnership(job);

    await initializeVolunteerPushDevices(
      job,
      notificationId
    );

    // ========================================
    // STEP 5: RECOVER INTERRUPTED DEVICES
    // ========================================

    await recoverInterruptedVolunteerDevices(
      job
    );

    // ========================================
    // STEP 6: SKIP UNAVAILABLE DEVICES
    // ========================================

    await skipUnavailableVolunteerDevices(
      job
    );

    // ========================================
    // STEP 7: MARK USERS WITHOUT DEVICES
    // ========================================

    await markVolunteerUsersWithoutDevices(
      job.id,
      lockToken
    );

    // ========================================
    // STEP 8: MARK NOTIFICATION PROCESSING
    // ========================================

    const processing =
      await updateVolunteerNotificationStatus(
        job,
        notificationId,
        'processing'
      );

    if (!processing) {

      throw new Error(
        'Unable to mark notification processing'
      );
    }

    // ========================================
    // STEP 9: SEND DEVICE PUSH NOTIFICATIONS
    // ========================================

    let processedDevices = 0;

    while (
      processedDevices < MAX_DEVICES_PER_JOB
    ) {

      if (heartbeatFailed) {

        throw new Error(
          'Worker heartbeat failed'
        );
      }

      await assertWorkerOwnership(job);

      // Revalidate the event before sending
      // each additional device notification.

      const currentContent =
        await validateEvent(job);

      if (!currentContent) {

        await syncVolunteerNotificationSummaries(
          job.id
        );

        const cancelled =
          await cancelVolunteerNotificationJob(
            job.id,
            lockToken,
            'Volunteer event changed during processing'
          );

        if (!cancelled) {

          throw new Error(
            'Unable to cancel changed event'
          );
        }

        return 'cancelled';
      }

      const processed =
        await sendNextVolunteerPushDevice(
          job,
          notificationId,
          currentContent
        );

      if (!processed) {
        break;
      }

      processedDevices++;
    }

    // ========================================
    // STEP 10: SYNCHRONIZE USER SUMMARIES
    // ========================================

    await assertWorkerOwnership(job);

    await skipUnavailableVolunteerDevices(job);

    await syncVolunteerNotificationSummaries(
      job.id
    );

    // ========================================
    // STEP 11: CHECK REMAINING DEVICES
    // ========================================

    const deviceSummary =
      await getVolunteerPushSummary(
        job.id
      );

    const pending =
      Number(deviceSummary.pending ?? 0);

    const retry =
      Number(deviceSummary.retry ?? 0);

    const processingCount =
      Number(deviceSummary.processing ?? 0);

    const accepted =
      Number(deviceSummary.accepted ?? 0);

    const delivered =
      Number(deviceSummary.delivered ?? 0);

    const failed =
      Number(deviceSummary.failed ?? 0);

    const unknown =
      Number(deviceSummary.unknown ?? 0);

    // ========================================
    // STEP 12: CONTINUE UNFINISHED WORK
    // ========================================

    if (
      pending > 0 ||
      retry > 0
    ) {

      const minimumContinuationTime =
        Date.now() + CONTINUATION_DELAY_MS;

      const databaseNextAttempt =
        deviceSummary.next_attempt_at
          ? new Date(
              deviceSummary.next_attempt_at
            ).getTime()

          : minimumContinuationTime;

      const nextAttemptAt = new Date(
        Math.max(
          databaseNextAttempt,
          minimumContinuationTime
        )
      );

      const continued =
        await continueVolunteerNotificationJob(
          job.id,
          lockToken,
          nextAttemptAt
        );

      if (!continued) {

        throw new Error(
          'Unable to continue notification job'
        );
      }

      return 'continued';
    }

    if (processingCount > 0) {

      throw new Error(
        'Unresolved processing device records'
      );
    }

    // ========================================
    // STEP 13: DETERMINE FINAL STATUS
    // ========================================

    const successful =
      accepted + delivered;

    const finalStatus =
      successful > 0
        ? 'sent'

        : unknown > 0
          ? 'unknown'

          : failed > 0
            ? 'failed'

            : 'sent';

    const updated =
      await updateVolunteerNotificationStatus(
        job,
        notificationId,
        finalStatus
      );

    if (!updated) {

      throw new Error(
        'Unable to update final notification status'
      );
    }

    // ========================================
    // STEP 14: COMPLETE OR FAIL THE JOB
    // ========================================

    if (
      finalStatus === 'failed' ||
      finalStatus === 'unknown'
    ) {

      const marked =
        await failVolunteerNotificationJob(
          job,

          finalStatus === 'unknown'
            ? 'Push submission outcome uncertain'
            : 'No device push submission succeeded',

          false
        );

      if (!marked) {

        throw new Error(
          'Unable to finalize failed notification job'
        );
      }

      return 'failed';
    }

    const completed =
      await completeVolunteerNotificationJob(
        job.id,
        lockToken
      );

    if (!completed) {

      throw new Error(
        'Unable to complete notification job'
      );
    }

    return 'completed';

  } catch (error) {

    const expired =
      await expireClaimedVolunteerNotificationJob(
        job.id,
        lockToken
      );

    if (expired) {

      return 'expired';
    }

    const ownsJob =
      await ownsVolunteerNotificationJob(
        job.id,
        lockToken
      );

    if (ownsJob) {

      await failVolunteerNotificationJob(
        job,
        String(error),
        true
      );
    }

    throw error;

  } finally {

    clearInterval(heartbeat);

    if (heartbeatTask) {
      await heartbeatTask;
    }
  }
}

// ========================================
// MAIN NOTIFICATION WORKER
// ========================================

export async function processVolunteerNotificationQueue(
  validateEvent: VolunteerEventValidator

): Promise<WorkerSummary> {

  const summary: WorkerSummary = {

    claimed: 0,

    completed: 0,

    continued: 0,

    cancelled: 0,

    expired: 0,

    failed: 0,

    errors: 0,
  };

  if (workerRunning) {
    return summary;
  }

  workerRunning = true;

  try {

    // Expire outdated pending jobs.

    summary.expired +=
      await expireVolunteerNotificationJobs();

    // Recover jobs interrupted by
    // Render restart or worker failure.

    await recoverVolunteerNotificationJobs();

    for (
      let index = 0;
      index < MAX_JOBS_PER_EXECUTION;
      index++
    ) {

      const job =
        await claimVolunteerNotificationJob();

      if (!job) {
        break;
      }

      summary.claimed++;

      try {

        const result =
          await processVolunteerNotificationJob(
            job,
            validateEvent
          );

        summary[result]++;

      } catch (error) {

        summary.errors++;

        console.error(
          '[Volunteer Worker] Job processing failed:',
          job.id,
          job.event_type,
          error
        );
      }
    }

    return summary;

  } finally {

    workerRunning = false;
  }
}
