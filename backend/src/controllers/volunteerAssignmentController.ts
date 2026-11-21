import { Request, Response } from 'express';
import { pool } from '../db';
import { AuthRequest } from '../middleware/authMiddleware';



import {
  queueVolunteerPersonalDutyEvent,
  queueVolunteerPersonalDutyEvents,
} from '../services/volunteerPersonalDutyEventService';


// ========================================
// HELPERS
// ========================================

class AssignmentError extends Error {
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
  throw new AssignmentError(status, message);
}

const validId = (value: string) =>
  /^[1-9]\d*$/.test(value) &&
  Number(value) <= 2147483647;

const validNumberId = (value: unknown): value is number =>
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

const handleError = (
  res: Response,
  error: unknown
) => {
  if (error instanceof AssignmentError) {
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
      message: 'Volunteer already has an assignment for this shift',
    });
  }

  console.error(
    'Volunteer assignment error:',
    error
  );

  return res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
};

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
    fail(404, 'Volunteer opportunity not found');
  }
}

// ========================================
// GET AND VALIDATE REQUIREMENT
// ========================================

async function getRequirement(
  client: any,
  opportunityId: string,
  requirementId: number
) {
  const result = await client.query(
    `
    SELECT
      r.*,

      d.name AS duty_name,
      d.is_active AS duty_is_active,
      s.is_active AS shift_is_active,

      s.service_date::text AS service_date,
      s.start_time,
      s.end_time,

      COALESCE(
        r.reporting_location,
        d.reporting_location
      ) AS effective_reporting_location,

      COALESCE(
        r.coordinator_name,
        d.coordinator_name
      ) AS effective_coordinator_name,

      COALESCE(
        r.coordinator_phone,
        d.coordinator_phone
      ) AS effective_coordinator_phone,

      COALESCE(
        r.instructions,
        d.general_instructions
      ) AS effective_instructions,

      (
        (s.service_date + s.start_time)
        AT TIME ZONE 'Asia/Kolkata'
      ) > clock_timestamp() AS is_future

    FROM volunteer_requirements r

    JOIN volunteer_duties d
      ON d.id = r.duty_id

    JOIN volunteer_shifts s
      ON s.id = r.shift_id

    WHERE r.id = $1
    AND r.opportunity_id = $2

    FOR UPDATE OF r, d, s
    `,
    [
      requirementId,
      opportunityId,
    ]
  );

  if (!result.rows.length) {
    fail(404, 'Duty requirement not found');
  }

  const requirement = result.rows[0];

  if (
    !requirement.is_active ||
    !requirement.duty_is_active ||
    !requirement.shift_is_active
  ) {
    fail(
      409,
      'Requirement, duty or shift is disabled'
    );
  }

  if (!requirement.is_future) {
    fail(
      409,
      'Cannot allocate duties after the shift starts'
    );
  }

  return requirement;
}

// ========================================
// CHECK REQUIREMENT CAPACITY
// ========================================

async function checkCapacity(
  client: any,
  requirement: any,
  requestedCount: number
) {
  const result = await client.query(
    `
    SELECT COUNT(*)::integer AS total

    FROM volunteer_assignments

    WHERE requirement_id = $1

    AND status NOT IN (
      'cancelled',
      'reassigned'
    )
    `,
    [requirement.id]
  );

  const assigned = result.rows[0].total;

  const remaining = Math.max(
    requirement.required_count - assigned,
    0
  );

  if (requestedCount > remaining) {
    fail(
      409,
      `Only ${remaining} volunteer position(s) remaining`
    );
  }
}

// ========================================
// VALIDATE VOLUNTEER ELIGIBILITY
// ========================================

