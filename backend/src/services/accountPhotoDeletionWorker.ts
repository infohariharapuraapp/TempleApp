import { pool } from '../db';
import cloudinary from '../config/cloudinary';
import {
  isValidAccountPhotoId,
} from './accountPhotoValidationService';
const BATCH_SIZE = 1;
let running = false;
export async function processAccountPhotoDeletions() {
  const summary = {
    deleted: 0,
    deferred: 0,
    failed: 0,
  };
  if (
    process.env.ACCOUNT_PHOTO_DELETION_ENABLED !== 'true' ||
    running
  ) {
    return summary;
  }
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (
    !cloudName ||
    !/^[a-zA-Z0-9_-]{1,100}$/.test(cloudName) ||
    cloudinary.config().cloud_name !== cloudName
  ) {
    throw new Error('Photo cleanup configuration invalid');
  }
  running = true;
  try {
    for (let i = 0; i < BATCH_SIZE; i++) {
      const client = await pool.connect();
      let discardClient = false;
      try {
        await client.query('BEGIN');
        await client.query(
          "SET LOCAL lock_timeout = '5s'"
        );
        await client.query(
          "SET LOCAL statement_timeout = '15s'"
        );
        await client.query(
          "SET LOCAL idle_in_transaction_session_timeout = '30s'"
        );
        const result = await client.query(
          `
          SELECT id, cloudinary_public_id
          FROM public.account_photo_deletion_queue
          WHERE cloud_name = $1
            AND next_attempt_at <= clock_timestamp()
          ORDER BY next_attempt_at, id
          LIMIT 1
          FOR UPDATE SKIP LOCKED
          `,
          [cloudName]
        );
        const job = result.rows[0];
        if (!job) {
          await client.query('COMMIT');
          break;
        }
        const defer = async () => {
          await client.query(
            `
            UPDATE public.account_photo_deletion_queue
            SET attempts =
              LEAST(attempts::bigint + 1, 1000000)::integer,
                next_attempt_at =
                  clock_timestamp() + INTERVAL '1 hour'
            WHERE id = $1
            `,
            [job.id]
          );
        };
        if (!isValidAccountPhotoId(job.cloudinary_public_id)) {
          await defer();
          await client.query('COMMIT');
          summary.failed++;
          continue;
        }
        await client.query(
          `
          LOCK TABLE
            public.volunteer_members,
            public.volunteer_id_cards,
            public.volunteer_photo_uploads
          IN SHARE ROW EXCLUSIVE MODE NOWAIT
          `
        );
        const references = await client.query(
          `
          SELECT EXISTS (
            SELECT 1
            FROM volunteer_members
            WHERE photo_url IS NOT NULL
              AND strpos(photo_url, $1) > 0
            UNION ALL
            SELECT 1
            FROM volunteer_id_cards
            WHERE photo_url IS NOT NULL
              AND strpos(photo_url, $1) > 0
            UNION ALL
            SELECT 1
            FROM volunteer_photo_uploads
            WHERE cloudinary_public_id = $1
               OR strpos(photo_url, $1) > 0
          ) AS referenced
          `,
          [job.cloudinary_public_id]
        );
        if (references.rows[0]?.referenced !== false) {
          await defer();
          await client.query('COMMIT');
          summary.deferred++;
          continue;
        }
        let confirmed = false;
        try {
          const deletionOptions = {
            resource_type: 'image' as const,
            type: 'authenticated' as const,
            invalidate: true,
            timeout: 10000,
          };
          const deletion =
            await cloudinary.uploader.destroy(
              job.cloudinary_public_id,
              deletionOptions
            );
          confirmed =
            deletion?.result === 'ok' ||
            deletion?.result === 'not found';
        } catch {
          confirmed = false;
        }
        if (!confirmed) {
          await defer();
          await client.query('COMMIT');
          summary.failed++;
          continue;
        }
        await client.query(
          `
          DELETE FROM public.account_photo_deletion_queue
          WHERE id = $1
          `,
          [job.id]
        );
        await client.query('COMMIT');
        summary.deleted++;
      } catch {
        try {
          await client.query('ROLLBACK');
        } catch {
          discardClient = true;
        }
        summary.failed++;
        console.error(
          '[Account Photo Cleanup] Transaction failed'
        );
        break;
      } finally {
        client.release(discardClient);
      }
    }
    if (
      summary.deleted ||
      summary.deferred ||
      summary.failed
    ) {
      console.log('[Account Photo Cleanup]', summary);
    }
    return summary;
  } finally {
    running = false;
  }
}
