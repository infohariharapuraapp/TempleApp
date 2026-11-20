import { Request, Response } from 'express';
import { pool } from '../db';
import { AuthRequest } from '../middleware/authMiddleware';
import {
  queueVolunteerPersonalRegistrationEvent,
} from '../services/volunteerPersonalRegistrationEventService';
// ========================================
// HELPERS
// ========================================

const VALID_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'assigned',
  'in_progress',
  'completed',
  'cancelled',
];

const validId = (value: string) =>
  /^[1-9]\d*$/.test(value) &&
  Number(value) <= 2147483647;

class ReviewError extends Error {
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
  throw new ReviewError(status, message);
}

const optionalText = (
  value: unknown,
  maxLength = 5000
): string | null => {
  if (value === undefined || value === null) {
    return null;
  }

  if (
    typeof value !== 'string' ||
    value.trim().length > maxLength
  ) {
    fail(400, 'Invalid text field');
  }

  return value.trim() || null;
};

const handleError = (
  res: Response,
  error: unknown
) => {
  if (error instanceof ReviewError) {
    return res.status(error.status).json({
      success: false,
      message: error.message,
    });
  }

  console.error(
    'Admin volunteer registration error:',
    error
  );

  return res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
};

// ========================================
// ADMIN: GET ALL REGISTRATIONS
// ========================================