async function validateMember(
  client: any,
  opportunityId: string,
  memberId: number,
  requirement: any
) {
  const result = await client.query(
    `
    SELECT
      m.id,
      m.full_name,
      m.status,
      m.registration_id,

      r.status AS registration_status

    FROM volunteer_members m

    JOIN volunteer_registrations r
      ON r.id = m.registration_id

    WHERE m.id = $1
    AND m.opportunity_id = $2

    FOR UPDATE OF r, m
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
      `${member.full_name} is not eligible for duty allocation`
    );
  }

  // CLOSED SERVICE DATE VALIDATION
  // Prevent assignment or reassignment after withdrawal.
  const serviceDateCheck = await client.query(
    `
    SELECT id, status
    FROM volunteer_service_dates
    WHERE member_id = $1
      AND opportunity_id = $2
      AND service_date = $3::date
    FOR UPDATE
    `,
    [
      memberId,
      opportunityId,
      requirement.service_date,
    ]
  );
  if (
    !serviceDateCheck.rows.length ||
    serviceDateCheck.rows[0].status !== 'active'
  ) {
    fail(
      409,
      'Volunteer is not available for this service date'
    );
  }  // Verify selected availability.

  const availability = await client.query(
    `
    SELECT id

    FROM volunteer_availability

    WHERE member_id = $1
    AND shift_id = $2
    `,
    [
      memberId,
      requirement.shift_id,
    ]
  );

  if (!availability.rows.length) {
    fail(
      409,
      `${member.full_name} is not available for this shift`
    );
  }

  // Detect overlapping assignments.

  const overlap = await client.query(
    `
    SELECT a.id

    FROM volunteer_assignments a

    JOIN volunteer_shifts s
      ON s.id = a.shift_id

    WHERE a.member_id = $1

    AND a.status NOT IN (
      'cancelled',
      'reassigned'
    )

    AND s.service_date = $2::date

    AND s.start_time < $4::time

    AND s.end_time > $3::time

    LIMIT 1
    `,
    [
      memberId,
      requirement.service_date,
      requirement.start_time,
      requirement.end_time,
    ]
  );

  if (overlap.rows.length) {
    fail(
      409,
      `${member.full_name} already has an overlapping duty assignment`
    );
  }

  return member;
}

// ========================================
// CREATE ASSIGNMENT RECORD
// ========================================

async function insertAssignment(
  client: any,
  opportunityId: string,
  memberId: number,
  requirement: any,
  adminId: number,
  specialInstructions: string | null
) {
  const result = await client.query(
    `
    INSERT INTO volunteer_assignments (
      opportunity_id,
      member_id,
      requirement_id,
      shift_id,

      reporting_location,
      reporting_time,

      coordinator_name,
      coordinator_phone,

      special_instructions,

      status,
      assigned_by,
      assigned_at
    )

    VALUES (
      $1,$2,$3,$4,
      $5,$6,$7,$8,$9,
      'assigned',$10,NOW()
    )

    RETURNING *
    `,
    [
      opportunityId,
      memberId,
      requirement.id,
      requirement.shift_id,

      requirement.effective_reporting_location,

      requirement.reporting_time ??
        requirement.start_time,

      requirement.effective_coordinator_name,
      requirement.effective_coordinator_phone,

      specialInstructions ??
        requirement.effective_instructions,

      adminId,
    ]
  );

  return result.rows[0];
}

// ========================================
// REFRESH REGISTRATION STATUS
// ========================================

async function refreshRegistrationStatus(
  client: any,
  registrationId: number
) {
  await client.query(
    `
    UPDATE volunteer_registrations r

    SET
      status = CASE

        WHEN EXISTS (
          SELECT 1

          FROM volunteer_assignments a

          JOIN volunteer_members m
            ON m.id = a.member_id

          WHERE m.registration_id = r.id
          AND a.status = 'in_progress'

        ) THEN 'in_progress'

        WHEN EXISTS (
          SELECT 1

          FROM volunteer_assignments a

          JOIN volunteer_members m
            ON m.id = a.member_id

          WHERE m.registration_id = r.id

          AND a.status IN (
            'assigned',
            'completed'
          )

        ) THEN 'assigned'

        ELSE 'approved'

      END,

      updated_at = NOW()

    WHERE r.id = $1

    AND r.status IN (
      'approved',
      'assigned',
      'in_progress'
    )
    `,
    [registrationId]
  );
}

// ========================================
// ADMIN: GET ELIGIBLE VOLUNTEERS
// ========================================

export const getEligibleVolunteers = async (
  req: Request,
  res: Response
) => {
  try {
    const opportunityId = String(
      req.params.opportunityId
    );

    const requirementId = String(
      req.params.requirementId
    );

    if (
      !validId(opportunityId) ||
      !validId(requirementId)
    ) {
      fail(400, 'Invalid ID');
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
        m.id,
        m.full_name,
        m.member_code,
        m.mobile,
        m.gender,
        m.profession,
        m.area_of_interest,
        m.is_team_leader,

        r.id AS registration_id,
        r.registration_code,
        r.registration_type,
        r.group_name,

        req.id AS requirement_id,

        (
          SELECT COUNT(*)::integer

          FROM volunteer_assignments a

          WHERE a.member_id = m.id

          AND a.status NOT IN (
            'cancelled',
            'reassigned'
          )
        ) AS total_assignments

      FROM volunteer_members m

      JOIN volunteer_registrations r
        ON r.id = m.registration_id

      JOIN volunteer_availability av
        ON av.member_id = m.id

      JOIN volunteer_requirements req
        ON req.shift_id = av.shift_id
        AND req.opportunity_id = m.opportunity_id

      JOIN volunteer_shifts target
        ON target.id = req.shift_id

      JOIN volunteer_duties d
        ON d.id = req.duty_id

      WHERE m.opportunity_id = $1
      AND req.id = $2

      AND m.status = 'approved'

      AND r.status IN (
        'approved',
        'assigned',
        'in_progress'
      )

      AND req.is_active = TRUE
      AND target.is_active = TRUE
      AND d.is_active = TRUE

      AND (
        (target.service_date + target.start_time)
        AT TIME ZONE 'Asia/Kolkata'
      ) > clock_timestamp()

      AND NOT EXISTS (
        SELECT 1

        FROM volunteer_assignments a

        JOIN volunteer_shifts s
          ON s.id = a.shift_id

        WHERE a.member_id = m.id

        AND a.status NOT IN (
          'cancelled',
          'reassigned'
        )

        AND s.service_date =
          target.service_date

        AND s.start_time <
          target.end_time

        AND s.end_time >
          target.start_time
      )

      AND (
        $3::text IS NULL
        OR m.full_name ILIKE $3
        OR m.mobile ILIKE $3
        OR m.member_code ILIKE $3
        OR r.group_name ILIKE $3
        OR r.registration_code ILIKE $3
      )

      ORDER BY
        total_assignments ASC,
        m.full_name ASC,
        m.id ASC
      `,
      [
        opportunityId,
        requirementId,

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
// ADMIN: GET ALL ASSIGNMENTS
// ========================================

export const getVolunteerAssignments = async (
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

    const requirementId =
      req.query.requirement_id;

    const memberId =
      req.query.member_id;

    const status =
      req.query.status;

    for (const id of [
      requirementId,
      memberId
    ]) {
      if (
        id !== undefined &&
        (
          typeof id !== 'string' ||
          !validId(id)
        )
      ) {
        fail(400, 'Invalid filter ID');
      }
    }

    if (
      status !== undefined &&
      (
        typeof status !== 'string' ||
        ![
          'assigned',
          'in_progress',
          'completed',
          'cancelled',
          'reassigned',
        ].includes(status)
      )
    ) {
      fail(400, 'Invalid assignment status');
    }

    const result = await pool.query(
      `
      SELECT
        a.*,

        m.full_name,
        m.member_code,
        m.mobile,
        m.gender,

        r.registration_code,
        r.registration_type,
        r.group_name,

        d.name AS duty_name,
        d.description AS duty_description,
        d.responsibilities,

        d.male_dress_code,
        d.female_dress_code,

        d.male_dress_image_url,
        d.female_dress_image_url,

        s.shift_name,
        s.service_date::text AS service_date,
        s.start_time,
        s.end_time,

        u.full_name AS assigned_by_name

      FROM volunteer_assignments a

      JOIN volunteer_members m
        ON m.id = a.member_id

      JOIN volunteer_registrations r
        ON r.id = m.registration_id

      JOIN volunteer_requirements req
        ON req.id = a.requirement_id

      JOIN volunteer_duties d
        ON d.id = req.duty_id

      JOIN volunteer_shifts s
        ON s.id = a.shift_id

      LEFT JOIN users u
        ON u.id = a.assigned_by

      WHERE a.opportunity_id = $1

      AND (
        $2::integer IS NULL
        OR a.requirement_id = $2
      )

      AND (
        $3::integer IS NULL
        OR a.member_id = $3
      )

      AND (
        $4::text IS NULL
        OR a.status = $4
      )

      ORDER BY
        s.service_date ASC,
        s.start_time ASC,
        d.name ASC,
        m.full_name ASC
      `,
      [
        opportunityId,
        requirementId ?? null,
        memberId ?? null,
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
// ADMIN: SINGLE OR BULK ALLOCATION
// ========================================

export const createVolunteerAssignments = async (
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

    const requirementId =
      body.requirement_id;

    if (!validNumberId(requirementId)) {
      fail(400, 'Valid requirement ID is required');
    }

    const memberIds = Array.isArray(
      body.member_ids
    )
      ? body.member_ids
      : [body.member_id];

    if (
      !memberIds.length ||
      memberIds.length > 500 ||
      !memberIds.every(validNumberId)
    ) {
      fail(
        400,
        'Provide between 1 and 500 valid volunteers'
      );
    }

    if (
      new Set(memberIds).size !== memberIds.length
    ) {
      fail(
        400,
        'Duplicate volunteer IDs are not allowed'
      );
    }

    const instructions = optionalText(
      body.special_instructions
    );

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      await lockOpportunity(
        client,
        opportunityId
      );

      const requirement = await getRequirement(
        client,
        opportunityId,
        requirementId
      );

      await checkCapacity(
        client,
        requirement,
        memberIds.length
      );

      const created: any[] = [];

      const registrationIds =
        new Set<number>();

      for (const memberId of memberIds) {
        const member = await validateMember(
          client,
          opportunityId,
          memberId,
          requirement
        );

        const assignment = await insertAssignment(
          client,
          opportunityId,
          memberId,
          requirement,
          adminId,
          instructions
        );

        registrationIds.add(
          member.registration_id
        );

        created.push({
          ...assignment,
          full_name: member.full_name,
          duty_name: requirement.duty_name,
        });
      }

      for (
        const registrationId of registrationIds
      ) {
        await refreshRegistrationStatus(
          client,
          registrationId
        );
      }

      // Ensure the shift has not started
      // while processing the bulk allocation.

      const finalCheck = await client.query(
        `
        SELECT (
          (service_date + start_time)
          AT TIME ZONE 'Asia/Kolkata'
        ) > clock_timestamp() AS is_future

        FROM volunteer_shifts

        WHERE id = $1
        `,
        [requirement.shift_id]
      );

      if (!finalCheck.rows[0].is_future) {
        fail(
          409,
          'The selected shift has already started'
        );
      }

    // ========================================
// QUEUE DUTY ASSIGNMENT NOTIFICATIONS
// ========================================

const notificationSummary =
  await queueVolunteerPersonalDutyEvents(

    created.map(
      item => Number(item.id)
    ),

    client

  );

if (!notificationSummary.eligible) {

  throw new Error(
    'Volunteer assignment notifications are not eligible'
  );
}

// ========================================
// FINAL SHIFT VALIDITY CHECK
// ========================================

// Ensure the shift has not started while
// creating the notification queue jobs.

const notificationFinalCheck =
  await client.query(
    `
    SELECT (

      (service_date + start_time)

      AT TIME ZONE 'Asia/Kolkata'

    ) > clock_timestamp() AS is_future

    FROM volunteer_shifts

    WHERE id = $1
    `,
    [
      requirement.shift_id,
    ]
  );

if (
  notificationFinalCheck.rows[0]?.is_future !== true
) {

  fail(
    409,
    'The selected shift has already started'
  );
}

// ========================================
// COMMIT ASSIGNMENTS AND NOTIFICATIONS
// ========================================

await client.query('COMMIT');

      return res.status(201).json({
        success: true,

        message:
          `${created.length} volunteer(s) assigned successfully`,

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
// ADMIN: CANCEL ASSIGNMENT
// ========================================

export const cancelVolunteerAssignment = async (
  req: AuthRequest,
  res: Response
) => {
  try {

    // ========================================
    // AUTHENTICATION
    // ========================================

    if (!req.user) {
      fail(401, 'Authentication required');
    }

    const opportunityId = String(
      req.params.opportunityId
    );

    const assignmentId = String(
      req.params.assignmentId
    );

    // ========================================
    // VALIDATE IDs
    // ========================================

    if (
      !validId(opportunityId) ||
      !validId(assignmentId)
    ) {
      fail(400, 'Invalid ID');
    }

    const reason = optionalText(
      req.body?.cancellation_reason
    );

    if (!reason) {
      fail(
        400,
        'Cancellation reason is required'
      );
    }

    const client = await pool.connect();

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
      // LOAD EXISTING ASSIGNMENT
      // ========================================

      const existing = await client.query(
        `
        SELECT

          a.*,

          m.registration_id,

          (
            (s.service_date + s.start_time)

            AT TIME ZONE 'Asia/Kolkata'

          ) > clock_timestamp() AS is_future

        FROM volunteer_assignments a

        JOIN volunteer_members m
          ON m.id = a.member_id

        JOIN volunteer_shifts s
          ON s.id = a.shift_id

        WHERE a.id = $1

        AND a.opportunity_id = $2

        FOR UPDATE OF a, m
        `,
        [
          assignmentId,
          opportunityId,
        ]
      );

      if (!existing.rows.length) {
        fail(404, 'Assignment not found');
      }

      const assignment = existing.rows[0];

      // ========================================
      // VALIDATE ASSIGNMENT STATUS
      // ========================================

      if (
        assignment.status !== 'assigned' ||
        !assignment.is_future
      ) {
        fail(
          409,
          'Only future assigned duties can be cancelled'
        );
      }

      // ========================================
      // VALIDATE ATTENDANCE
      // ========================================

      const attendance = await client.query(
        `
        SELECT id

        FROM volunteer_attendance

        WHERE assignment_id = $1

        LIMIT 1
        `,
        [assignmentId]
      );

      if (attendance.rows.length) {
        fail(
          409,
          'Assignment already has attendance records'
        );
      }

      // ========================================
      // CANCEL ASSIGNMENT
      // ========================================

      const result = await client.query(
        `
        UPDATE volunteer_assignments

        SET

          status = 'cancelled',

          cancellation_reason = $1,

          updated_at = NOW()

        WHERE id = $2

        RETURNING *
        `,
        [
          reason,
          assignmentId,
        ]
      );

      // ========================================
      // REFRESH REGISTRATION STATUS
      // ========================================

      await refreshRegistrationStatus(

        client,

        assignment.registration_id

      );

      // ========================================
      // QUEUE DUTY CANCELLATION NOTIFICATION
      // ========================================

      // Notify the volunteer and registration
      // owner through the persistent queue.
      //
      // Use the original cancelled assignment ID
      // and the same database transaction client.

      const notificationSummary =
        await queueVolunteerPersonalDutyEvent(

          Number(assignmentId),

          'duty_cancelled',

          client

        );

      if (!notificationSummary.eligible) {

        throw new Error(
          'Volunteer cancellation notification is not eligible'
        );
      }

      // ========================================
      // FINAL SHIFT VALIDITY CHECK
      // ========================================

      const notificationFinalCheck =
        await client.query(
          `
          SELECT (

            (service_date + start_time)

            AT TIME ZONE 'Asia/Kolkata'

          ) > clock_timestamp() AS is_future

          FROM volunteer_shifts

          WHERE id = $1
          `,
          [
            assignment.shift_id,
          ]
        );

      if (
        notificationFinalCheck.rows[0]?.is_future
          !== true
      ) {

        fail(
          409,
          'The selected shift has already started'
        );
      }

      // ========================================
      // COMMIT TRANSACTION
      // ========================================

      // Save cancellation and notification jobs
      // together in one atomic transaction.

      await client.query('COMMIT');

      // ========================================
      // SUCCESS RESPONSE
      // ========================================

      return res.json({

        success: true,

        message:
          'Duty assignment cancelled',

        data:
          result.rows[0],
      });

    } catch (error) {

      // ========================================
      // ROLLBACK TRANSACTION
      // ========================================

      await client.query('ROLLBACK')
        .catch(console.error);

      throw error;

    } finally {

      // ========================================
      // RELEASE DATABASE CONNECTION
      // ========================================

      client.release();
    }

  } catch (error) {

    return handleError(res, error);
  }
};

// ========================================
// ADMIN: REASSIGN VOLUNTEER DUTY
// ========================================

export const reassignVolunteerDuty = async (
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

    const assignmentId = String(
      req.params.assignmentId
    );

    if (
      !validId(opportunityId) ||
      !validId(assignmentId)
    ) {
      fail(400, 'Invalid ID');
    }

    const body = req.body ?? {};

    const newRequirementId =
      body.requirement_id;

    if (!validNumberId(newRequirementId)) {
      fail(
        400,
        'Valid new requirement ID is required'
      );
    }

    const reason = optionalText(body.reason);

    if (!reason) {
      fail(
        400,
        'Reassignment reason is required'
      );
    }

    const instructions = optionalText(
      body.special_instructions
    );

    const client = await pool.connect();

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
      // LOAD EXISTING ASSIGNMENT
      // ========================================

      const existing = await client.query(
        `
        SELECT
          a.*,
          m.registration_id,

          (
            (s.service_date + s.start_time)
            AT TIME ZONE 'Asia/Kolkata'
          ) > clock_timestamp() AS is_future

        FROM volunteer_assignments a

        JOIN volunteer_members m
          ON m.id = a.member_id

        JOIN volunteer_shifts s
          ON s.id = a.shift_id

        WHERE a.id = $1
        AND a.opportunity_id = $2

        FOR UPDATE OF a, m
        `,
        [
          assignmentId,
          opportunityId,
        ]
      );

      if (!existing.rows.length) {
        fail(404, 'Assignment not found');
      }

      const oldAssignment = existing.rows[0];

      // ========================================
      // VALIDATE EXISTING ASSIGNMENT
      // ========================================

      if (
        oldAssignment.status !== 'assigned' ||
        !oldAssignment.is_future
      ) {
        fail(
          409,
          'Only future assigned duties can be reassigned'
        );
      }

      if (
        oldAssignment.requirement_id ===
        newRequirementId
      ) {
        fail(
          400,
          'Select a different duty requirement'
        );
      }

      // ========================================
      // VALIDATE ATTENDANCE
      // ========================================

      const attendance = await client.query(
        `
        SELECT id

        FROM volunteer_attendance

        WHERE assignment_id = $1

        LIMIT 1
        `,
        [assignmentId]
      );

      if (attendance.rows.length) {
        fail(
          409,
          'Assignment already has attendance records'
        );
      }

      // ========================================
      // VALIDATE NEW DUTY REQUIREMENT
      // ========================================

      const requirement = await getRequirement(
        client,
        opportunityId,
        newRequirementId
      );

      await checkCapacity(
        client,
        requirement,
        1
      );

      // ========================================
      // PRESERVE ORIGINAL ASSIGNMENT HISTORY
      // ========================================

      await client.query(
        `
        UPDATE volunteer_assignments

        SET

          status = 'reassigned',

          cancellation_reason = $1,

          updated_at = NOW()

        WHERE id = $2
        `,
        [
          reason,
          assignmentId,
        ]
      );

      // ========================================
      // VALIDATE MEMBER FOR NEW REQUIREMENT
      // ========================================

      // The old assignment is excluded from
      // overlap checks inside this transaction.

      const member = await validateMember(
        client,
        opportunityId,
        oldAssignment.member_id,
        requirement
      );

      // ========================================
      // CREATE NEW ASSIGNMENT
      // ========================================

      const assignment = await insertAssignment(
        client,
        opportunityId,
        oldAssignment.member_id,
        requirement,
        adminId,
        instructions
      );

      // ========================================
      // VALIDATE NEW SHIFT START TIME
      // ========================================

      const finalCheck = await client.query(
        `
        SELECT (

          (service_date + start_time)

          AT TIME ZONE 'Asia/Kolkata'

        ) > clock_timestamp() AS is_future

        FROM volunteer_shifts

        WHERE id = $1
        `,
        [
          requirement.shift_id,
        ]
      );

      if (
        finalCheck.rows[0]?.is_future !== true
      ) {
        fail(
          409,
          'The new shift has already started'
        );
      }

      // ========================================
      // REFRESH REGISTRATION STATUS
      // ========================================

      await refreshRegistrationStatus(
        client,
        member.registration_id
      );

      // ========================================
      // QUEUE DUTY REASSIGNMENT NOTIFICATION
      // ========================================

      // Use the newly created assignment ID.
      // Queue insertion must use the same
      // database transaction client.

      const notificationSummary =
        await queueVolunteerPersonalDutyEvent(

          Number(assignment.id),

          'duty_reassigned',

          client

        );

      if (!notificationSummary.eligible) {

        throw new Error(
          'Volunteer reassignment notification is not eligible'
        );
      }

      // ========================================
      // FINAL SHIFT VALIDITY CHECK
      // ========================================

      // Ensure the new shift has not started
      // while creating notification queue jobs.

      const notificationFinalCheck =
        await client.query(
          `
          SELECT (

            (service_date + start_time)

            AT TIME ZONE 'Asia/Kolkata'

          ) > clock_timestamp() AS is_future

          FROM volunteer_shifts

          WHERE id = $1
          `,
          [
            requirement.shift_id,
          ]
        );

      if (
        notificationFinalCheck.rows[0]?.is_future
          !== true
      ) {

        fail(
          409,
          'The new shift has already started'
        );
      }

      // ========================================
      // COMMIT TRANSACTION
      // ========================================

      // Save assignment changes and notification
      // jobs together as one atomic transaction.

      await client.query('COMMIT');

      // ========================================
      // SUCCESS RESPONSE
      // ========================================

      return res.json({

        success: true,

        message:
          'Volunteer duty reassigned successfully',

        data: {

          previous_assignment_id:
            oldAssignment.id,

          new_assignment: {

            ...assignment,

            full_name:
              member.full_name,

            duty_name:
              requirement.duty_name,
          },
        },
      });

    } catch (error) {

      // ========================================
      // ROLLBACK TRANSACTION
      // ========================================

      await client.query('ROLLBACK')
        .catch(console.error);

      throw error;

    } finally {

      // ========================================
      // RELEASE DATABASE CONNECTION
      // ========================================

      client.release();
    }

  } catch (error) {

    return handleError(res, error);
  }
};