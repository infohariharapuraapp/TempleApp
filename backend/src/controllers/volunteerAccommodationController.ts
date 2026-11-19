import { Request, Response } from 'express';
import { PoolClient } from 'pg';
import { pool } from '../db';
import { AuthRequest } from '../middleware/authMiddleware';

import {
  queueVolunteerPersonalMemberEvent,
} from '../services/volunteerPersonalMemberEventService';


// ========================================
// HELPERS
// ========================================

class AccommodationError extends Error {
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
  throw new AccommodationError(status, message);
}

const validId = (value: string) =>
  /^[1-9]\d*$/.test(value) &&
  Number(value) <= 2147483647;

const validNumberId = (
  value: unknown
): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value > 0 &&
  value <= 2147483647;

const optionalText = (
  value: unknown,
  maxLength = 10000
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

const requiredName = (
  value: unknown
): string => {
  const name = optionalText(value, 255);

  if (!name) {
    fail(400, 'Accommodation name is required');
  }

  return name;
};

const optionalPhone = (
  value: unknown
): string | null => {
  const phone = optionalText(value, 20);

  if (
    phone &&
    !/^\+?[0-9\s()-]{7,20}$/.test(phone)
  ) {
    fail(400, 'Invalid contact phone number');
  }

  return phone;
};

const optionalTimestamp = (
  value: unknown
): string | null => {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return null;
  }

  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(value) ||
    Number.isNaN(Date.parse(value))
  ) {
    fail(
      400,
      'Provide a valid date and time with timezone'
    );
  }

  return new Date(value).toISOString();
};

const handleError = (
  res: Response,
  error: unknown
) => {
  if (error instanceof AccommodationError) {
    return res.status(error.status).json({
      success: false,
      message: error.message,
    });
  }

  console.error(
    'Volunteer accommodation error:',
    error
  );

  return res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
};

// ========================================
// EDITABLE FIELDS
// ========================================

const FIELD_VALIDATORS: Record<
  string,
  (value: unknown) => unknown
> = {
  accommodation_name:
    requiredName,

  building_name:
    value => optionalText(value, 255),

  room_number:
    value => optionalText(value, 100),

  address:
    value => optionalText(value),

  check_in_at:
    optionalTimestamp,

  check_out_at:
    optionalTimestamp,

  contact_person:
    value => optionalText(value, 255),

  contact_phone:
    optionalPhone,

  instructions:
    value => optionalText(value),
};

const ACCOMMODATION_FIELDS =
  Object.keys(FIELD_VALIDATORS);

// ========================================
// VALIDATE CHECK-IN AND CHECK-OUT
// ========================================

function validateDates(
  checkIn: string | Date | null,
  checkOut: string | Date | null
) {
  if (
    checkIn &&
    checkOut &&
    new Date(checkOut).getTime() <=
      new Date(checkIn).getTime()
  ) {
    fail(
      400,
      'Check-out must be after check-in'
    );
  }
}

// ========================================
// LOCK OPPORTUNITY
// ========================================

async function lockOpportunity(
  client: PoolClient,
  opportunityId: string
) {
  const result = await client.query(
    `
    SELECT id

    FROM volunteer_opportunities

    WHERE id = $1

    FOR UPDATE
    `,
    [opportunityId]
  );

  if (!result.rows.length) {
    fail(404, 'Volunteer opportunity not found');
  }
}

// ========================================
// VALIDATE APPROVED VOLUNTEER
// ========================================

async function getApprovedMember(
  client: PoolClient,
  opportunityId: string,
  memberId: number
) {
  const result = await client.query(
    `
    SELECT
      m.id,
      m.full_name,
      m.status,

      r.status AS registration_status

    FROM volunteer_members m

    JOIN volunteer_registrations r
      ON r.id = m.registration_id

    WHERE m.id = $1

    AND m.opportunity_id = $2

    FOR UPDATE OF m, r
    `,
    [
      memberId,
      opportunityId,
    ]
  );

  if (!result.rows.length) {
    fail(404, 'Volunteer member not found');
  }

  const member = result.rows[0];

  if (
    member.status !== 'approved' ||
    ![
      'approved',
      'assigned',
      'in_progress',
    ].includes(member.registration_status)
  ) {
    fail(
      409,
      `${member.full_name} is not eligible for accommodation`
    );
  }

  return member;
}

