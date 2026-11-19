import { Request, Response } from 'express';
import { pool } from '../db';

// ========================================
// HELPERS
// ========================================

const validId = (value: string) =>
  /^[1-9]\d*$/.test(value) &&
  Number(value) <= 2147483647;

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

const validTime = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value);

const normalizeTime = (value: string) =>
  value.length === 5 ? `${value}:00` : value;

const badRequest = (res: Response, message: string) =>
  res.status(400).json({
    success: false,
    message,
  });

const notFound = (res: Response, message: string) =>
  res.status(404).json({
    success: false,
    message,
  });

const conflict = (res: Response, message: string) =>
  res.status(409).json({
    success: false,
    message,
  });

const sendError = (res: Response, error: unknown) => {
  console.error('Volunteer Shift API error:', error);

  if ((error as { code?: string })?.code === '23505') {
    return conflict(
      res,
      'A shift already exists for these dates and timings'
    );
  }

  return res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
};

function validateShift(body: any): string | null {
  if (
    typeof body.shift_name !== 'string' ||
    !body.shift_name.trim() ||
    body.shift_name.trim().length > 150
  ) {
    return 'Valid shift name is required';
  }

  if (!validDate(body.service_date)) {
    return 'Valid service date is required';
  }

  if (
    !validTime(body.start_time) ||
    !validTime(body.end_time)
  ) {
    return 'Valid start and end times are required';
  }

  if (
    normalizeTime(body.end_time) <=
    normalizeTime(body.start_time)
  ) {
    return 'Shift end time must be after start time';
  }

  return null;
}

// ========================================
// ADMIN: GET ALL OPPORTUNITY SHIFTS
// ========================================

