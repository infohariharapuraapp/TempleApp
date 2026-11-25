import {
  normalizeServiceDates,
  saveMemberServiceDates,
  VolunteerServiceDateError,
} from '../services/volunteerServiceDateService';
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

  console.error('Volunteer registration error:');

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

  const photoUploadId = member.photo_upload_id;
  if (
    photoUploadId !== undefined &&
    (
      typeof photoUploadId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(photoUploadId)
    )
  ) {
    fail(400, `Invalid photograph reference for ${fullName}`);
  }
  let serviceDates: string[] = [];
  let shiftIds: number[] = [];
  if (member.service_dates !== undefined) {
    try {
      serviceDates = normalizeServiceDates(
        member.service_dates
      );
    } catch (error) {
      if (error instanceof VolunteerServiceDateError) {
        fail(400, `${fullName}: ${error.message}`);
      }
      throw error;
    }
    if (
      member.shift_ids !== undefined &&
      (
        !Array.isArray(member.shift_ids) ||
        member.shift_ids.length > 0
      )
    ) {
      fail(400, 'Select dates or shifts, not both');
    }
  } else {
    if (
      !Array.isArray(member.shift_ids) ||
      member.shift_ids.length === 0 ||
      member.shift_ids.length > 500 ||
      !member.shift_ids.every(validId)
    ) {
      fail(
        400,
        `Select valid service dates for ${fullName}`
      );
    }
    shiftIds = [
      ...new Set<number>(member.shift_ids),
    ];
  }

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

    photo_upload_id:
      typeof photoUploadId === 'string'
        ? photoUploadId.toLowerCase()
        : null,
    shift_ids: shiftIds,
    service_dates: serviceDates,
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
    const requirePhotos =
      process.env.VOLUNTEER_PHOTO_REQUIRED === 'true' ||
      body.photo_required === true ||
      members.some(member => member.photo_upload_id !== null);
    if (requirePhotos) {
      const missingPhoto = members.find(
        member => !member.photo_upload_id
      );
      if (missingPhoto) {
        fail(
          400,
          `Photograph is required for ${missingPhoto.full_name}`
        );
      }
    }
    const photoUploadIds = members
      .map(member => member.photo_upload_id)
      .filter(id => id !== null);
    if (
      new Set(photoUploadIds).size !==
      photoUploadIds.length
    ) {
      fail(
        400,
        'Each volunteer must upload a separate photograph'
      );
    }
    const usesServiceDates = members.some(
      member => member.service_dates.length > 0
    );
    if (
      usesServiceDates &&
      members.some(
        member => member.service_dates.length === 0
      )
    ) {
      fail(400, 'All members must select service dates');
    }

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
    let discardClient = false;

    try {
      await client.query('BEGIN');
      await client.query(
        "SET LOCAL lock_timeout = '5s'"
      );
      await client.query(
        "SET LOCAL statement_timeout = '15s'"
      );

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
      // Enforce the registration method configured for
      // this opportunity while holding its database lock.
      const attendanceMode = opportunity.attendance_mode;
      if (
        !['legacy', 'simple', 'detailed', 'none']
          .includes(attendanceMode)
      ) {
        fail(409, 'Invalid programme attendance configuration');
      }
      if (attendanceMode === 'legacy' && usesServiceDates) {
        fail(
          409,
          'This programme requires service shift selection'
        );
      }
      if (attendanceMode !== 'legacy' && !usesServiceDates) {
        fail(
          409,
          'This programme requires service date selection. Please update the app if necessary.'
        );
      }

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

      // ========================================
      // SIMPLE ATTENDANCE: PER-DATE CAPACITY
      // ========================================
      if (attendanceMode === 'simple') {
        const capacity = Number(opportunity.required_volunteers);
        if (
          !Number.isSafeInteger(capacity) ||
          capacity <= 0
        ) {
          fail(409, 'Programme volunteer capacity is invalid');
        }
        const requestedDates = [
          ...new Set(
            members.flatMap(member => member.service_dates)
          ),
        ].sort();
        const requestedCounts = new Map<string, number>();
        for (const member of members) {
          for (const serviceDate of member.service_dates) {
            requestedCounts.set(
              serviceDate,
              (requestedCounts.get(serviceDate) || 0) + 1
            );
          }
        }
        if (requestedDates.length > 0) {
          const occupiedResult = await client.query(
            `
            SELECT
              vsd.service_date::text AS service_date,
              COUNT(DISTINCT m.id)::integer AS registered
            FROM volunteer_service_dates vsd
            JOIN volunteer_members m
              ON m.id = vsd.member_id
              AND m.opportunity_id = vsd.opportunity_id
            JOIN volunteer_registrations r
              ON r.id = m.registration_id
              AND r.opportunity_id = m.opportunity_id
            WHERE vsd.opportunity_id = $1
              AND vsd.service_date = ANY($2::date[])
              AND r.status NOT IN ('rejected', 'cancelled')
            GROUP BY vsd.service_date
            `,
            [opportunityId, requestedDates]
          );
          const occupiedCounts = new Map<string, number>();
          for (const row of occupiedResult.rows) {
            occupiedCounts.set(
              String(row.service_date).slice(0, 10),
              Number(row.registered)
            );
          }
          for (const serviceDate of requestedDates) {
            const registered = occupiedCounts.get(serviceDate) || 0;
            const requested = requestedCounts.get(serviceDate) || 0;
            if (registered + requested > capacity) {
              const remaining = Math.max(0, capacity - registered);
              fail(
                409,
                `Service date ${serviceDate} has only ${remaining} slots remaining. Please select another date.`
              );
            }
          }
        }
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
        let photoUrl: string | null = null;
        if (member.photo_upload_id) {
          const photoResult = await client.query(
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
              member.photo_upload_id,
              userId,
              opportunityId,
            ]
          );
          if (photoResult.rows.length !== 1) {
            fail(
              409,
              `Photograph for ${member.full_name} is expired or unavailable. Please upload it again.`
            );
          }
          photoUrl = photoResult.rows[0].photo_url;
        }
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
            status,
            photo_url,
            photo_status,
            photo_uploaded_at,
            photo_revision
          )
          VALUES (
            $1,$2,$3,$4,$5,$6,$7,
            $8,$9,$10,$11,$12,$13,
            $14,$15,$16,$17,$18,$19,
            $20,$21,'pending',
            $22::text,
            CASE
              WHEN $22::text IS NULL THEN 'missing'
              ELSE 'pending'
            END,
            CASE
              WHEN $22::text IS NULL THEN NULL
              ELSE NOW()
            END,
            CASE
              WHEN $22::text IS NULL THEN 0
              ELSE 1
            END
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
            photoUrl,
          ]
        );

        const createdMember =
          memberResult.rows[0];

        // Save selected volunteer availability.
        let savedServiceDates: string[] = [];
        if (member.service_dates.length > 0) {
          try {
            savedServiceDates =
              await saveMemberServiceDates(
                client,
                opportunityId,
                createdMember.id,
                member.service_dates
              );
          } catch (error) {
            if (error instanceof VolunteerServiceDateError) {
              fail(400, error.message);
            }
            throw error;
          }
        } else {
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
            FROM UNNEST(
              $3::integer[]
            ) AS selected(shift_id)
            `,
            [
              opportunityId,
              createdMember.id,
              member.shift_ids,
            ]
          );
        }
        createdMembers.push({
          ...createdMember,
          photo_status: photoUrl ? 'pending' : 'missing',
          photo_revision: photoUrl ? 1 : 0,
          shift_ids: member.shift_ids,
          service_dates: savedServiceDates,
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
      try {
        await client.query('ROLLBACK');
      } catch {
        discardClient = true;
        console.error('Volunteer transaction rollback failed');
      }

      throw error;
    } finally {
      client.release(discardClient);
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
        o.attendance_mode,
        o.accommodation_enabled,
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