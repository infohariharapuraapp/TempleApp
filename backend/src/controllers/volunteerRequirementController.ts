import { Request, Response } from 'express';
import { pool } from '../db';

// ========================================
// HELPERS
// ========================================

class RequirementError extends Error {
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
  throw new RequirementError(status, message);
}

const validId = (value: string) =>
  /^[1-9]\d*$/.test(value) &&
  Number(value) <= 2147483647;

const validInteger = (value: unknown) =>
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

const optionalTime = (
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
    !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value)
  ) {
    fail(400, 'Invalid reporting time');
  }

  return value;
};

const optionalPhone = (
  value: unknown
): string | null => {
  const phone = optionalText(value, 20);

  if (
    phone &&
    !/^\+?[0-9\s()-]{7,20}$/.test(phone)
  ) {
    fail(400, 'Invalid coordinator phone');
  }

  return phone;
};

const handleError = (
  res: Response,
  error: unknown
) => {
  if (error instanceof RequirementError) {
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
        'This duty already exists for the selected shift',
    });
  }

  console.error(
    'Volunteer requirement error:',
    error
  );

  return res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
};

// ========================================
// REQUIREMENT SELECT QUERY
// ========================================

const REQUIREMENT_SELECT = `
  SELECT
    r.*,

    d.name AS duty_name,
    d.description AS duty_description,
    d.responsibilities,
    d.male_dress_code,
    d.female_dress_code,
    d.male_dress_image_url,
    d.female_dress_image_url,
    d.is_active AS duty_is_active,

    s.shift_name,
    s.service_date::text AS service_date,
    s.start_time,
    s.end_time,
    s.is_active AS shift_is_active,

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
      SELECT COUNT(*)::integer
      FROM volunteer_assignments a

      WHERE a.requirement_id = r.id

      AND a.status NOT IN (
        'cancelled',
        'reassigned'
      )
    ) AS assigned_volunteers,

    GREATEST(
      r.required_count - (
        SELECT COUNT(*)::integer
        FROM volunteer_assignments a

        WHERE a.requirement_id = r.id

        AND a.status NOT IN (
          'cancelled',
          'reassigned'
        )
      ),
      0
    ) AS remaining_volunteers

  FROM volunteer_requirements r

  JOIN volunteer_duties d
    ON d.id = r.duty_id

  JOIN volunteer_shifts s
    ON s.id = r.shift_id
`;

// ========================================
// ADMIN: GET OPPORTUNITY REQUIREMENTS
// ========================================

