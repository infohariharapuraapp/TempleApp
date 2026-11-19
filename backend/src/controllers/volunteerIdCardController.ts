import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { pool } from '../db';
import { AuthRequest } from '../middleware/authMiddleware';


import {
  queueVolunteerPersonalIdCardEvents,
  queueVolunteerPersonalMemberEvent,
} from '../services/volunteerPersonalMemberEventService';

// ========================================
// HELPERS
// ========================================

class IdCardError extends Error {
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
  throw new IdCardError(status, message);
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

const handleError = (
  res: Response,
  error: unknown
) => {
  if (error instanceof IdCardError) {
    return res.status(error.status).json({
      success: false,
      message: error.message,
    });
  }

  if (
    (error as { code?: string })?.code === '23505'
  ) {
    return res.status(409).json({
      success: false,
      message: 'Volunteer ID card already exists',
    });
  }

  console.error(
    'Volunteer ID card error:',
    error
  );

  return res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
};

// ========================================
// GENERATE UNIQUE CARD NUMBER
// ========================================

function generateCardNumber() {
  const year = new Intl.DateTimeFormat(
    'en-IN',
    {
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    }
  ).format(new Date());

  const uniqueCode = randomUUID()
    .replace(/-/g, '')
    .toUpperCase();

  return `DHH-VOL-${year}-${uniqueCode}`;
}

// ========================================
// LOCK OPPORTUNITY
// ========================================

async function lockOpportunity(
  client: any,
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
    fail(
      404,
      'Volunteer opportunity not found'
    );
  }
}

// ========================================
// ID CARD SELECT QUERY
// ========================================

const CARD_SELECT = `
  SELECT
    c.id,
    c.opportunity_id,
    c.member_id,
    c.card_number,
    c.photo_url,

    c.valid_from::text AS valid_from,
    c.valid_until::text AS valid_until,

    c.status AS stored_status,

    CASE

      WHEN c.status = 'revoked'
        THEN 'revoked'

      WHEN c.status = 'expired'
        THEN 'expired'

      WHEN c.valid_until <
        (NOW() AT TIME ZONE
          'Asia/Kolkata')::date
        THEN 'expired'

      WHEN m.status NOT IN (
        'approved',
        'completed'
      )
        THEN 'inactive'

      WHEN o.service_end_date <
        (NOW() AT TIME ZONE
          'Asia/Kolkata')::date
        THEN 'expired'

      WHEN NOT EXISTS (
        SELECT 1

        FROM volunteer_assignments a

        WHERE a.member_id = c.member_id

        AND a.status NOT IN (
          'cancelled',
          'reassigned'
        )
      )
        THEN 'inactive'

      WHEN c.valid_from >
        (NOW() AT TIME ZONE
          'Asia/Kolkata')::date
        THEN 'upcoming'

      WHEN NOT EXISTS (
        SELECT 1

        FROM volunteer_assignments a

        JOIN volunteer_shifts s
          ON s.id = a.shift_id

        WHERE a.member_id = c.member_id

        AND a.status NOT IN (
          'cancelled',
          'reassigned'
        )

        AND s.service_date =
          (NOW() AT TIME ZONE
            'Asia/Kolkata')::date
      )
        THEN 'not_scheduled_today'

      ELSE 'active'

    END AS effective_status,

    c.issued_at,
    c.revoked_at,
    c.revocation_reason,

    m.full_name,
    m.member_code,
    m.gender,
    m.is_team_leader,

    r.id AS registration_id,
    r.registration_code,
    r.registration_type,
    r.group_name,

    o.title AS programme_name,

    issuer.full_name AS issued_by_name,

    revoker.full_name AS revoked_by_name,

    ARRAY(
      SELECT DISTINCT
        s.service_date::text

      FROM volunteer_assignments a

      JOIN volunteer_shifts s
        ON s.id = a.shift_id

      WHERE a.member_id = c.member_id

      AND a.status NOT IN (
        'cancelled',
        'reassigned'
      )

      ORDER BY s.service_date::text

    ) AS authorized_service_dates

  FROM volunteer_id_cards c

  JOIN volunteer_members m
    ON m.id = c.member_id

  JOIN volunteer_registrations r
    ON r.id = m.registration_id

  JOIN volunteer_opportunities o
    ON o.id = c.opportunity_id

  LEFT JOIN users issuer
    ON issuer.id = c.issued_by

  LEFT JOIN users revoker
    ON revoker.id = c.revoked_by
`;

