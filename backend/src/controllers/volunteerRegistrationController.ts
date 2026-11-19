import { Response } from 'express';
import { randomUUID } from 'node:crypto';
import { pool } from '../db';
import { AuthRequest } from '../middleware/authMiddleware';
import {
  queueVolunteerPersonalRegistrationEvent,
} from '../services/volunteerPersonalRegistrationEventService';
// ========================================
// HELPERS
// ========================================

class RegistrationError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

function fail(status: number, message: string): never {
  throw new RegistrationError(status, message);
}

const validId = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isSafeInteger(value) &&
  value > 0 &&
  value <= 2147483647;

const validDate = (value: unknown): value is string => {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
};

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

const requiredText = (
  value: unknown,
  name: string,
  maxLength: number
): string => {
  const text = optionalText(value, maxLength);

  if (!text) {
    fail(400, `${name} is required`);
  }

  return text;
};

const generateCode = (prefix: string) =>
  `${prefix}-${randomUUID()
    .replace(/-/g, '')
    .toUpperCase()}`;

const handleError = (
  res: Response,
  error: unknown
) => {
  if (error instanceof RegistrationError) {
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
      message:
        'Duplicate registration or member information',
    });
  }

  console.error(
    'Volunteer registration error:',
    error
  );

  return res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
};

// ========================================
// MEMBER VALIDATION
// ========================================

function normalizeMember(member: any) {
  if (
    !member ||
    typeof member !== 'object' ||
    Array.isArray(member)
  ) {
    fail(400, 'Invalid member information');
  }

  const fullName = requiredText(
    member.full_name,
    'Full name',
    255
  );

  const mobile = requiredText(
    member.mobile,
    'Mobile number',
    20
  ).replace(/[\s-]/g, '');

  if (!/^\+?[0-9]{10,15}$/.test(mobile)) {
    fail(400, 'Invalid mobile number');
  }

  const email = optionalText(member.email, 255);

  if (
    email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    fail(400, `Invalid email for ${fullName}`);
  }

  if (!validDate(member.date_of_birth)) {
    fail(
      400,
      `Valid date of birth is required for ${fullName}`
    );
  }

  const today = new Intl.DateTimeFormat(
    'en-CA',
    {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }
  ).formatToParts(new Date());

  const todayString = [
    today.find(p => p.type === 'year')!.value,
    today.find(p => p.type === 'month')!.value,
    today.find(p => p.type === 'day')!.value,
  ].join('-');

  if (member.date_of_birth > todayString) {
    fail(400, 'Date of birth cannot be in the future');
  }

  const gender = requiredText(
    member.gender,
    'Gender',
    30
  ).toLowerCase();

  if (
    !['male', 'female', 'other'].includes(gender)
  ) {
    fail(400, 'Invalid gender');
  }

  const country =
    optionalText(member.country, 100) ?? 'India';

  const pincode = requiredText(
    member.pincode,
    'Pincode',
    20
  );

  if (
    country.toLowerCase() === 'india' &&
    !/^[1-9]\d{5}$/.test(pincode)
  ) {
    fail(400, 'Invalid Indian pincode');
  }

  if (
    member.is_team_leader !== undefined &&
    typeof member.is_team_leader !== 'boolean'
  ) {
    fail(400, 'Invalid team leader value');
  }

  if (
    !Array.isArray(member.shift_ids) ||
    member.shift_ids.length === 0 ||
    member.shift_ids.length > 500 ||
    !member.shift_ids.every(validId)
  ) {
    fail(
      400,
      `Select valid service shifts for ${fullName}`
    );
  }

  const shiftIds = [
    ...new Set<number>(member.shift_ids),
  ];

  return {
    full_name: fullName,
    mobile,
    email,
    date_of_birth: member.date_of_birth,
    gender,

    country,
    pincode,

    state: requiredText(
      member.state,
      'State',
      100
    ),

    district: requiredText(
      member.district,
      'District',
      100
    ),

    mandal: optionalText(member.mandal, 100),
    city: optionalText(member.city, 100),
    street: optionalText(member.street),
    door_number: optionalText(
      member.door_number,
      100
    ),

    qualification: optionalText(
      member.qualification,
      150
    ),

    profession: optionalText(
      member.profession,
      150
    ),

    area_of_interest: optionalText(
      member.area_of_interest
    ),

    is_team_leader:
      member.is_team_leader === true,

    shift_ids: shiftIds,
  };
}

// ========================================
// DEVOTEE: SUBMIT REGISTRATION
// ========================================

