import {
  queueVolunteerPhotoEvent,
} from '../services/volunteerPhotoEventService';import { Response } from 'express';
import { pool } from '../db';
import { AuthRequest } from '../middleware/authMiddleware';

import {
  createVolunteerPhotoAccessUrl,
} from '../services/volunteerPhotoAccessService';


class PhotoReviewError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

function fail(
  status: number,
  message: string
): never {
  throw new PhotoReviewError(status, message);
}

function parseId(value: unknown): number | null {
  const text = String(value ?? '');

  if (!/^[1-9]\d*$/.test(text)) {
    return null;
  }

  const id = Number(text);

  return Number.isSafeInteger(id) &&
    id <= 2147483647
    ? id
    : null;
}

// ========================================
// ADMIN: REVIEW MEMBER PHOTOGRAPH
// ========================================

export const reviewVolunteerPhoto = async (
  req: AuthRequest,
  res: Response
) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }

  const reviewerId = req.user.userId;

  res.set('Cache-Control', 'private, no-store');

  try {
    const registrationId = parseId(
      req.params.registrationId
    );

    const memberId = parseId(
      req.params.memberId
    );

    if (!registrationId || !memberId) {
      fail(400, 'Invalid registration or member ID');
    }

    const {
      action,
      comment,
      photo_revision,
    } = req.body ?? {};

    if (
      action !== 'verify' &&
      action !== 'request_correction'
    ) {
      fail(400, 'Invalid photograph review action');
    }

    if (
      !Number.isInteger(photo_revision) ||
      photo_revision < 1 ||
      photo_revision > 2147483647
    ) {
      fail(400, 'Invalid photograph revision');
    }

    if (
      comment !== undefined &&
      comment !== null &&
      (
        typeof comment !== 'string' ||
        comment.trim().length > 1000
      )
    ) {
      fail(400, 'Invalid photograph review comment');
    }

    const reviewComment =
      typeof comment === 'string'
        ? comment.trim() || null
        : null;

    if (
      action === 'request_correction' &&
      !reviewComment
    ) {
      fail(400, 'Photograph correction comment is required');
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

      // ========================================
      // LOCK OPPORTUNITY FIRST
      // ========================================

      const opportunity = await client.query(
        `
        SELECT o.id
        FROM volunteer_opportunities o

        JOIN volunteer_registrations r
          ON r.opportunity_id = o.id

        WHERE r.id = $1

        FOR UPDATE OF o
        `,
        [registrationId]
      );

      if (!opportunity.rows.length) {
        fail(404, 'Registration not found');
      }

      // ========================================
      // LOCK REGISTRATION
      // ========================================

      const registrationResult = await client.query(
        `
        SELECT id, opportunity_id, status
        FROM volunteer_registrations

        WHERE id = $1

        FOR UPDATE
        `,
        [registrationId]
      );

      if (!registrationResult.rows.length) {
        fail(404, 'Registration not found');
      }

      const registration =
        registrationResult.rows[0];

      if (
        ![
          'pending',
          'approved',
          'assigned',
          'in_progress',
        ].includes(registration.status)
      ) {
        fail(
          409,
          'Photographs cannot be reviewed for this registration'
        );
      }

      // ========================================
      // LOCK VOLUNTEER
      // ========================================

      const memberResult = await client.query(
        `
        SELECT
          id,
          full_name,
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
          registration.opportunity_id,
        ]
      );

      if (!memberResult.rows.length) {
        fail(404, 'Volunteer member not found');
      }

      const member = memberResult.rows[0];

      if (
        !['pending', 'approved'].includes(
          member.status
        )
      ) {
        fail(409, 'Volunteer is not eligible for photograph review');
      }

      if (!member.photo_url?.trim()) {
        fail(409, 'Volunteer has not uploaded a photograph');
      }

      if (
        action === 'verify' &&
        !createVolunteerPhotoAccessUrl(member.photo_url)
      ) {
        fail(
          409,
          'Photograph is unavailable for private verification. Request a replacement photograph.'
        );
      }
      // Prevent reviewing an outdated photograph.

      if (
        Number(member.photo_revision) !==
        photo_revision
      ) {
        fail(
          409,
          'Photograph has changed. Refresh and review again.'
        );
      }

      if (
        !['pending', 'resubmitted'].includes(
          member.photo_status
        )
      ) {
        fail(
          409,
          'Photograph is not awaiting review'
        );
      }

      // ========================================
      // PROTECT EXISTING VALID ID CARD
      // ========================================

      const activeCard = await client.query(
        `
        SELECT id
        FROM volunteer_id_cards

        WHERE member_id = $1
          AND opportunity_id = $2
          AND status = 'active'
          AND valid_until >=
            (NOW() AT TIME ZONE 'Asia/Kolkata')::date

        FOR UPDATE
        `,
        [
          memberId,
          registration.opportunity_id,
        ]
      );

      if (activeCard.rows.length) {
        fail(
          409,
          'An active ID card exists for this volunteer'
        );
      }

      // ========================================
      // SAVE PHOTOGRAPH REVIEW
      // ========================================

      const newStatus =
        action === 'verify'
          ? 'verified'
          : 'correction_required';

      const result = await client.query(
        `
        UPDATE volunteer_members

        SET
          photo_status = $1,

          photo_review_comment = $2,

          photo_reviewed_at = NOW(),

          photo_reviewed_by = $3,

          updated_at = NOW()

        WHERE id = $4
          AND registration_id = $5
          AND photo_revision = $6

        RETURNING
          id,
          full_name,
          photo_status,
          photo_review_comment,
          photo_reviewed_at,
          photo_revision
        `,
        [
          newStatus,
          reviewComment,
          reviewerId,
          memberId,
          registrationId,
          photo_revision,
        ]
      );

      if (result.rows.length !== 1) {
        fail(
          409,
          'Photograph has changed. Please refresh.'
        );
      }

      await queueVolunteerPhotoEvent(
        client,
        memberId,
        req.body?.action === 'verify'
          ? 'photo_verified'
          : 'photo_correction_required'
      );
      await client.query('COMMIT');

      return res.json({
        success: true,

        message:
          action === 'verify'
            ? 'Photograph verified successfully'
            : 'Photograph correction requested',

        data: result.rows[0],
      });

    } catch (error) {
      await client.query('ROLLBACK')
        .catch(console.error);

      throw error;

    } finally {
      client.release();
    }

  } catch (error) {
    if (error instanceof PhotoReviewError) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }

    console.error(
      'Volunteer photograph review failed',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Unable to review photograph',
    });
  }
};

// ========================================
// ADMIN: VIEW VOLUNTEER PHOTOGRAPH
// ========================================

export const getAdminVolunteerPhoto = async (
  req: AuthRequest,
  res: Response
) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }

  res.set('Cache-Control', 'private, no-store');

  try {
    const registrationId = parseId(
      req.params.registrationId
    );

    const memberId = parseId(
      req.params.memberId
    );

    if (!registrationId || !memberId) {
      fail(400, 'Invalid registration or member ID');
    }

    const result = await pool.query(
      `
      SELECT
        m.id,
        m.photo_url,
        m.photo_status,
        m.photo_revision

      FROM volunteer_members m

      WHERE m.id = $1
        AND m.registration_id = $2
      `,
      [
        memberId,
        registrationId,
      ]
    );

    if (!result.rows.length) {
      fail(404, 'Volunteer member not found');
    }

    const member = result.rows[0];

    if (!member.photo_url) {
      fail(404, 'Photograph has not been uploaded');
    }

    const accessUrl =
      createVolunteerPhotoAccessUrl(
        member.photo_url
      );

    if (!accessUrl) {
      fail(
        409,
        'Photograph is unavailable for private preview'
      );
    }

    return res.json({
      success: true,

      data: {
        image_url: accessUrl,
        photo_status: member.photo_status,
        photo_revision: member.photo_revision,
        expires_in: 300,
      },
    });

  } catch (error) {
    if (error instanceof PhotoReviewError) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }

    console.error(
      'Volunteer photograph preview failed'
    );

    return res.status(500).json({
      success: false,
      message: 'Unable to load photograph',
    });
  }
};