// ========================================
// VALIDATE MEMBER AND SERVICE DATES
// ========================================

async function getEligibleMember(
  client: any,
  opportunityId: string,
  memberId: number
) {
  const result = await client.query(
    `
    SELECT
      m.id,
      m.full_name,
      m.photo_url,
      m.status,
      m.registration_id,

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
    ].includes(
      member.registration_status
    )
  ) {
    fail(
      409,
      `${member.full_name} is not approved for ID card issuance`
    );
  }

  if (!member.photo_url) {
    fail(
      409,
      `${member.full_name} requires a verified volunteer photo`
    );
  }

  const dates = await client.query(
    `
    SELECT
      MIN(s.service_date)::text
        AS valid_from,

      MAX(s.service_date)::text
        AS valid_until,

      COUNT(*)::integer
        AS total_assignments,

      COALESCE(
        BOOL_OR(
          (
            (s.service_date + s.end_time)

            AT TIME ZONE 'Asia/Kolkata'

          ) > clock_timestamp()
        ),
        FALSE
      ) AS has_remaining_service

    FROM volunteer_assignments a

    JOIN volunteer_shifts s
      ON s.id = a.shift_id

    WHERE a.member_id = $1

    AND a.opportunity_id = $2

    AND a.status NOT IN (
      'cancelled',
      'reassigned'
    )
    `,
    [
      memberId,
      opportunityId,
    ]
  );

  const service = dates.rows[0];

  if (!service.total_assignments) {
    fail(
      409,
      `${member.full_name} has no assigned service duties`
    );
  }

  if (!service.has_remaining_service) {
    fail(
      409,
      `${member.full_name} has no remaining service shifts`
    );
  }

  return {
    ...member,

    valid_from: service.valid_from,

    valid_until: service.valid_until,
  };
}

// ========================================
// ADMIN: GET ELIGIBLE ID CARD MEMBERS
// ========================================

export const getEligibleIdCardMembers = async (
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

    const result = await pool.query(
      `
      SELECT
        m.id AS member_id,
        m.full_name,
        m.member_code,
        m.photo_url,
        m.gender,
        m.is_team_leader,

        r.registration_code,
        r.registration_type,
        r.group_name,

        c.id AS existing_card_id,
        c.status AS existing_card_status,

        MIN(s.service_date)::text
          AS valid_from,

        MAX(s.service_date)::text
          AS valid_until,

        COUNT(a.id)::integer
          AS total_assignments

      FROM volunteer_members m

      JOIN volunteer_registrations r
        ON r.id = m.registration_id

      JOIN volunteer_assignments a
        ON a.member_id = m.id

      JOIN volunteer_shifts s
        ON s.id = a.shift_id

      LEFT JOIN volunteer_id_cards c
        ON c.member_id = m.id

      WHERE m.opportunity_id = $1

      AND m.status = 'approved'

      AND r.status IN (
        'approved',
        'assigned',
        'in_progress'
      )

      AND a.status NOT IN (
        'cancelled',
        'reassigned'
      )

      GROUP BY m.id, r.id, c.id

      HAVING BOOL_OR(
        (
          (s.service_date + s.end_time)

          AT TIME ZONE 'Asia/Kolkata'

        ) > clock_timestamp()
      )

      ORDER BY m.full_name ASC
      `,
      [opportunityId]
    );

    return res.json({
      success: true,
      data: result.rows.map(row => ({
        ...row,

        can_issue:
          !!row.photo_url &&
          !row.existing_card_id,
      })),
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// ========================================
// ADMIN: GET ALL ID CARDS
// ========================================

export const getVolunteerIdCards = async (
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
    const status = req.query.status;

    if (
      search !== undefined &&
      (
        typeof search !== 'string' ||
        search.length > 150
      )
    ) {
      fail(400, 'Invalid search value');
    }

    const allowedStatuses = [
      'active',
      'upcoming',
      'expired',
      'revoked',
      'inactive',
      'not_scheduled_today',
    ];

    if (
      status !== undefined &&
      (
        typeof status !== 'string' ||
        !allowedStatuses.includes(status)
      )
    ) {
      fail(400, 'Invalid card status');
    }

    const result = await pool.query(
      `
      WITH cards AS (

        ${CARD_SELECT}

        WHERE c.opportunity_id = $1

        AND (
          $2::text IS NULL

          OR m.full_name ILIKE $2

          OR c.card_number ILIKE $2

          OR m.member_code ILIKE $2

          OR r.group_name ILIKE $2
        )
      )

      SELECT *

      FROM cards

      WHERE (
        $3::text IS NULL

        OR effective_status = $3
      )

      ORDER BY
        issued_at DESC,
        id DESC
      `,
      [
        opportunityId,

        typeof search === 'string' &&
        search.trim()
          ? `%${search.trim()}%`
          : null,

        status ?? null,
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
// ADMIN: GET SINGLE ID CARD
// ========================================

export const getVolunteerIdCardById = async (
  req: Request,
  res: Response
) => {
  try {
    const opportunityId = String(
      req.params.opportunityId
    );

    const cardId = String(
      req.params.cardId
    );

    if (
      !validId(opportunityId) ||
      !validId(cardId)
    ) {
      fail(400, 'Invalid ID');
    }

    const result = await pool.query(
      `
      ${CARD_SELECT}

      WHERE c.id = $1

      AND c.opportunity_id = $2
      `,
      [
        cardId,
        opportunityId,
      ]
    );

    if (!result.rows.length) {
      fail(404, 'ID card not found');
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
// ADMIN: ISSUE SINGLE OR BULK ID CARDS
// ========================================

export const issueVolunteerIdCards = async (
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

    if (body.photos_verified !== true) {
      fail(
        400,
        'Confirm that volunteer photographs have been verified'
      );
    }

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

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      await lockOpportunity(
        client,
        opportunityId
      );

      const issued: any[] = [];

      for (const memberId of memberIds) {
        const member = await getEligibleMember(
          client,
          opportunityId,
          memberId
        );

        const existing = await client.query(
          `
          SELECT id

          FROM volunteer_id_cards

          WHERE member_id = $1

          FOR UPDATE
          `,
          [memberId]
        );

        if (existing.rows.length) {
          fail(
            409,
            `${member.full_name} already has an ID card`
          );
        }

        const cardNumber =
          generateCardNumber();

        const result = await client.query(
          `
          INSERT INTO volunteer_id_cards (
            opportunity_id,
            member_id,
            card_number,
            photo_url,
            valid_from,
            valid_until,
            status,
            issued_by,
            issued_at
          )

          VALUES (
            $1,$2,$3,$4,$5,$6,
            'active',$7,NOW()
          )

          RETURNING id
          `,
          [
            opportunityId,
            memberId,
            cardNumber,
            member.photo_url,
            member.valid_from,
            member.valid_until,
            adminId,
          ]
        );

        const card = await client.query(
          `
          ${CARD_SELECT}

          WHERE c.id = $1
          `,
          [result.rows[0].id]
        );

        issued.push(card.rows[0]);
      }

            // ========================================
      // QUEUE ID CARD ISSUANCE NOTIFICATIONS
      // ========================================

      const notificationSummary =
        await queueVolunteerPersonalIdCardEvents(

          issued.map(
            item => Number(item.id)
          ),

          client
        );

      if (!notificationSummary.eligible) {

        throw new Error(
          'Volunteer ID card issuance notifications are not eligible'
        );
      }

      // ========================================
      // COMMIT CARDS AND NOTIFICATION JOBS
      // ========================================

      await client.query('COMMIT');

      return res.status(201).json({
        success: true,

        message:
          `${issued.length} volunteer ID card(s) issued successfully`,

        data: issued,
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
// ADMIN: REVOKE ID CARD
// ========================================

export const revokeVolunteerIdCard = async (
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

    const cardId = String(
      req.params.cardId
    );

    if (
      !validId(opportunityId) ||
      !validId(cardId)
    ) {
      fail(400, 'Invalid ID');
    }

    const reason =
      req.body?.revocation_reason;

    if (
      typeof reason !== 'string' ||
      !reason.trim() ||
      reason.trim().length > 2000
    ) {
      fail(
        400,
        'Valid revocation reason is required'
      );
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      await lockOpportunity(
        client,
        opportunityId
      );

      const existing = await client.query(
        `
        SELECT id, status

        FROM volunteer_id_cards

        WHERE id = $1

        AND opportunity_id = $2

        FOR UPDATE
        `,
        [
          cardId,
          opportunityId,
        ]
      );

      if (!existing.rows.length) {
        fail(404, 'ID card not found');
      }

      if (
        existing.rows[0].status === 'revoked'
      ) {
        fail(
          409,
          'ID card has already been revoked'
        );
      }

      await client.query(
        `
        UPDATE volunteer_id_cards

        SET
          status = 'revoked',

          revoked_by = $1,

          revoked_at = NOW(),

          revocation_reason = $2,

          updated_at = NOW()

        WHERE id = $3

        AND opportunity_id = $4
        `,
        [
          adminId,
          reason.trim(),
          cardId,
          opportunityId,
        ]
      );

      const result = await client.query(
        `
        ${CARD_SELECT}

        WHERE c.id = $1
        `,
        [cardId]
      );

           // ========================================
// QUEUE ID CARD REVOCATION NOTIFICATIONS
// ========================================

const notificationSummary =
  await queueVolunteerPersonalMemberEvent(
    Number(result.rows[0].id),
    'id_card_revoked',
    client
  );

if (!notificationSummary.eligible) {
  throw new Error(
    'Volunteer ID card revocation notification is not eligible'
  );
}

// ========================================
// COMMIT REVOCATION AND NOTIFICATION JOBS
// ========================================

await client.query('COMMIT');

      return res.json({
        success: true,
        message: 'Volunteer ID card revoked',
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
// ADMIN: REFRESH OR REACTIVATE ID CARD
// ========================================

export const refreshVolunteerIdCard = async (
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

    const cardId = String(
      req.params.cardId
    );

    if (
      !validId(opportunityId) ||
      !validId(cardId)
    ) {
      fail(400, 'Invalid ID');
    }

    if (req.body?.photo_verified !== true) {
      fail(
        400,
        'Confirm that the volunteer photograph has been verified'
      );
    }

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

        FROM volunteer_id_cards

        WHERE id = $1

        AND opportunity_id = $2

        FOR UPDATE
        `,
        [
          cardId,
          opportunityId,
        ]
      );

      if (!existing.rows.length) {
        fail(404, 'ID card not found');
      }

      const currentCard =
        existing.rows[0];

      if (
        currentCard.status === 'revoked' &&
        req.body?.confirm_reactivation !== true
      ) {
        fail(
          409,
          'Explicit confirmation is required to reactivate a revoked ID card'
        );
      }

      const member = await getEligibleMember(
        client,
        opportunityId,
        currentCard.member_id
      );

      await client.query(
        `
        UPDATE volunteer_id_cards

        SET
          photo_url = $1,

          valid_from = $2,

          valid_until = $3,

          status = 'active',

          issued_by = $4,

          issued_at = NOW(),

          revoked_by = NULL,

          revoked_at = NULL,

          revocation_reason = NULL,

          updated_at = NOW()

        WHERE id = $5

        AND opportunity_id = $6
        `,
        [
          member.photo_url,

          member.valid_from,

          member.valid_until,

          adminId,

          cardId,

          opportunityId,
        ]
      );

      const result = await client.query(
        `
        ${CARD_SELECT}

        WHERE c.id = $1
        `,
        [cardId]
      );

      await client.query('COMMIT');

      return res.json({
        success: true,

        message:
          'Volunteer ID card updated successfully',

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
// DEVOTEE: GET OWN VOLUNTEER ID CARDS
// ========================================

export const getMyVolunteerIdCards = async (
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

    const result = await pool.query(
      `
      WITH cards AS (

        ${CARD_SELECT}

        WHERE (
          r.user_id = $1

          OR m.user_id = $1
        )

        AND r.status IN (
          'approved',
          'assigned',
          'in_progress',
          'completed'
        )
      )

      SELECT
        id,
        opportunity_id,
        member_id,
        card_number,
        photo_url,
        full_name,
        member_code,
        registration_id,
        registration_code,
        registration_type,
        group_name,
        is_team_leader,
        programme_name,
        valid_from,
        valid_until,
        effective_status AS status,
        authorized_service_dates,
        issued_at

      FROM cards

      ORDER BY
        valid_from DESC,
        full_name ASC
      `,
      [userId]
    );

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    return handleError(res, error);
  }
};