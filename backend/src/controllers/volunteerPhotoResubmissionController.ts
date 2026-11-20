import {
  queueVolunteerPhotoEvent,
} from '../services/volunteerPhotoEventService';import { Response } from 'express';
import { pool } from '../db';
import { AuthRequest } from '../middleware/authMiddleware';
class PhotoError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}
function fail(status: number, message: string): never {
  throw new PhotoError(status, message);
}
function parseId(value: unknown): number {
  const text = String(value ?? '');
  const number = Number(text);
  if (
    !/^[1-9]\d*$/.test(text) ||
    !Number.isSafeInteger(number) ||
    number > 2147483647
  ) {
    fail(400, 'Invalid registration or member ID');
  }
  return number;
}
export const resubmitVolunteerPhoto = async (
  req: AuthRequest,
  res: Response
) => {
  res.set('Cache-Control', 'private, no-store');
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }
  try {
    const userId = req.user.userId;
    const registrationId = parseId(
      req.params.registrationId
    );
    const memberId = parseId(
      req.params.memberId
    );
    const uploadId = req.body?.photo_upload_id;
    const revision = req.body?.photo_revision;
    if (
      typeof uploadId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uploadId)
    ) {
      fail(400, 'Invalid photograph upload reference');
    }
    if (
      !Number.isInteger(revision) ||
      revision < 0 ||
      revision >= 2147483647
    ) {
      fail(400, 'Invalid photograph revision');
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        "SET LOCAL lock_timeout = '5s'"
      );
      await client.query(
        "SET LOCAL statement_timeout = '15s'"
      );
      // Lock opportunity first, consistent with
      // registration review and ID card operations.
      const opportunity = await client.query(
        `
        SELECT o.id
        FROM volunteer_opportunities o
        JOIN volunteer_registrations r
          ON r.opportunity_id = o.id
        WHERE r.id = $1
          AND (
            r.user_id = $2
            OR EXISTS (
              SELECT 1
              FROM volunteer_members m
              WHERE m.registration_id = r.id
                AND m.id = $3
                AND m.user_id = $2
            )
          )
        FOR UPDATE OF o
        `,
        [registrationId, userId, memberId]
      );
      if (!opportunity.rows.length) {
        fail(404, 'Registration not found');
      }
      const opportunityId =
        opportunity.rows[0].id;
      const registrationResult = await client.query(
        `
        SELECT id, user_id, status
        FROM volunteer_registrations
        WHERE id = $1
          AND opportunity_id = $2
        FOR UPDATE
        `,
        [registrationId, opportunityId]
      );
      const registration =
        registrationResult.rows[0];
      if (!registration) {
        fail(404, 'Registration not found');
      }
      if (
        ![
          'pending',
          'approved',
          'assigned',
          'in_progress'
        ].includes(registration.status)
      ) {
        fail(
          409,
          'This registration no longer accepts photograph changes'
        );
      }
      const memberResult = await client.query(
        `
        SELECT
          id,
          user_id,
          status,
          photo_url,
          photo_status,
          photo_revision
        FROM volunteer_members
        WHERE id = $1
          AND registration_id = $2
          AND opportunity_id = $3
        FOR UPDATE
        `,
        [
          memberId,
          registrationId,
          opportunityId,
        ]
      );
      const member = memberResult.rows[0];
      if (
        !member ||
        (
          Number(registration.user_id) !== userId &&
          Number(member.user_id) !== userId
        )
      ) {
        fail(404, 'Volunteer not found');
      }
      if (
        !['pending', 'approved'].includes(member.status)
      ) {
        fail(
          409,
          'This volunteer no longer accepts photograph changes'
        );
      }
      if (Number(member.photo_revision) !== revision) {
        fail(
          409,
          'Photograph information changed. Refresh and try again.'
        );
      }
      if (
        !['missing', 'correction_required'].includes(
          member.photo_status
        )
      ) {
        fail(
          409,
          'Photograph replacement is not currently required'
        );
      }
      // Do not replace a photograph while a valid
      // active ID card refers to the existing image.
      const activeCard = await client.query(
        `
        SELECT id
        FROM volunteer_id_cards
        WHERE member_id = $1
          AND opportunity_id = $2
          AND status = 'active'
          AND valid_until >=
            (clock_timestamp()
              AT TIME ZONE 'Asia/Kolkata')::date
        FOR UPDATE
        `,
        [memberId, opportunityId]
      );
      if (activeCard.rows.length) {
        fail(
          409,
          'An active ID card exists. Contact the temple administrator.'
        );
      }
      // Consume exactly one temporary upload.
      // Ownership and opportunity must match.
      const uploaded = await client.query(
        `
        UPDATE volunteer_photo_uploads
        SET consumed_at = clock_timestamp()
        WHERE id = $1::uuid
          AND user_id = $2
          AND opportunity_id = $3
          AND consumed_at IS NULL
          AND expires_at > clock_timestamp()
        RETURNING photo_url
        `,
        [
          uploadId,
          userId,
          opportunityId,
        ]
      );
      if (!uploaded.rows.length) {
        fail(
          409,
          'Photograph upload expired or is unavailable. Upload again.'
        );
      }
      const newStatus =
        member.photo_status === 'missing'
          ? 'pending'
          : 'resubmitted';
      const result = await client.query(
        `
        UPDATE volunteer_members
        SET
          photo_url = $1,
          photo_status = $2,
          photo_revision = photo_revision + 1,
          photo_uploaded_at = NOW(),
          photo_review_comment = NULL,
          photo_reviewed_at = NULL,
          photo_reviewed_by = NULL,
          updated_at = NOW()
        WHERE id = $3
          AND registration_id = $4
          AND photo_revision = $5
        RETURNING
          id,
          photo_status,
          photo_revision,
          photo_uploaded_at
        `,
        [
          uploaded.rows[0].photo_url,
          newStatus,
          memberId,
          registrationId,
          revision,
        ]
      );
      if (result.rowCount !== 1) {
        fail(
          409,
          'Photograph information changed. Refresh and try again.'
        );
      }
      await queueVolunteerPhotoEvent(
        client,
        memberId,
        'photo_resubmitted'
      );
      await client.query('COMMIT');
      return res.json({
        success: true,
        message:
          'Photograph submitted for administrator verification',
        data: result.rows[0],
      });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    if (error instanceof PhotoError) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    console.error(
      'Volunteer photograph resubmission failed'
    );
    return res.status(500).json({
      success: false,
      message:
        'Unable to confirm photograph submission. Refresh My Sevas before retrying.',
    });
  }
};