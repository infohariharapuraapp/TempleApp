import { pool } from '../db';
import cloudinary from '../config/cloudinary';
const CLEANUP_BATCH_SIZE = 10;
const PRIVATE_PHOTO_ID =
  /^temple-app\/volunteer\/photos\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function cleanupExpiredVolunteerPhotos() {
  const summary = {
    deleted: 0,
    failed: 0,
    skipped: 0,
  };
  const candidates = await pool.query(
    `
    SELECT id
    FROM volunteer_photo_uploads
    WHERE consumed_at IS NULL
      AND expires_at <= clock_timestamp()
    ORDER BY expires_at ASC
    LIMIT $1
    `,
    [CLEANUP_BATCH_SIZE]
  );
  for (const candidate of candidates.rows) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        "SET LOCAL lock_timeout = '5s'"
      );
      await client.query(
        "SET LOCAL statement_timeout = '15s'"
      );
      await client.query(
        "SET LOCAL idle_in_transaction_session_timeout = '45s'"
      );
      // Lock the temporary upload before deletion.
      // Registration and resubmission must use
      // the same upload record to consume it.
      const result = await client.query(
        `
        SELECT
          id,
          photo_url,
          cloudinary_public_id
        FROM volunteer_photo_uploads
        WHERE id = $1::uuid
          AND consumed_at IS NULL
          AND expires_at <= clock_timestamp()
        FOR UPDATE SKIP LOCKED
        `,
        [candidate.id]
      );
      const photo = result.rows[0];
      if (!photo) {
        await client.query('ROLLBACK');
        summary.skipped++;
        continue;
      }
      if (
        typeof photo.cloudinary_public_id !== 'string' ||
        !PRIVATE_PHOTO_ID.test(
          photo.cloudinary_public_id
        )
      ) {
        await client.query('ROLLBACK');
        summary.skipped++;
        continue;
      }
      // Confirm that the URL identifies the same
      // authenticated Cloudinary resource.
      const url = new URL(photo.photo_url);
      const cloudName =
        process.env.CLOUDINARY_CLOUD_NAME;
      const prefix =
        `/${cloudName}/image/authenticated/`;
      const expectedPath =
        `${photo.cloudinary_public_id}.webp`;
      if (
        !cloudName ||
        url.protocol !== 'https:' ||
        url.hostname !== 'res.cloudinary.com' ||
        !url.pathname.startsWith(prefix) ||
        url.pathname
          .slice(prefix.length)
          .replace(/^s--[A-Za-z0-9_-]+--\//, '')
          .replace(/^v\d+\//, '') !== expectedPath
      ) {
        await client.query('ROLLBACK');
        summary.skipped++;
        continue;
      }
      // Never delete photographs referenced by
      // members or digital identity cards.
      const references = await client.query(
        `
        SELECT (
          EXISTS (
            SELECT 1
            FROM volunteer_members
            WHERE photo_url = $1
          )
          OR EXISTS (
            SELECT 1
            FROM volunteer_id_cards
            WHERE photo_url = $1
          )
        ) AS referenced
        `,
        [photo.photo_url]
      );
      if (references.rows[0]?.referenced) {
        await client.query('ROLLBACK');
        summary.skipped++;
        continue;
      }
      // Remove only the authenticated image.
      // Never delete folders or public resources.
      const deletion =
        await cloudinary.uploader.destroy(
          photo.cloudinary_public_id,
          {
            resource_type: 'image',
            type: 'authenticated',
            invalidate: true,
          }
        );
      if (
        deletion.result !== 'ok' &&
        deletion.result !== 'not found'
      ) {
        throw new Error(
          'Cloudinary deletion was not confirmed'
        );
      }
      const removed = await client.query(
        `
        DELETE FROM volunteer_photo_uploads
        WHERE id = $1::uuid
          AND consumed_at IS NULL
          AND expires_at <= clock_timestamp()
        `,
        [photo.id]
      );
      if (removed.rowCount !== 1) {
        throw new Error(
          'Expired photograph record was not removed'
        );
      }
      await client.query('COMMIT');
      summary.deleted++;
    } catch {
      await client.query('ROLLBACK').catch(() => {});
      summary.failed++;
      console.error(
        '[Volunteer Photo Cleanup] Record cleanup failed'
      );
    } finally {
      client.release();
    }
  }
  if (
    summary.deleted ||
    summary.failed ||
    summary.skipped
  ) {
    console.log(
      '[Volunteer Photo Cleanup]',
      summary
    );
  }
  return summary;
}
