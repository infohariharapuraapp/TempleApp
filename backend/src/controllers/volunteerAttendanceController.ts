import { Request, Response } from 'express';
import { pool } from '../db';
import { AuthRequest } from '../middleware/authMiddleware';

// ========================================
// HELPERS
// ========================================

class AttendanceError extends Error {
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
  throw new AttendanceError(status, message);
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

const ATTENDANCE_STATUSES = [
  'not_marked',
  'present',
  'absent',
  'excused',
];

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
  if (error instanceof AttendanceError) {
    return res.status(error.status).json({
      success: false,
      message: error.message,
    });
  }

  console.error(
    'Volunteer attendance error:',
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
// GET ASSIGNMENT FOR ATTENDANCE
// ========================================

async function getAssignment(
  client: any,
  opportunityId: string,
  assignmentId: number
) {
  const result = await client.query(
    `
    SELECT
      a.*,

      m.full_name,
      m.registration_id,
      m.status AS member_status,

      r.status AS registration_status,

      s.service_date::text AS service_date,
      s.start_time,
      s.end_time,

      (
        (s.service_date + s.start_time)
        AT TIME ZONE 'Asia/Kolkata'
      ) <= clock_timestamp() AS has_started,

      (
        (s.service_date + s.end_time)
        AT TIME ZONE 'Asia/Kolkata'
      ) <= clock_timestamp() AS has_ended

    FROM volunteer_assignments a

    JOIN volunteer_members m
      ON m.id = a.member_id

    JOIN volunteer_registrations r
      ON r.id = m.registration_id

    JOIN volunteer_shifts s
      ON s.id = a.shift_id

    WHERE a.id = $1
    AND a.opportunity_id = $2

    FOR UPDATE OF a, r, m
    `,
    [
      assignmentId,
      opportunityId,
    ]
  );

  if (!result.rows.length) {
    fail(404, 'Assignment not found');
  }

  const assignment = result.rows[0];

  if (
    ['cancelled', 'reassigned']
      .includes(assignment.status)
  ) {
    fail(
      409,
      'Attendance cannot be recorded for cancelled or reassigned duties'
    );
  }

  if (
    assignment.member_status !== 'approved' ||
    ![
      'approved',
      'assigned',
      'in_progress'
    ].includes(assignment.registration_status)
  ) {
    fail(
      409,
      'Volunteer is not eligible for attendance changes'
    );
  }

  return assignment;
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
// ADMIN: GET ATTENDANCE LIST
// ========================================

export const getVolunteerAttendance = async (
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

    const shiftId = req.query.shift_id;

    const requirementId =
      req.query.requirement_id;

    const attendanceStatus =
      req.query.attendance_status;

    for (const id of [
      shiftId,
      requirementId,
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
      attendanceStatus !== undefined &&
      (
        typeof attendanceStatus !== 'string' ||
        !ATTENDANCE_STATUSES.includes(
          attendanceStatus
        )
      )
    ) {
      fail(400, 'Invalid attendance status');
    }

    const result = await pool.query(
      `
      SELECT
        a.id AS assignment_id,
        a.status AS assignment_status,

        a.member_id,
        a.requirement_id,
        a.shift_id,

        m.full_name,
        m.member_code,
        m.mobile,
        m.gender,
        m.photo_url,

        r.registration_code,
        r.registration_type,
        r.group_name,

        d.name AS duty_name,

        s.shift_name,
        s.service_date::text AS service_date,
        s.start_time,
        s.end_time,

        att.id AS attendance_id,

        COALESCE(
          att.attendance_status,
          'not_marked'
        ) AS attendance_status,

        COALESCE(
          att.is_finalized,
          FALSE
        ) AS is_finalized,

        att.check_in_at,
        att.check_out_at,
        att.remarks,
        att.marked_at,
        att.finalized_at,

        marker.full_name AS marked_by_name,

        finalizer.full_name
          AS finalized_by_name

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

      LEFT JOIN volunteer_attendance att
        ON att.assignment_id = a.id

      LEFT JOIN users marker
        ON marker.id = att.marked_by

      LEFT JOIN users finalizer
        ON finalizer.id = att.finalized_by

      WHERE a.opportunity_id = $1

      AND a.status NOT IN (
        'cancelled',
        'reassigned'
      )

      AND (
        $2::integer IS NULL
        OR a.shift_id = $2
      )

      AND (
        $3::integer IS NULL
        OR a.requirement_id = $3
      )

      AND (
        $4::text IS NULL

        OR COALESCE(
          att.attendance_status,
          'not_marked'
        ) = $4
      )

      ORDER BY
        s.service_date ASC,
        s.start_time ASC,
        d.name ASC,
        m.full_name ASC
      `,
      [
        opportunityId,
        shiftId ?? null,
        requirementId ?? null,
        attendanceStatus ?? null,
      ]
    );

    const rows = result.rows;

    const stats = {
      total: rows.length,

      present: rows.filter(
        r => r.attendance_status === 'present'
      ).length,

      absent: rows.filter(
        r => r.attendance_status === 'absent'
      ).length,

      excused: rows.filter(
        r => r.attendance_status === 'excused'
      ).length,

      not_marked: rows.filter(
        r => r.attendance_status === 'not_marked'
      ).length,

      finalized: rows.filter(
        r => r.is_finalized
      ).length,
    };

    return res.json({
      success: true,
      data: rows,
      stats,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// ========================================
// ADMIN: MARK SINGLE OR BULK ATTENDANCE
// ========================================

export const markVolunteerAttendance = async (
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

    const records = Array.isArray(body.records)
      ? body.records
      : [body];

    if (
      !records.length ||
      records.length > 500
    ) {
      fail(
        400,
        'Provide between 1 and 500 attendance records'
      );
    }

    const assignmentIds: number[] = [];

    for (const record of records) {
      if (
        !record ||
        !validNumberId(record.assignment_id)
      ) {
        fail(400, 'Invalid assignment ID');
      }

      if (
        !ATTENDANCE_STATUSES.includes(
          record.attendance_status
        )
      ) {
        fail(400, 'Invalid attendance status');
      }

      optionalText(record.remarks);

      assignmentIds.push(
        record.assignment_id
      );
    }

    if (
      new Set(assignmentIds).size !==
      assignmentIds.length
    ) {
      fail(
        400,
        'Duplicate assignment IDs are not allowed'
      );
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      await lockOpportunity(
        client,
        opportunityId
      );

      const updated: any[] = [];

      const registrationIds =
        new Set<number>();

      for (const record of records) {
        const assignment = await getAssignment(
          client,
          opportunityId,
          record.assignment_id
        );

        if (!assignment.has_started) {
          fail(
            409,
            'Attendance can only be marked after the shift starts'
          );
        }

        const existing = await client.query(
          `
          SELECT *
          FROM volunteer_attendance
          WHERE assignment_id = $1
          FOR UPDATE
          `,
          [record.assignment_id]
        );

        if (
          existing.rows[0]?.is_finalized
        ) {
          fail(
            409,
            `Attendance for ${assignment.full_name} is finalized`
          );
        }

        if (
          assignment.status === 'completed'
        ) {
          fail(
            409,
            'Completed assignments cannot be marked again'
          );
        }

        const result = await client.query(
          `
          INSERT INTO volunteer_attendance (
            assignment_id,
            attendance_status,
            remarks,
            marked_by,
            marked_at,
            is_finalized
          )

          VALUES (
            $1,$2,$3,$4,NOW(),FALSE
          )

          ON CONFLICT (assignment_id)

          DO UPDATE SET
            attendance_status =
              EXCLUDED.attendance_status,

            remarks =
              EXCLUDED.remarks,

            marked_by =
              EXCLUDED.marked_by,

            marked_at = NOW(),

            check_in_at = CASE

              WHEN EXCLUDED.attendance_status
                = 'present'

              THEN volunteer_attendance.check_in_at

              ELSE NULL

            END,

            check_out_at = CASE

              WHEN EXCLUDED.attendance_status
                = 'present'

              THEN volunteer_attendance.check_out_at

              ELSE NULL

            END,

            updated_at = NOW()

          RETURNING *
          `,
          [
            record.assignment_id,
            record.attendance_status,
            optionalText(record.remarks),
            adminId,
          ]
        );

        const assignmentStatus =
          record.attendance_status === 'present'
            ? 'in_progress'
            : 'assigned';

        await client.query(
          `
          UPDATE volunteer_assignments

          SET
            status = $1,
            updated_at = NOW()

          WHERE id = $2
          `,
          [
            assignmentStatus,
            record.assignment_id,
          ]
        );

        registrationIds.add(
          assignment.registration_id
        );

        updated.push({
          ...result.rows[0],
          full_name: assignment.full_name,
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

      await client.query('COMMIT');

      return res.json({
        success: true,

        message:
          `${updated.length} attendance record(s) updated`,

        data: updated,
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
// ADMIN: FINALIZE ATTENDANCE
// ========================================

export const finalizeVolunteerAttendance = async (
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

    const assignmentIds = Array.isArray(
      body.assignment_ids
    )
      ? body.assignment_ids
      : [body.assignment_id];

    if (
      !assignmentIds.length ||
      assignmentIds.length > 500 ||
      !assignmentIds.every(validNumberId) ||
      new Set(assignmentIds).size !==
        assignmentIds.length
    ) {
      fail(
        400,
        'Provide valid unique assignment IDs'
      );
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      await lockOpportunity(
        client,
        opportunityId
      );

      const finalized: any[] = [];

      const registrationIds =
        new Set<number>();

      for (const assignmentId of assignmentIds) {
        const assignment = await getAssignment(
          client,
          opportunityId,
          assignmentId
        );

        if (!assignment.has_ended) {
          fail(
            409,
            'Attendance can only be finalized after the shift ends'
          );
        }

        const existing = await client.query(
          `
          SELECT *

          FROM volunteer_attendance

          WHERE assignment_id = $1

          FOR UPDATE
          `,
          [assignmentId]
        );

        if (
          !existing.rows.length ||
          existing.rows[0].attendance_status
            === 'not_marked'
        ) {
          fail(
            409,
            `Attendance is not marked for ${assignment.full_name}`
          );
        }

        if (existing.rows[0].is_finalized) {
          finalized.push(existing.rows[0]);
          continue;
        }

        const result = await client.query(
          `
          UPDATE volunteer_attendance

          SET
            is_finalized = TRUE,
            finalized_by = $1,
            finalized_at = NOW(),
            updated_at = NOW()

          WHERE assignment_id = $2

          RETURNING *
          `,
          [
            adminId,
            assignmentId,
          ]
        );

        // Assignment completed means its
        // attendance workflow is closed.
        // It does not mean the volunteer attended.

        await client.query(
          `
          UPDATE volunteer_assignments

          SET
            status = 'completed',
            completed_at = NOW(),
            updated_at = NOW()

          WHERE id = $1
          `,
          [assignmentId]
        );

        registrationIds.add(
          assignment.registration_id
        );

        finalized.push(result.rows[0]);
      }

      for (
        const registrationId of registrationIds
      ) {
        await refreshRegistrationStatus(
          client,
          registrationId
        );
      }

      await client.query('COMMIT');

      return res.json({
        success: true,

        message:
          `${finalized.length} attendance record(s) finalized`,

        data: finalized,
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
// ADMIN: REOPEN FINALIZED ATTENDANCE
// ========================================

export const reopenVolunteerAttendance = async (
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

    const reason = optionalText(
      req.body?.reason,
      2000
    );

    if (!reason) {
      fail(
        400,
        'Attendance correction reason is required'
      );
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      await lockOpportunity(
        client,
        opportunityId
      );

      const assignment = await getAssignment(
        client,
        opportunityId,
        Number(assignmentId)
      );

      const certificates = await client.query(
        `
        SELECT id

        FROM volunteer_certificates

        WHERE member_id = $1

        AND status = 'issued'

        LIMIT 1
        `,
        [assignment.member_id]
      );

      if (certificates.rows.length) {
        fail(
          409,
          'Issued certificate must be reviewed before correcting attendance'
        );
      }

      const existing = await client.query(
        `
        SELECT *

        FROM volunteer_attendance

        WHERE assignment_id = $1

        FOR UPDATE
        `,
        [assignmentId]
      );

      if (!existing.rows.length) {
        fail(404, 'Attendance record not found');
      }

      if (!existing.rows[0].is_finalized) {
        fail(
          409,
          'Attendance is already open for editing'
        );
      }

      const correctionNote =
        `[Reopened by admin ${adminId} ` +
        `at ${new Date().toISOString()}] ` +
        `Reason: ${reason}`;

      const result = await client.query(
        `
        UPDATE volunteer_attendance

        SET
          is_finalized = FALSE,
          finalized_by = NULL,
          finalized_at = NULL,

          remarks = CONCAT_WS(
            E'\\n',
            NULLIF(remarks, ''),
            $1::text
          ),

          updated_at = NOW()

        WHERE assignment_id = $2

        RETURNING *
        `,
        [
          correctionNote,
          assignmentId,
        ]
      );

      const assignmentStatus =
        existing.rows[0].attendance_status
          === 'present'
          ? 'in_progress'
          : 'assigned';

      await client.query(
        `
        UPDATE volunteer_assignments

        SET
          status = $1,
          completed_at = NULL,
          updated_at = NOW()

        WHERE id = $2
        `,
        [
          assignmentStatus,
          assignmentId,
        ]
      );

      await refreshRegistrationStatus(
        client,
        assignment.registration_id
      );

      await client.query('COMMIT');

      return res.json({
        success: true,

        message:
          'Attendance reopened for correction',

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