// ========================================
// ADMIN ACCOMMODATION SELECT
// ========================================

const ACCOMMODATION_SELECT = `
  SELECT
    a.*,

    m.full_name,
    m.member_code,
    m.mobile,
    m.gender,
    m.status AS member_status,
    m.is_team_leader,

    r.id AS registration_id,
    r.registration_code,
    r.registration_type,
    r.group_name,
    r.status AS registration_status,

    o.title AS programme_name,

    u.full_name AS created_by_name

  FROM volunteer_accommodation a

  JOIN volunteer_members m
    ON m.id = a.member_id

  JOIN volunteer_registrations r
    ON r.id = m.registration_id

  JOIN volunteer_opportunities o
    ON o.id = a.opportunity_id

  LEFT JOIN users u
    ON u.id = a.created_by
`;

// ========================================
// ADMIN: GET ELIGIBLE MEMBERS
// ========================================

export const getEligibleAccommodationMembers =
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const opportunityId = String(
        req.params.opportunityId
      );

      if (!validId(opportunityId)) {
        fail(400, 'Invalid opportunity ID');
      }

      const search = req.query.search;

      if (
        search !== undefined &&
        (
          typeof search !== 'string' ||
          search.length > 150
        )
      ) {
        fail(400, 'Invalid search value');
      }

      const result = await pool.query(
        `
        SELECT
          m.id AS member_id,
          m.full_name,
          m.member_code,
          m.mobile,
          m.gender,
          m.is_team_leader,

          r.id AS registration_id,
          r.registration_code,
          r.registration_type,
          r.group_name,

          (
            SELECT COUNT(*)::integer

            FROM volunteer_accommodation a

            WHERE a.member_id = m.id

          ) AS accommodation_count,

          (
            SELECT COUNT(*)::integer

            FROM volunteer_accommodation a

            WHERE a.member_id = m.id

            AND a.is_visible = TRUE

          ) AS visible_accommodation_count

        FROM volunteer_members m

        JOIN volunteer_registrations r
          ON r.id = m.registration_id

        WHERE m.opportunity_id = $1

        AND m.status = 'approved'

        AND r.status IN (
          'approved',
          'assigned',
          'in_progress'
        )

        AND (
          $2::text IS NULL

          OR m.full_name ILIKE $2

          OR m.member_code ILIKE $2

          OR m.mobile ILIKE $2

          OR r.group_name ILIKE $2
        )

        ORDER BY
          r.group_name ASC NULLS FIRST,
          m.is_team_leader DESC,
          m.full_name ASC
        `,
        [
          opportunityId,

          typeof search === 'string' &&
          search.trim()
            ? `%${search.trim()}%`
            : null,
        ]
      );

      return res.json({
        success: true,
        data: result.rows,
      });
    } catch (error) {
      return handleError(res, error);
    }
  };

// ========================================
// ADMIN: GET ALL ACCOMMODATION RECORDS
// ========================================

export const getVolunteerAccommodation =
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const opportunityId = String(
        req.params.opportunityId
      );

      if (!validId(opportunityId)) {
        fail(400, 'Invalid opportunity ID');
      }

      const memberId = req.query.member_id;
      const visible = req.query.visible;

      if (
        memberId !== undefined &&
        (
          typeof memberId !== 'string' ||
          !validId(memberId)
        )
      ) {
        fail(400, 'Invalid member ID');
      }

      if (
        visible !== undefined &&
        visible !== 'true' &&
        visible !== 'false'
      ) {
        fail(400, 'Invalid visibility filter');
      }

      const result = await pool.query(
        `
        ${ACCOMMODATION_SELECT}

        WHERE a.opportunity_id = $1

        AND (
          $2::integer IS NULL

          OR a.member_id = $2
        )

        AND (
          $3::boolean IS NULL

          OR a.is_visible = $3
        )

        ORDER BY
          a.created_at DESC,
          a.id DESC
        `,
        [
          opportunityId,
          memberId ?? null,

          visible === undefined
            ? null
            : visible === 'true',
        ]
      );

      return res.json({
        success: true,
        data: result.rows,
      });
    } catch (error) {
      return handleError(res, error);
    }
  };