export const getAdminVolunteerRegistrations = async (
  req: Request,
  res: Response
) => {
  try {
    const opportunityId =
      req.query.opportunity_id;

    const status = req.query.status;

    const registrationType =
      req.query.registration_type;

    const search = req.query.search;
    const photoStatus = req.query.photo_status;

    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 25);

    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      page > 100000 ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      fail(400, 'Invalid pagination');
    }

    const conditions: string[] = [];
    const values: any[] = [];

    if (opportunityId !== undefined) {
      if (
        typeof opportunityId !== 'string' ||
        !validId(opportunityId)
      ) {
        fail(400, 'Invalid opportunity ID');
      }

      values.push(Number(opportunityId));

      conditions.push(
        `r.opportunity_id = $${values.length}`
      );
    }

    if (status !== undefined) {
      if (
        typeof status !== 'string' ||
        !VALID_STATUSES.includes(status)
      ) {
        fail(400, 'Invalid registration status');
      }

      values.push(status);

      conditions.push(
        `r.status = $${values.length}`
      );
    }

    if (registrationType !== undefined) {
      if (
        typeof registrationType !== 'string' ||
        !['individual', 'group']
          .includes(registrationType)
      ) {
        fail(400, 'Invalid registration type');
      }

      values.push(registrationType);

      conditions.push(
        `r.registration_type = $${values.length}`
      );
    }

    if (photoStatus !== undefined) {
      if (
        typeof photoStatus !== 'string' ||
        ![
          'missing',
          'pending',
          'correction_required',
          'resubmitted',
          'verified',
          'all_verified',
          'needs_review',
        ].includes(photoStatus)
      ) {
        fail(400, 'Invalid photograph status');
      }
      if (photoStatus === 'all_verified') {
        conditions.push(`
          EXISTS (
            SELECT 1
            FROM volunteer_members m
            WHERE m.registration_id = r.id
          )
          AND NOT EXISTS (
            SELECT 1
            FROM volunteer_members m
            WHERE m.registration_id = r.id
            AND COALESCE(m.photo_status, 'missing')
              <> 'verified'
          )
        `);
      } else if (photoStatus === 'needs_review') {
        conditions.push(`
          EXISTS (
            SELECT 1
            FROM volunteer_members m
            WHERE m.registration_id = r.id
            AND COALESCE(m.photo_status, 'missing')
              <> 'verified'
          )
        `);
      } else {
        values.push(photoStatus);
        conditions.push(`
          EXISTS (
            SELECT 1
            FROM volunteer_members m
            WHERE m.registration_id = r.id
            AND COALESCE(m.photo_status, 'missing')
              = $${values.length}
          )
        `);
      }
    }
    if (search !== undefined) {
      if (
        typeof search !== 'string' ||
        search.length > 150
      ) {
        fail(400, 'Invalid search value');
      }

      if (search.trim()) {
        values.push(`%${search.trim()}%`);

        const index = values.length;

        conditions.push(`
          (
            r.registration_code ILIKE $${index}

            OR r.group_name ILIKE $${index}

            OR EXISTS (
              SELECT 1
              FROM volunteer_members m

              WHERE m.registration_id = r.id

              AND (
                m.full_name ILIKE $${index}
                OR m.mobile ILIKE $${index}
                OR m.member_code ILIKE $${index}
              )
            )
          )
        `);
      }
    }

    const where = conditions.length
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const countResult = await pool.query(
      `
      SELECT COUNT(*)::integer AS total
      FROM volunteer_registrations r
      ${where}
      `,
      values
    );

    const total = countResult.rows[0].total;

    const result = await pool.query(
      `
      SELECT
        r.id,
        r.registration_code,
        r.opportunity_id,
        r.registration_type,
        r.group_name,
        r.total_members,
        r.status,
        r.rejection_reason,
        r.created_at,
        r.reviewed_at,
        r.completed_at,

        o.title AS opportunity_title,

        o.service_start_date::text
          AS service_start_date,

        o.service_end_date::text
          AS service_end_date,

       CASE
  WHEN r.user_id IS NULL THEN 'Deleted Account'
  ELSE u.full_name
END AS registered_by_name,

u.phone AS registered_by_phone,
u.email AS registered_by_email,

(r.user_id IS NULL) AS is_registration_owner_deleted,

        (
          SELECT m.full_name

          FROM volunteer_members m

          WHERE m.registration_id = r.id

          ORDER BY
            m.is_team_leader DESC,
            m.id ASC

          LIMIT 1
        ) AS contact_member_name,

        (
          SELECT m.mobile

          FROM volunteer_members m

          WHERE m.registration_id = r.id

          ORDER BY
            m.is_team_leader DESC,
            m.id ASC

          LIMIT 1
        ) AS contact_member_mobile,

        (
          SELECT COUNT(*)::integer

          FROM volunteer_members m

          WHERE m.registration_id = r.id

          AND m.status IN (
            'approved', 'completed'
          )
        ) AS approved_members,

        (
          SELECT COUNT(*)::integer

          FROM volunteer_assignments a

          JOIN volunteer_members m
            ON m.id = a.member_id

          WHERE m.registration_id = r.id

          AND a.status NOT IN (
            'cancelled', 'reassigned'
          )
        ) AS total_assignments

      FROM volunteer_registrations r

      JOIN volunteer_opportunities o
        ON o.id = r.opportunity_id
LEFT JOIN users u
  ON u.id = r.user_id

      ${where}

      ORDER BY r.created_at DESC, r.id DESC

      LIMIT $${values.length + 1}

      OFFSET $${values.length + 2}
      `,
      [
        ...values,
        limit,
        (page - 1) * limit,
      ]
    );

    res.set(
      'Cache-Control',
      'private, no-store'
    );

    return res.json({
      success: true,
      data: result.rows,

      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// ========================================
// ADMIN: REGISTRATION STATISTICS
// ========================================

export const getVolunteerRegistrationStats = async (
  req: Request,
  res: Response
) => {
  try {
    const opportunityId =
      req.query.opportunity_id;

    if (
      opportunityId !== undefined &&
      (
        typeof opportunityId !== 'string' ||
        !validId(opportunityId)
      )
    ) {
      fail(400, 'Invalid opportunity ID');
    }

    const result = await pool.query(
      `
      SELECT
        COUNT(*)::integer
          AS total_registrations,

        COUNT(*) FILTER (
          WHERE registration_type = 'individual'
        )::integer AS individual_registrations,

        COUNT(*) FILTER (
          WHERE registration_type = 'group'
        )::integer AS group_registrations,

        COUNT(*) FILTER (
          WHERE status = 'pending'
        )::integer AS pending_registrations,

        COUNT(*) FILTER (
          WHERE status = 'approved'
        )::integer AS approved_registrations,

        COUNT(*) FILTER (
          WHERE status = 'rejected'
        )::integer AS rejected_registrations,

        COUNT(*) FILTER (
          WHERE status IN (
            'assigned', 'in_progress'
          )
        )::integer AS assigned_registrations,

        COUNT(*) FILTER (
          WHERE status = 'completed'
        )::integer AS completed_registrations,

        COUNT(*) FILTER (
          WHERE status = 'cancelled'
        )::integer AS cancelled_registrations,

        COALESCE(
          SUM(total_members), 0
        )::integer AS total_volunteers

      FROM volunteer_registrations

      WHERE (
        $1::integer IS NULL
        OR opportunity_id = $1
      )
      `,
      [opportunityId ?? null]
    );

    const memberStats = await pool.query(
      `
      SELECT
        COUNT(*) FILTER (
          WHERE m.status = 'pending'
        )::integer AS pending_volunteers,

        COUNT(*) FILTER (
          WHERE m.status IN (
            'approved', 'completed'
          )
        )::integer AS approved_volunteers,

        COUNT(*) FILTER (
          WHERE m.status = 'rejected'
        )::integer AS rejected_volunteers,

        COUNT(*) FILTER (
          WHERE m.status = 'completed'
        )::integer AS completed_volunteers

      FROM volunteer_members m

      JOIN volunteer_registrations r
        ON r.id = m.registration_id

      WHERE (
        $1::integer IS NULL
        OR m.opportunity_id = $1
      )

      AND r.status <> 'cancelled'
      `,
      [opportunityId ?? null]
    );

    res.set(
      'Cache-Control',
      'private, no-store'
    );

    return res.json({
      success: true,

      data: {
        ...result.rows[0],
        ...memberStats.rows[0],
      },
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// ========================================
// ADMIN: REGISTRATION DETAILS
// ========================================

export const getAdminVolunteerRegistrationById = async (
  req: Request,
  res: Response
) => {
  try {
    const id = String(req.params.id);

    if (!validId(id)) {
      fail(400, 'Invalid registration ID');
    }

    const registrationResult = await pool.query(
      `
      SELECT
        r.*,

        o.title AS opportunity_title,

        o.service_start_date::text
          AS service_start_date,

        o.service_end_date::text
          AS service_end_date,

       CASE
  WHEN r.user_id IS NULL THEN 'Deleted Account'
  ELSE u.full_name
END AS registered_by_name,

u.email AS registered_by_email,
u.phone AS registered_by_phone,

(r.user_id IS NULL) AS is_registration_owner_deleted,

        reviewer.full_name AS reviewed_by_name

      FROM volunteer_registrations r

      JOIN volunteer_opportunities o
        ON o.id = r.opportunity_id

     LEFT JOIN users u
  ON u.id = r.user_id
      LEFT JOIN users reviewer
        ON reviewer.id = r.reviewed_by

      WHERE r.id = $1
      `,
      [id]
    );

    if (!registrationResult.rows.length) {
      fail(404, 'Registration not found');
    }

    const memberResult = await pool.query(
      `
      SELECT
        m.*,

        m.date_of_birth::text AS date_of_birth,

        EXTRACT(
          YEAR FROM AGE(
            (NOW() AT TIME ZONE 'Asia/Kolkata')::date,
            m.date_of_birth
          )
        )::integer AS age,

        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'shift_id', s.id,
                'shift_name', s.shift_name,
                'service_date', s.service_date,
                'start_time', s.start_time,
                'end_time', s.end_time,
                'is_active', s.is_active
              )
              ORDER BY
                s.service_date,
                s.start_time
            )

            FROM volunteer_availability a

            JOIN volunteer_shifts s
              ON s.id = a.shift_id

            WHERE a.member_id = m.id
          ),
          '[]'::jsonb
        ) AS availability,
        COALESCE(
          (
            SELECT jsonb_agg(
              sd.service_date::text
              ORDER BY sd.service_date
            )
            FROM volunteer_service_dates sd
            WHERE sd.member_id = m.id
              AND sd.opportunity_id =
                m.opportunity_id
          ),
          '[]'::jsonb
        ) AS service_dates

      FROM volunteer_members m

      WHERE m.registration_id = $1

      ORDER BY
        m.is_team_leader DESC,
        m.id ASC
      `,
      [id]
    );

    res.set(
      'Cache-Control',
      'private, no-store'
    );

    return res.json({
      success: true,

      data: {
        ...registrationResult.rows[0],
        members: memberResult.rows.map(member => ({
          ...member,
          photo_url: null,
        })),
      },
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// ========================================
// ADMIN: APPROVE OR REJECT REGISTRATION
// ========================================

export const reviewVolunteerRegistration = async (
  req: AuthRequest,
  res: Response
) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }

  const id = String(req.params.id);
  const body = req.body ?? {};

  try {
    if (!validId(id)) {
      fail(400, 'Invalid registration ID');
    }

    const action = body.action;

    if (!['approve', 'reject'].includes(action)) {
      fail(400, 'Invalid review action');
    }

    const adminRemarks = optionalText(
      body.admin_remarks
    );

    const rejectionReason =
      action === 'reject'
        ? optionalText(body.rejection_reason)
        : null;

    if (
      action === 'reject' &&
      !rejectionReason
    ) {
      fail(400, 'Rejection reason is required');
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const opportunity = await client.query(
        `
        SELECT o.id
        FROM volunteer_opportunities o
        JOIN volunteer_registrations r
          ON r.opportunity_id = o.id
        WHERE r.id = $1
        FOR UPDATE OF o
        `,
        [id]
      );
      if (!opportunity.rows.length) {
        fail(404, 'Registration not found');
      }
      const existing = await client.query(
        `
        SELECT
          id,
          opportunity_id,
          status,
          registration_type,
          total_members,
          user_id

        FROM volunteer_registrations

        WHERE id = $1

        FOR UPDATE
        `,
        [id]
      );

      if (!existing.rows.length) {
        fail(404, 'Registration not found');
      }

      const registration = existing.rows[0];

      if (registration.status !== 'pending') {
        fail(
          409,
          'Only pending registrations can be reviewed'
        );
      }

      const members = await client.query(
        `
        SELECT
          id,
          status,
          is_team_leader,
          full_name,
          photo_url,
          photo_status,
          photo_revision
        FROM volunteer_members

        WHERE registration_id = $1

        FOR UPDATE
        `,
        [id]
      );

      if (
        members.rows.length !==
        registration.total_members
      ) {
        fail(
          409,
          'Registration member count does not match'
        );
      }

      if (
        members.rows.some(
          member => member.status !== 'pending'
        )
      ) {
        fail(
          409,
          'Registration contains previously reviewed members'
        );
      }

      if (action === 'approve') {
        const requirePhotos =
          process.env.VOLUNTEER_PHOTO_REQUIRED === 'true' ||
          members.rows.some(
            member =>
              Number(member.photo_revision) > 0 ||
              member.photo_status !== 'missing'
          );
        if (requirePhotos) {
          const unverified = members.rows.find(
            member =>
              member.photo_status !== 'verified' ||
              !member.photo_url?.trim()
          );
          if (unverified) {
            fail(
              409,
              `Verify the photograph of ${unverified.full_name} before approving this registration`
            );
          }
        }
      }
      const newStatus =
        action === 'approve'
          ? 'approved'
          : 'rejected';

      const result = await client.query(
        `
        UPDATE volunteer_registrations

        SET
          status = $1,
          admin_remarks = $2,
          rejection_reason = $3,
          reviewed_by = $4,
          reviewed_at = NOW(),
          updated_at = NOW()

        WHERE id = $5

        RETURNING *
        `,
        [
          newStatus,
          adminRemarks,
          rejectionReason,
          req.user.userId,
          id,
        ]
      );

      await client.query(
        `
        UPDATE volunteer_members

        SET
          status = $1,
          updated_at = NOW()

        WHERE registration_id = $2
        `,
        [newStatus, id]
      );

     // ========================================
// QUEUE REGISTRATION REVIEW NOTIFICATION
// ========================================

const notificationSummary =
  await queueVolunteerPersonalRegistrationEvent(
    Number(id),
    action === 'approve'
      ? 'registration_approved'
      : 'registration_rejected',
    client
  );

if (!notificationSummary.eligible) {
  throw new Error(
    'Registration review notification is not eligible'
  );
}

// ========================================
// COMMIT TRANSACTION
// ========================================

await client.query('COMMIT');
      return res.json({
        success: true,

        message:
          action === 'approve'
            ? 'Registration approved successfully'
            : 'Registration rejected successfully',

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
    return handleError(res, error);
  }
};