export const createVolunteerRegistration = async (
  req: AuthRequest,
  res: Response
) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Please login to register',
    });
  }

  const userId = req.user.userId;

  const body = req.body ?? {};
  const opportunityId = body.opportunity_id;
  const registrationType = body.registration_type;

  try {
    if (!validId(opportunityId)) {
      fail(400, 'Invalid opportunity ID');
    }

    if (
      !['individual', 'group'].includes(
        registrationType
      )
    ) {
      fail(400, 'Invalid registration type');
    }

    if (
      !Array.isArray(body.members) ||
      body.members.length === 0 ||
      body.members.length > 500
    ) {
      fail(400, 'Invalid volunteer members');
    }

    const members = body.members.map(
      normalizeMember
    ) as ReturnType<typeof normalizeMember>[];

    const totalMembers = members.length;

    if (
      registrationType === 'individual' &&
      totalMembers !== 1
    ) {
      fail(
        400,
        'Individual registration requires one member'
      );
    }

    if (
      registrationType === 'group' &&
      members.filter(m => m.is_team_leader)
        .length !== 1
    ) {
      fail(
        400,
        'Select exactly one group leader'
      );
    }

    const groupName =
      registrationType === 'group'
        ? optionalText(body.group_name, 255)
        : null;

    const remarks = optionalText(
      body.devotee_remarks
    );

    const identities = members.map(
      m =>
        `${m.full_name.toLowerCase()}|` +
        `${m.mobile}|${m.date_of_birth}`
    );

    if (
      new Set(identities).size !== identities.length
    ) {
      fail(
        400,
        'Duplicate member profiles are not allowed'
      );
    }

    const allShiftIds = [
      ...new Set(
        members.flatMap(m => m.shift_ids)
      ),
    ];

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Lock the opportunity to coordinate registration
      // with admin opening, closing and shift changes.

      const opportunityResult = await client.query(
        `
        SELECT *
        FROM volunteer_opportunities
        WHERE id = $1
        FOR UPDATE
        `,
        [opportunityId]
      );

      if (!opportunityResult.rows.length) {
        fail(404, 'Volunteer opportunity not found');
      }

      const opportunity =
        opportunityResult.rows[0];

      const statusResult = await client.query(
        `
        SELECT (
          is_published = TRUE
          AND registration_enabled = TRUE
          AND clock_timestamp() >= registration_start_at
          AND clock_timestamp() < registration_end_at
          AND service_end_date >=
            (clock_timestamp()
              AT TIME ZONE 'Asia/Kolkata')::date
        ) AS is_open

        FROM volunteer_opportunities
        WHERE id = $1
        `,
        [opportunityId]
      );

      if (!statusResult.rows[0].is_open) {
        fail(
          409,
          'Volunteer seva registration is closed'
        );
      }

      if (
        registrationType === 'individual' &&
        !opportunity.allow_individual
      ) {
        fail(
          400,
          'Individual registration is not enabled'
        );
      }

      if (
        registrationType === 'group' &&
        !opportunity.allow_group
      ) {
        fail(
          400,
          'Group registration is not enabled'
        );
      }

      if (
        registrationType === 'group' &&
        (
          totalMembers <
            opportunity.minimum_group_size ||
          totalMembers >
            opportunity.maximum_group_size
        )
      ) {
        fail(
          400,
          `Group size must be between ` +
          `${opportunity.minimum_group_size} and ` +
          `${opportunity.maximum_group_size}`
        );
      }

      // Prevent duplicate active registrations.

      const duplicate = await client.query(
        `
        SELECT id
        FROM volunteer_registrations
        WHERE opportunity_id = $1
        AND user_id = $2
        AND status NOT IN (
          'rejected', 'cancelled'
        )
        LIMIT 1
        `,
        [opportunityId, userId]
      );

      if (duplicate.rows.length) {
        fail(
          409,
          'You already registered for this opportunity'
        );
      }

      // Verify every selected shift.

      const shiftResult = await client.query(
        `
        SELECT
          s.id,
          s.service_date::text AS service_date,
          s.start_time,
          s.end_time

        FROM volunteer_shifts s

        JOIN volunteer_opportunities o
          ON o.id = s.opportunity_id

        WHERE s.opportunity_id = $1
        AND s.id = ANY($2::integer[])
        AND s.is_active = TRUE

        AND s.service_date BETWEEN
          o.service_start_date AND o.service_end_date

        AND (
          (s.service_date + s.start_time)
          AT TIME ZONE 'Asia/Kolkata'
        ) > clock_timestamp()
        `,
        [opportunityId, allShiftIds]
      );

      if (
        shiftResult.rows.length !==
        allShiftIds.length
      ) {
        fail(
          409,
          'One or more selected shifts are no longer available'
        );
      }

      // Create main registration.

      const registrationResult = await client.query(
        `
        INSERT INTO volunteer_registrations (
          registration_code,
          opportunity_id,
          user_id,
          registration_type,
          group_name,
          total_members,
          status,
          devotee_remarks
        )

        VALUES (
          $1,$2,$3,$4,$5,$6,'pending',$7
        )

        RETURNING *
        `,
        [
          generateCode('SR'),
          opportunityId,
          userId,
          registrationType,
          groupName,
          totalMembers,
          remarks,
        ]
      );

      const registration =
        registrationResult.rows[0];

      const createdMembers: any[] = [];

      // Individual registrations have one member.
      // Group registrations have multiple members.

      for (const member of members) {
        const isLeader =
          registrationType === 'group' &&
          member.is_team_leader;

        const linkedUserId =
          registrationType === 'individual' ||
          isLeader
            ? userId
            : null;

        const memberResult = await client.query(
          `
          INSERT INTO volunteer_members (
            registration_id,
            opportunity_id,
            user_id,
            member_code,
            full_name,
            mobile,
            email,
            date_of_birth,
            gender,
            country,
            pincode,
            state,
            district,
            mandal,
            city,
            street,
            door_number,
            qualification,
            profession,
            area_of_interest,
            is_team_leader,
            status
          )

          VALUES (
            $1,$2,$3,$4,$5,$6,$7,
            $8,$9,$10,$11,$12,$13,
            $14,$15,$16,$17,$18,$19,
            $20,$21,'pending'
          )

          RETURNING
            id,
            member_code,
            full_name,
            is_team_leader,
            status
          `,
          [
            registration.id,
            opportunityId,
            linkedUserId,
            generateCode('VOL'),
            member.full_name,
            member.mobile,
            member.email,
            member.date_of_birth,
            member.gender,
            member.country,
            member.pincode,
            member.state,
            member.district,
            member.mandal,
            member.city,
            member.street,
            member.door_number,
            member.qualification,
            member.profession,
            member.area_of_interest,
            isLeader,
          ]
        );

        const createdMember =
          memberResult.rows[0];

        // Save each member's selected availability.

        await client.query(
          `
          INSERT INTO volunteer_availability (
            opportunity_id,
            member_id,
            shift_id
          )

          SELECT
            $1::integer,
            $2::integer,
            shift_id

          FROM unnest(
            $3::integer[]
          ) AS selected(shift_id)
          `,
          [
            opportunityId,
            createdMember.id,
            member.shift_ids,
          ]
        );

        createdMembers.push({
          ...createdMember,
          shift_ids: member.shift_ids,
        });
      }

      // Recheck time before committing.

      const finalCheck = await client.query(
        `
        SELECT (
          clock_timestamp() < registration_end_at
        ) AS is_open
        FROM volunteer_opportunities
        WHERE id = $1
        `,
        [opportunityId]
      );

      if (!finalCheck.rows[0].is_open) {
        fail(
          409,
          'Registration deadline has passed'
        );
      }

      // ========================================
// QUEUE REGISTRATION SUBMISSION NOTIFICATION
// ========================================

await queueVolunteerPersonalRegistrationEvent(

  Number(registration.id),

  'registration_submitted',

  client
);

// ========================================
// RECHECK REGISTRATION DEADLINE
// ========================================

const commitCheck = await client.query(
  `
  SELECT (

    clock_timestamp() < registration_end_at

  ) AS is_open

  FROM volunteer_opportunities

  WHERE id = $1
  `,
  [
    opportunityId,
  ]
);

if (!commitCheck.rows[0]?.is_open) {

  fail(
    409,
    'Registration deadline has passed'
  );
}

// ========================================
// COMMIT REGISTRATION AND NOTIFICATION
// ========================================

await client.query('COMMIT');
      return res.status(201).json({
        success: true,
        message:
          'Volunteer seva registration submitted successfully',

        data: {
          id: registration.id,

          registration_code:
            registration.registration_code,

          opportunity_id: opportunityId,

          opportunity_title:
            opportunity.title,

          registration_type:
            registrationType,

          group_name: groupName,

          total_members: totalMembers,

          status: 'pending',

          created_at: registration.created_at,

          members: createdMembers,
        },
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
// DEVOTEE: GET MY REGISTRATIONS
// ========================================

export const getMyVolunteerRegistrations = async (
  req: AuthRequest,
  res: Response
) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }

  try {
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
        o.image_url,

        o.service_start_date::text
          AS service_start_date,

        o.service_end_date::text
          AS service_end_date,

        (
          SELECT COUNT(*)::integer
          FROM volunteer_assignments a

          JOIN volunteer_members m
            ON m.id = a.member_id

          WHERE m.registration_id = r.id
          AND a.status NOT IN (
            'cancelled',
            'reassigned'
          )
        ) AS total_assignments

      FROM volunteer_registrations r

      JOIN volunteer_opportunities o
        ON o.id = r.opportunity_id

      WHERE r.user_id = $1

      ORDER BY r.created_at DESC, r.id DESC
      `,
      [req.user.userId]
    );

    res.set('Cache-Control', 'private, no-store');

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    return handleError(res, error);
  }
};