export const getVolunteerRequirements = async (
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

    if (
      shiftId !== undefined &&
      (
        typeof shiftId !== 'string' ||
        !validId(shiftId)
      )
    ) {
      fail(400, 'Invalid shift ID');
    }

    const result = await pool.query(
      `
      ${REQUIREMENT_SELECT}

      WHERE r.opportunity_id = $1

      AND (
        $2::integer IS NULL
        OR r.shift_id = $2
      )

      ORDER BY
        s.service_date ASC,
        s.start_time ASC,
        d.name ASC
      `,
      [
        opportunityId,
        shiftId ?? null,
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
// ADMIN: CREATE DUTY REQUIREMENT
// ========================================

export const createVolunteerRequirement = async (
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

    const body = req.body ?? {};

    if (!validInteger(body.shift_id)) {
      fail(400, 'Valid shift ID is required');
    }

    if (!validInteger(body.duty_id)) {
      fail(400, 'Valid duty ID is required');
    }

    if (!validInteger(body.required_count)) {
      fail(
        400,
        'Required volunteer count must be positive'
      );
    }

    const reportingLocation = optionalText(
      body.reporting_location
    );

    const reportingTime = optionalTime(
      body.reporting_time
    );

    const coordinatorName = optionalText(
      body.coordinator_name,
      255
    );

    const coordinatorPhone = optionalPhone(
      body.coordinator_phone
    );

    const instructions = optionalText(
      body.instructions
    );

    const client = await pool.connect();

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
        fail(404, 'Opportunity not found');
      }

      const shift = await client.query(
        `
        SELECT
          id,
          is_active,
          start_time,
          CASE
            WHEN (
              (service_date + start_time)
              AT TIME ZONE 'Asia/Kolkata'
            ) > clock_timestamp()
            THEN TRUE
            ELSE FALSE
          END AS is_future

        FROM volunteer_shifts

        WHERE id = $1
        AND opportunity_id = $2

        FOR UPDATE
        `,
        [
          body.shift_id,
          opportunityId,
        ]
      );

      if (!shift.rows.length) {
        fail(
          404,
          'Shift not found for this opportunity'
        );
      }

      if (
        !shift.rows[0].is_active ||
        !shift.rows[0].is_future
      ) {
        fail(
          409,
          'Select an active future service shift'
        );
      }

      const duty = await client.query(
        `
        SELECT id, is_active
        FROM volunteer_duties
        WHERE id = $1
        FOR UPDATE
        `,
        [body.duty_id]
      );

      if (!duty.rows.length) {
        fail(404, 'Duty not found');
      }

      if (!duty.rows[0].is_active) {
        fail(409, 'Selected duty is disabled');
      }

      if (reportingTime) {
        const timeCheck = await client.query(
          `
          SELECT
            $1::time <= $2::time AS valid
          `,
          [
            reportingTime,
            shift.rows[0].start_time,
          ]
        );

        if (!timeCheck.rows[0].valid) {
          fail(
            400,
            'Reporting time cannot be after shift start'
          );
        }
      }

      const result = await client.query(
        `
        INSERT INTO volunteer_requirements (
          opportunity_id,
          shift_id,
          duty_id,
          required_count,
          reporting_location,
          reporting_time,
          coordinator_name,
          coordinator_phone,
          instructions,
          is_active
        )

        VALUES (
          $1,$2,$3,$4,$5,
          $6,$7,$8,$9,TRUE
        )

        RETURNING *
        `,
        [
          opportunityId,
          body.shift_id,
          body.duty_id,
          body.required_count,
          reportingLocation,
          reportingTime,
          coordinatorName,
          coordinatorPhone,
          instructions,
        ]
      );

      await client.query('COMMIT');

      return res.status(201).json({
        success: true,
        message:
          'Duty requirement created successfully',
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
// ADMIN: UPDATE REQUIREMENT
// ========================================

export const updateVolunteerRequirement = async (
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

    const body = req.body ?? {};

    const validators: Record<
      string,
      (value: unknown) => unknown
    > = {
      required_count: value => {
        if (!validInteger(value)) {
          fail(
            400,
            'Required count must be positive'
          );
        }

        return value;
      },

      reporting_location:
        value => optionalText(value),

      reporting_time:
        optionalTime,

      coordinator_name:
        value => optionalText(value, 255),

      coordinator_phone:
        optionalPhone,

      instructions:
        value => optionalText(value),
    };

    const fields = Object.keys(
      validators
    ).filter(
      field => body[field] !== undefined
    );

    if (!fields.length) {
      fail(400, 'No editable fields provided');
    }

    const values = fields.map(
      field => validators[field](body[field])
    );

    const client = await pool.connect();

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
        fail(404, 'Opportunity not found');
      }

      const existing = await client.query(
        `
        SELECT
          r.*,
          s.start_time,

          (
            (s.service_date + s.start_time)
            AT TIME ZONE 'Asia/Kolkata'
          ) > clock_timestamp() AS is_future

        FROM volunteer_requirements r

        JOIN volunteer_shifts s
          ON s.id = r.shift_id

        WHERE r.id = $1
        AND r.opportunity_id = $2

        FOR UPDATE OF r
        `,
        [
          requirementId,
          opportunityId,
        ]
      );

      if (!existing.rows.length) {
        fail(404, 'Requirement not found');
      }

      if (!existing.rows[0].is_future) {
        fail(
          409,
          'Cannot edit requirements after the shift starts'
        );
      }

      const assignments = await client.query(
        `
        SELECT COUNT(*)::integer AS total

        FROM volunteer_assignments

        WHERE requirement_id = $1

        AND status NOT IN (
          'cancelled',
          'reassigned'
        )
        `,
        [requirementId]
      );

      if (
        body.required_count !== undefined &&
        body.required_count <
          assignments.rows[0].total
      ) {
        fail(
          409,
          'Required count cannot be below assigned volunteers'
        );
      }

      if (
        body.reporting_time !== undefined
      ) {
        const reportingTime = optionalTime(
          body.reporting_time
        );

        if (reportingTime) {
          const check = await client.query(
            `
            SELECT
              $1::time <= $2::time AS valid
            `,
            [
              reportingTime,
              existing.rows[0].start_time,
            ]
          );

          if (!check.rows[0].valid) {
            fail(
              400,
              'Reporting time cannot be after shift start'
            );
          }
        }
      }

      const setters = fields.map(
        (field, index) =>
          `${field} = $${index + 1}`
      );

      const result = await client.query(
        `
        UPDATE volunteer_requirements

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
          requirementId,
          opportunityId,
        ]
      );

      await client.query('COMMIT');

      return res.json({
        success: true,
        message:
          'Duty requirement updated successfully',
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
// ADMIN: ENABLE OR DISABLE REQUIREMENT
// ========================================

export const updateVolunteerRequirementStatus =
  async (
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

      const active = req.body?.is_active;

      if (typeof active !== 'boolean') {
        fail(
          400,
          'is_active must be true or false'
        );
      }

      const client = await pool.connect();

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
          fail(404, 'Opportunity not found');
        }

        const existing = await client.query(
          `
          SELECT
            r.id,
            s.is_active AS shift_is_active,
            d.is_active AS duty_is_active,

            (
              (s.service_date + s.start_time)
              AT TIME ZONE 'Asia/Kolkata'
            ) > clock_timestamp() AS is_future

          FROM volunteer_requirements r

          JOIN volunteer_shifts s
            ON s.id = r.shift_id

          JOIN volunteer_duties d
            ON d.id = r.duty_id

          WHERE r.id = $1
          AND r.opportunity_id = $2

          FOR UPDATE OF r, d
          `,
          [
            requirementId,
            opportunityId,
          ]
        );

        if (!existing.rows.length) {
          fail(404, 'Requirement not found');
        }

        const current = existing.rows[0];

        if (
          active &&
          (
            !current.shift_is_active ||
            !current.duty_is_active ||
            !current.is_future
          )
        ) {
          fail(
            409,
            'Cannot enable requirement for an inactive duty or unavailable shift'
          );
        }

        const result = await client.query(
          `
          UPDATE volunteer_requirements

          SET
            is_active = $1,
            updated_at = NOW()

          WHERE id = $2
          AND opportunity_id = $3

          RETURNING *
          `,
          [
            active,
            requirementId,
            opportunityId,
          ]
        );

        await client.query('COMMIT');

        return res.json({
          success: true,

          message: active
            ? 'Duty requirement enabled'
            : 'Duty requirement disabled',

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