// ========================================
// ADMIN: GET SINGLE ACCOMMODATION
// ========================================

export const getVolunteerAccommodationById =
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const opportunityId = String(
        req.params.opportunityId
      );

      const accommodationId = String(
        req.params.accommodationId
      );

      if (
        !validId(opportunityId) ||
        !validId(accommodationId)
      ) {
        fail(400, 'Invalid ID');
      }

      const result = await pool.query(
        `
        ${ACCOMMODATION_SELECT}

        WHERE a.id = $1

        AND a.opportunity_id = $2
        `,
        [
          accommodationId,
          opportunityId,
        ]
      );

      if (!result.rows.length) {
        fail(404, 'Accommodation record not found');
      }

      return res.json({
        success: true,
        data: result.rows[0],
      });
    } catch (error) {
      return handleError(res, error);
    }
  };

// ========================================
// ADMIN: CREATE SINGLE OR BULK ACCOMMODATION
// ========================================

export const createVolunteerAccommodation =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      if (!req.user) {
        fail(401, 'Authentication required');
      }

      const adminId = req.user.userId;

      const opportunityId = String(
        req.params.opportunityId
      );

      if (!validId(opportunityId)) {
        fail(400, 'Invalid opportunity ID');
      }

      const body = req.body ?? {};

      const memberIds = Array.isArray(
        body.member_ids
      )
        ? body.member_ids
        : [body.member_id];

      if (
        !memberIds.length ||
        memberIds.length > 500 ||
        !memberIds.every(validNumberId) ||
        new Set(memberIds).size !==
          memberIds.length
      ) {
        fail(
          400,
          'Provide between 1 and 500 unique volunteer IDs'
        );
      }

      const values = ACCOMMODATION_FIELDS.map(
        field =>
          FIELD_VALIDATORS[field](body[field])
      );

      const checkIn = optionalTimestamp(
        body.check_in_at
      );

      const checkOut = optionalTimestamp(
        body.check_out_at
      );

      validateDates(checkIn, checkOut);

      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        await lockOpportunity(
          client,
          opportunityId
        );

        const created: any[] = [];

        for (const memberId of memberIds) {
          const member = await getApprovedMember(
            client,
            opportunityId,
            memberId
          );

          // Prevent duplicate accommodation
          // records for the same volunteer.

          const duplicate = await client.query(
            `
            SELECT id

            FROM volunteer_accommodation

            WHERE member_id = $1

            AND LOWER(TRIM(accommodation_name))
              = LOWER(TRIM($2::text))

            AND building_name IS NOT DISTINCT
              FROM $3::varchar

            AND room_number IS NOT DISTINCT
              FROM $4::varchar

            AND check_in_at IS NOT DISTINCT
              FROM $5::timestamptz

            AND check_out_at IS NOT DISTINCT
              FROM $6::timestamptz

            LIMIT 1
            `,
            [
              memberId,

              requiredName(
                body.accommodation_name
              ),

              optionalText(
                body.building_name,
                255
              ),

              optionalText(
                body.room_number,
                100
              ),

              checkIn,
              checkOut,
            ]
          );

          if (duplicate.rows.length) {
            fail(
              409,
              `Accommodation already exists for ${member.full_name}`
            );
          }

          const placeholders =
            ACCOMMODATION_FIELDS.map(
              (_, index) => `$${index + 3}`
            ).join(', ');

          const result = await client.query(
            `
            INSERT INTO volunteer_accommodation (
              opportunity_id,
              member_id,

              ${ACCOMMODATION_FIELDS.join(', ')},

              is_visible,
              created_by
            )

            VALUES (
              $1,
              $2,

              ${placeholders},

              FALSE,

              $${values.length + 3}
            )

            RETURNING *
            `,
            [
              opportunityId,
              memberId,
              ...values,
              adminId,
            ]
          );

          created.push({
            ...result.rows[0],
            full_name: member.full_name,
          });
        }

        await client.query('COMMIT');

        return res.status(201).json({
          success: true,

          message:
            `Accommodation created for ${created.length} volunteer(s)`,

          data: created,
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

// ========================================
// ADMIN: UPDATE ACCOMMODATION DETAILS
// ========================================

export const updateVolunteerAccommodation =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      if (!req.user) {
        fail(401, 'Authentication required');
      }

      const opportunityId = String(
        req.params.opportunityId
      );

      const accommodationId = String(
        req.params.accommodationId
      );

      if (
        !validId(opportunityId) ||
        !validId(accommodationId)
      ) {
        fail(400, 'Invalid ID');
      }

      const body = req.body ?? {};

      const fields =
        ACCOMMODATION_FIELDS.filter(
          field => body[field] !== undefined
        );

      if (!fields.length) {
        fail(400, 'No editable fields provided');
      }

      const values = fields.map(
        field =>
          FIELD_VALIDATORS[field](body[field])
      );

      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        await lockOpportunity(
          client,
          opportunityId
        );

        const existing = await client.query(
          `
          SELECT *

          FROM volunteer_accommodation

          WHERE id = $1

          AND opportunity_id = $2

          FOR UPDATE
          `,
          [
            accommodationId,
            opportunityId,
          ]
        );

        if (!existing.rows.length) {
          fail(
            404,
            'Accommodation record not found'
          );
        }

        const current = existing.rows[0];

        await getApprovedMember(
          client,
          opportunityId,
          current.member_id
        );

        const checkIn =
          body.check_in_at !== undefined
            ? optionalTimestamp(
                body.check_in_at
              )
            : current.check_in_at;

        const checkOut =
          body.check_out_at !== undefined
            ? optionalTimestamp(
                body.check_out_at
              )
            : current.check_out_at;

        validateDates(checkIn, checkOut);

        const setters = fields.map(
          (field, index) =>
            `${field} = $${index + 1}`
        );

        const result = await client.query(
          `
          UPDATE volunteer_accommodation

          SET
            ${setters.join(', ')},
            updated_at = NOW()

          WHERE id = $${values.length + 1}

          AND opportunity_id =
            $${values.length + 2}

          RETURNING *
          `,
          [
            ...values,
            accommodationId,
            opportunityId,
          ]
        );

        await client.query('COMMIT');

        return res.json({
          success: true,

          message:
            'Accommodation details updated successfully',

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

// ========================================
// ADMIN: SHOW OR HIDE ACCOMMODATION
// ========================================

// ========================================
// UPDATE ACCOMMODATION VISIBILITY
// ========================================

export const updateVolunteerAccommodationVisibility =
  async (
    req: AuthRequest,
    res: Response
  ) => {

    try {

      if (!req.user) {

        fail(
          401,
          'Authentication required'
        );
      }

      const opportunityId = String(
        req.params.opportunityId
      );

      const accommodationId = String(
        req.params.accommodationId
      );

      if (

        !validId(opportunityId) ||

        !validId(accommodationId)

      ) {

        fail(
          400,
          'Invalid ID'
        );
      }

      const visible =
        req.body?.is_visible;

      if (typeof visible !== 'boolean') {

        fail(
          400,
          'is_visible must be true or false'
        );
      }

      const client =
        await pool.connect();

      try {

        // ========================================
        // BEGIN TRANSACTION
        // ========================================

        await client.query('BEGIN');

        await lockOpportunity(
          client,
          opportunityId
        );

        // ========================================
        // LOAD CURRENT ACCOMMODATION
        // ========================================

        const existing =
          await client.query(
            `
            SELECT *

            FROM volunteer_accommodation

            WHERE id = $1

            AND opportunity_id = $2

            FOR UPDATE
            `,
            [
              accommodationId,
              opportunityId,
            ]
          );

        if (!existing.rows.length) {

          fail(
            404,
            'Accommodation record not found'
          );
        }

        const currentAccommodation =
          existing.rows[0];

        // ========================================
        // VALIDATE PUBLICATION ELIGIBILITY
        // ========================================

        // Admin can always hide accommodation.
        // Publishing requires an approved member.

        if (visible) {

          await getApprovedMember(
            client,
            opportunityId,
            currentAccommodation.member_id
          );
        }

        // ========================================
        // IDENTIFY NEW PUBLICATION
        // ========================================

        const isNewPublication =

          visible === true &&

          currentAccommodation.is_visible
            === false;

        // ========================================
        // UPDATE VISIBILITY AND REVISION
        // ========================================

        const result =
          await client.query(
            `
            UPDATE volunteer_accommodation

            SET

              is_visible = $1,

              published_at = CASE

                WHEN $1::boolean = FALSE

                THEN NULL

                WHEN is_visible = FALSE

                THEN clock_timestamp()

                ELSE published_at

              END,

              updated_at = NOW()

            WHERE id = $2

            AND opportunity_id = $3

            RETURNING *
            `,
            [
              visible,
              accommodationId,
              opportunityId,
            ]
          );

        // ========================================
        // QUEUE NEW PUBLICATION NOTIFICATION
        // ========================================

        if (isNewPublication) {

          const notificationSummary =
            await queueVolunteerPersonalMemberEvent(

              Number(result.rows[0].id),

              'accommodation_available',

              client
            );

          if (!notificationSummary.eligible) {

            fail(
              409,
              'Accommodation is not eligible for publication notification'
            );
          }
        }

        // ========================================
        // COMMIT ACCOMMODATION AND NOTIFICATION
        // ========================================

        await client.query('COMMIT');

        // ========================================
        // RETURN EXISTING API RESPONSE
        // ========================================

        return res.json({

          success: true,

          message: visible

            ? 'Accommodation details published'

            : 'Accommodation details hidden',

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

      return handleError(
        res,
        error
      );
    }
  };
// ========================================
// DEVOTEE: VIEW OWN ACCOMMODATION
// ========================================

export const getMyVolunteerAccommodation =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      if (!req.user) {
        fail(401, 'Authentication required');
      }

      res.set(
        'Cache-Control',
        'private, no-store'
      );

      const userId = req.user.userId;

      const registrationId =
        req.query.registration_id;

      if (
        registrationId !== undefined &&
        (
          typeof registrationId !== 'string' ||
          !validId(registrationId)
        )
      ) {
        fail(400, 'Invalid registration ID');
      }

      const result = await pool.query(
        `
        SELECT
          a.id,
          a.opportunity_id,
          a.member_id,

          a.accommodation_name,
          a.building_name,
          a.room_number,
          a.address,

          a.check_in_at,
          a.check_out_at,

          a.contact_person,
          a.contact_phone,
          a.instructions,

          m.full_name,
          m.member_code,

          r.id AS registration_id,
          r.registration_code,
          r.registration_type,
          r.group_name,

          o.title AS programme_name

        FROM volunteer_accommodation a

        JOIN volunteer_members m
          ON m.id = a.member_id

        JOIN volunteer_registrations r
          ON r.id = m.registration_id

        JOIN volunteer_opportunities o
          ON o.id = a.opportunity_id

        WHERE a.is_visible = TRUE

        AND (
          r.user_id = $1

          OR m.user_id = $1
        )

        AND m.status IN (
          'approved',
          'completed'
        )

        AND r.status IN (
          'approved',
          'assigned',
          'in_progress',
          'completed'
        )

        AND (
          $2::integer IS NULL

          OR r.id = $2
        )

        ORDER BY
          a.check_in_at DESC NULLS LAST,
          m.full_name ASC,
          a.id DESC
        `,
        [
          userId,
          registrationId ?? null,
        ]
      );

      return res.json({
        success: true,
        data: result.rows,
      });
    } catch (error) {
      return handleError(res, error);
    }
  };