export const getAdminShifts = async (
  req: Request,
  res: Response
) => {
  try {
    const opportunityId = String(
      req.params.opportunityId
    );

    if (!validId(opportunityId)) {
      return badRequest(
        res,
        'Invalid opportunity ID'
      );
    }

    const result = await pool.query(
      `
      SELECT
        s.*,

        s.service_date::text AS service_date,

        (
          SELECT COUNT(*)::integer
          FROM volunteer_availability a
          JOIN volunteer_members m
            ON m.id = a.member_id
          JOIN volunteer_registrations r
            ON r.id = m.registration_id
          WHERE a.shift_id = s.id
          AND m.status NOT IN ('rejected', 'cancelled')
          AND r.status NOT IN ('rejected', 'cancelled')
        ) AS available_volunteers,

        (
          SELECT COUNT(*)::integer
          FROM volunteer_assignments a
          WHERE a.shift_id = s.id
          AND a.status NOT IN (
            'cancelled', 'reassigned'
          )
        ) AS assigned_volunteers,

        (
          SELECT COALESCE(
            SUM(r.required_count), 0
          )::integer
          FROM volunteer_requirements r
          WHERE r.shift_id = s.id
          AND r.is_active = TRUE
        ) AS required_volunteers

      FROM volunteer_shifts s

      WHERE s.opportunity_id = $1

      ORDER BY
        s.service_date ASC,
        s.start_time ASC,
        s.id ASC
      `,
      [opportunityId]
    );

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// ========================================
// PUBLIC: GET AVAILABLE SERVICE SHIFTS
// ========================================

export const getAvailableShifts = async (
  req: Request,
  res: Response
) => {
  try {
    const opportunityId = String(
      req.params.opportunityId
    );

    if (!validId(opportunityId)) {
      return badRequest(
        res,
        'Invalid opportunity ID'
      );
    }

    const result = await pool.query(
      `
      SELECT
        s.id,
        s.opportunity_id,
        s.shift_name,
        s.service_date::text AS service_date,
        s.start_time,
        s.end_time

      FROM volunteer_shifts s

      JOIN volunteer_opportunities o
        ON o.id = s.opportunity_id

      WHERE s.opportunity_id = $1

      AND s.is_active = TRUE
      AND o.is_published = TRUE
      AND o.registration_enabled = TRUE

      AND NOW() >= o.registration_start_at
      AND NOW() < o.registration_end_at

      AND s.service_date BETWEEN
        o.service_start_date AND o.service_end_date

      AND (
        (s.service_date + s.start_time)
        AT TIME ZONE 'Asia/Kolkata'
      ) > NOW()

      ORDER BY
        s.service_date ASC,
        s.start_time ASC
      `,
      [opportunityId]
    );

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// ========================================
// ADMIN: CREATE SINGLE OR MULTIPLE SHIFTS
// ========================================

export const createShifts = async (
  req: Request,
  res: Response
) => {
  const opportunityId = String(
    req.params.opportunityId
  );

  if (!validId(opportunityId)) {
    return badRequest(
      res,
      'Invalid opportunity ID'
    );
  }

  const body = req.body ?? {};

  const shifts = Array.isArray(body.shifts)
    ? body.shifts
    : [body];

  if (!shifts.length || shifts.length > 500) {
    return badRequest(
      res,
      'Provide between 1 and 500 shifts'
    );
  }

  for (const shift of shifts) {
    if (!shift || typeof shift !== 'object') {
      return badRequest(res, 'Invalid shift data');
    }

    const validation = validateShift(shift);

    if (validation) {
      return badRequest(res, validation);
    }
  }

  const client = await pool.connect().catch(error => {
    console.error(error);
    return null;
  });

  if (!client) {
    return res.status(503).json({
      success: false,
      message: 'Database temporarily unavailable',
    });
  }

  try {
    await client.query('BEGIN');

    const opportunity = await client.query(
      `
      SELECT
        id,
        service_start_date::text AS service_start_date,
        service_end_date::text AS service_end_date

      FROM volunteer_opportunities

      WHERE id = $1

      FOR UPDATE
      `,
      [opportunityId]
    );

    if (!opportunity.rows.length) {
      await client.query('ROLLBACK');

      return notFound(
        res,
        'Volunteer opportunity not found'
      );
    }

    const current = opportunity.rows[0];

    const created = [];

    for (const shift of shifts) {
      if (
        shift.service_date < current.service_start_date ||
        shift.service_date > current.service_end_date
      ) {
        await client.query('ROLLBACK');

        return badRequest(
          res,
          `Service date ${shift.service_date} is outside the opportunity service period`
        );
      }

      const future = await client.query(
        `
        SELECT (
          ($1::date + $2::time)
          AT TIME ZONE 'Asia/Kolkata'
        ) > NOW() AS is_future
        `,
        [
          shift.service_date,
          shift.start_time,
        ]
      );

      if (!future.rows[0].is_future) {
        await client.query('ROLLBACK');

        return badRequest(
          res,
          'Cannot create a service shift in the past'
        );
      }

      const result = await client.query(
        `
        INSERT INTO volunteer_shifts (
          opportunity_id,
          shift_name,
          service_date,
          start_time,
          end_time,
          is_active
        )
        VALUES ($1,$2,$3,$4,$5,TRUE)

        RETURNING *,
          service_date::text AS service_date
        `,
        [
          opportunityId,
          shift.shift_name.trim(),
          shift.service_date,
          shift.start_time,
          shift.end_time,
        ]
      );

      created.push(result.rows[0]);
    }

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message:
        `${created.length} service shift(s) created successfully`,
      data: created,
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(console.error);

    return sendError(res, error);
  } finally {
    client.release();
  }
};

// ========================================
// ADMIN: UPDATE SERVICE SHIFT
// ========================================

export const updateShift = async (
  req: Request,
  res: Response
) => {
  const opportunityId = String(
    req.params.opportunityId
  );

  const shiftId = String(req.params.shiftId);

  if (
    !validId(opportunityId) ||
    !validId(shiftId)
  ) {
    return badRequest(res, 'Invalid ID');
  }

  const body = req.body ?? {};

  const fields = [
    'shift_name',
    'service_date',
    'start_time',
    'end_time',
  ];

  if (!fields.some(field => body[field] !== undefined)) {
    return badRequest(res, 'No editable fields provided');
  }

  const client = await pool.connect().catch(error => {
    console.error(error);
    return null;
  });

  if (!client) {
    return res.status(503).json({
      success: false,
      message: 'Database temporarily unavailable',
    });
  }

  try {
    await client.query('BEGIN');

    const opportunity = await client.query(
      `
      SELECT
        service_start_date::text AS service_start_date,
        service_end_date::text AS service_end_date
      FROM volunteer_opportunities
      WHERE id = $1
      FOR UPDATE
      `,
      [opportunityId]
    );

    if (!opportunity.rows.length) {
      await client.query('ROLLBACK');

      return notFound(res, 'Opportunity not found');
    }

    const existing = await client.query(
      `
      SELECT *,
        service_date::text AS service_date
      FROM volunteer_shifts
      WHERE id = $1
      AND opportunity_id = $2
      FOR UPDATE
      `,
      [shiftId, opportunityId]
    );

    if (!existing.rows.length) {
      await client.query('ROLLBACK');

      return notFound(res, 'Shift not found');
    }

    const current = existing.rows[0];

    const merged = {
      ...current,
    };

    for (const field of fields) {
      if (body[field] !== undefined) {
        merged[field] = body[field];
      }
    }

    const validation = validateShift(merged);

    if (validation) {
      await client.query('ROLLBACK');

      return badRequest(res, validation);
    }

    const dates = opportunity.rows[0];

    if (
      merged.service_date < dates.service_start_date ||
      merged.service_date > dates.service_end_date
    ) {
      await client.query('ROLLBACK');

      return badRequest(
        res,
        'Service date is outside the opportunity period'
      );
    }

    const timingChanged =
      merged.service_date !== current.service_date ||
      normalizeTime(merged.start_time) !==
        normalizeTime(current.start_time) ||
      normalizeTime(merged.end_time) !==
        normalizeTime(current.end_time);

    // Protect existing volunteer availability.

    if (timingChanged) {
      const dependencies = await client.query(
        `
        SELECT (
          EXISTS (
            SELECT 1
            FROM volunteer_availability
            WHERE shift_id = $1
          )
          OR EXISTS (
            SELECT 1
            FROM volunteer_requirements
            WHERE shift_id = $1
          )
          OR EXISTS (
            SELECT 1
            FROM volunteer_assignments
            WHERE shift_id = $1
          )
        ) AS has_dependencies
        `,
        [shiftId]
      );

      if (dependencies.rows[0].has_dependencies) {
        await client.query('ROLLBACK');

        return conflict(
          res,
          'Cannot change dates or timings after volunteers or requirements have been linked to this shift'
        );
      }

      const future = await client.query(
        `
        SELECT (
          (
            ($1::date + $2::time)
            AT TIME ZONE 'Asia/Kolkata'
          ) > NOW()
          AND
          (
            ($3::date + $4::time)
            AT TIME ZONE 'Asia/Kolkata'
          ) > NOW()
        ) AS is_future
        `,
        [
          merged.service_date,
          merged.start_time,
          current.service_date,
          current.start_time,
        ]
      );

      if (!future.rows[0].is_future) {
        await client.query('ROLLBACK');

        return badRequest(
          res,
          'Cannot move started shifts or schedule shifts in the past'
        );
      }
    }

    const result = await client.query(
      `
      UPDATE volunteer_shifts

      SET
        shift_name = $1,
        service_date = $2,
        start_time = $3,
        end_time = $4,
        updated_at = NOW()

      WHERE id = $5
      AND opportunity_id = $6

      RETURNING *,
        service_date::text AS service_date
      `,
      [
        merged.shift_name.trim(),
        merged.service_date,
        merged.start_time,
        merged.end_time,
        shiftId,
        opportunityId,
      ]
    );

    await client.query('COMMIT');

    return res.json({
      success: true,
      message: 'Service shift updated successfully',
      data: result.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(console.error);

    return sendError(res, error);
  } finally {
    client.release();
  }
};

// ========================================
// ADMIN: ENABLE OR DISABLE SHIFT
// ========================================

export const updateShiftStatus = async (
  req: Request,
  res: Response
) => {
  const opportunityId = String(
    req.params.opportunityId
  );

  const shiftId = String(req.params.shiftId);

  if (
    !validId(opportunityId) ||
    !validId(shiftId)
  ) {
    return badRequest(res, 'Invalid ID');
  }

  const active = req.body?.is_active;

  if (typeof active !== 'boolean') {
    return badRequest(
      res,
      'is_active must be true or false'
    );
  }

  const client = await pool.connect().catch(error => {
    console.error(error);
    return null;
  });

  if (!client) {
    return res.status(503).json({
      success: false,
      message: 'Database temporarily unavailable',
    });
  }

  try {
    await client.query('BEGIN');

    const opportunity = await client.query(
      `
      SELECT id
      FROM volunteer_opportunities
      WHERE id = $1
      FOR UPDATE
      `,
      [opportunityId]
    );

    if (!opportunity.rows.length) {
      await client.query('ROLLBACK');
      return notFound(res, 'Opportunity not found');
    }

    const existing = await client.query(
      `
      SELECT id
      FROM volunteer_shifts
      WHERE id = $1
      AND opportunity_id = $2
      FOR UPDATE
      `,
      [shiftId, opportunityId]
    );

    if (!existing.rows.length) {
      await client.query('ROLLBACK');
      return notFound(res, 'Shift not found');
    }

    const result = await client.query(
      `
      UPDATE volunteer_shifts s

      SET
        is_active = $1,
        updated_at = NOW()

      WHERE s.id = $2
      AND s.opportunity_id = $3

      AND (
        $1 = FALSE
        OR (
          (s.service_date + s.start_time)
          AT TIME ZONE 'Asia/Kolkata'
        ) > NOW()
      )

      RETURNING *,
        service_date::text AS service_date
      `,
      [active, shiftId, opportunityId]
    );

    if (!result.rows.length) {
      await client.query('ROLLBACK');

      return conflict(
        res,
        'Cannot enable a shift that has already started'
      );
    }

    await client.query('COMMIT');

    return res.json({
      success: true,

      message: active
        ? 'Service shift enabled'
        : 'Service shift closed for new registrations',

      data: result.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(console.error);

    return sendError(res, error);
  } finally {
    client.release();
  }
};