import { Request, Response } from 'express';
import { pool } from '../db';
import { AuthRequest } from '../middleware/authMiddleware';

// ========================================
// HELPERS
// ========================================

class DutyError extends Error {
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
  throw new DutyError(status, message);
}

const validId = (id: string) =>
  /^[1-9]\d*$/.test(id) &&
  Number(id) <= 2147483647;

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

const validName = (value: unknown): string => {
  const name = optionalText(value, 255);

  if (!name) {
    fail(400, 'Duty name is required');
  }

  return name;
};

const validPhone = (
  value: unknown
): string | null => {
  const phone = optionalText(value, 20);

  if (
    phone &&
    !/^\+?[0-9\s()-]{7,20}$/.test(phone)
  ) {
    fail(400, 'Invalid coordinator phone number');
  }

  return phone;
};

const validImageUrl = (
  value: unknown
): string | null => {
  const imageUrl = optionalText(value, 2048);

  if (!imageUrl) {
    return null;
  }

  try {
    const url = new URL(imageUrl);

    if (url.protocol !== 'https:') {
      fail(400, 'Image URL must use HTTPS');
    }
  } catch {
    fail(400, 'Invalid dress code image URL');
  }

  return imageUrl;
};

const handleError = (
  res: Response,
  error: unknown
) => {
  if (error instanceof DutyError) {
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
      message: 'A duty with this name already exists',
    });
  }

  console.error(
    'Volunteer duty API error:',
    error
  );

  return res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
};

// ========================================
// EDITABLE DUTY FIELDS
// ========================================

const FIELD_VALIDATORS: Record<
  string,
  (value: unknown) => unknown
> = {
  name: validName,

  description:
    value => optionalText(value),

  responsibilities:
    value => optionalText(value),

  reporting_location:
    value => optionalText(value),

  male_dress_code:
    value => optionalText(value),

  female_dress_code:
    value => optionalText(value),

  male_dress_image_url:
    validImageUrl,

  female_dress_image_url:
    validImageUrl,

  general_instructions:
    value => optionalText(value),

  coordinator_name:
    value => optionalText(value, 255),

  coordinator_phone:
    validPhone,
};

const DUTY_FIELDS = Object.keys(
  FIELD_VALIDATORS
);

// ========================================
// ADMIN: GET ALL DUTIES
// ========================================

export const getAdminDuties = async (
  req: Request,
  res: Response
) => {
  try {
    const active = req.query.active;
    const search = req.query.search;

    if (
      active !== undefined &&
      active !== 'true' &&
      active !== 'false'
    ) {
      fail(400, 'Invalid active status');
    }

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
        d.*,

        u.full_name AS created_by_name,

        (
          SELECT COUNT(*)::integer
          FROM volunteer_requirements r
          WHERE r.duty_id = d.id
        ) AS total_requirements,

        (
          SELECT COUNT(*)::integer

          FROM volunteer_assignments a

          JOIN volunteer_requirements r
            ON r.id = a.requirement_id

          WHERE r.duty_id = d.id

          AND a.status NOT IN (
            'cancelled',
            'reassigned'
          )
        ) AS total_assignments

      FROM volunteer_duties d

      LEFT JOIN users u
        ON u.id = d.created_by

      WHERE (
        $1::boolean IS NULL
        OR d.is_active = $1
      )

      AND (
        $2::text IS NULL

        OR d.name ILIKE $2
        OR d.description ILIKE $2
        OR d.coordinator_name ILIKE $2
      )

      ORDER BY
        d.is_active DESC,
        d.name ASC,
        d.id ASC
      `,
      [
        active === undefined
          ? null
          : active === 'true',

        typeof search === 'string' &&
        search.trim()
          ? `%${search.trim()}%`
          : null,
      ]
    );

    res.set(
      'Cache-Control',
      'private, no-store'
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
// ADMIN: GET DUTY DETAILS
// ========================================

export const getAdminDutyById = async (
  req: Request,
  res: Response
) => {
  try {
    const id = String(req.params.id);

    if (!validId(id)) {
      fail(400, 'Invalid duty ID');
    }

    const result = await pool.query(
      `
      SELECT
        d.*,

        u.full_name AS created_by_name

      FROM volunteer_duties d

      LEFT JOIN users u
        ON u.id = d.created_by

      WHERE d.id = $1
      `,
      [id]
    );

    if (!result.rows.length) {
      fail(404, 'Volunteer duty not found');
    }

    res.set(
      'Cache-Control',
      'private, no-store'
    );

    return res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// ========================================
// ADMIN: CREATE DUTY
// ========================================

export const createDuty = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      fail(401, 'Authentication required');
    }

    const body = req.body ?? {};

    const values = DUTY_FIELDS.map(
      field =>
        FIELD_VALIDATORS[field](body[field])
    );

    const result = await pool.query(
      `
      INSERT INTO volunteer_duties (
        ${DUTY_FIELDS.join(', ')},
        is_active,
        created_by
      )

      VALUES (
        ${DUTY_FIELDS.map(
          (_, index) => `$${index + 1}`
        ).join(', ')},

        TRUE,
        $${values.length + 1}
      )

      RETURNING *
      `,
      [
        ...values,
        req.user.userId,
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Volunteer duty created successfully',
      data: result.rows[0],
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// ========================================
// ADMIN: UPDATE DUTY
// ========================================

export const updateDuty = async (
  req: Request,
  res: Response
) => {
  try {
    const id = String(req.params.id);

    if (!validId(id)) {
      fail(400, 'Invalid duty ID');
    }

    const body = req.body ?? {};

    const provided = DUTY_FIELDS.filter(
      field => body[field] !== undefined
    );

    if (!provided.length) {
      fail(400, 'No editable fields provided');
    }

    const values = provided.map(
      field =>
        FIELD_VALIDATORS[field](body[field])
    );

    const assignments = provided.map(
      (field, index) =>
        `${field} = $${index + 1}`
    );

    const result = await pool.query(
      `
      UPDATE volunteer_duties

      SET
        ${assignments.join(', ')},
        updated_at = NOW()

      WHERE id = $${values.length + 1}

      RETURNING *
      `,
      [...values, id]
    );

    if (!result.rows.length) {
      fail(404, 'Volunteer duty not found');
    }

    return res.json({
      success: true,
      message: 'Volunteer duty updated successfully',
      data: result.rows[0],
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// ========================================
// ADMIN: ENABLE OR DISABLE DUTY
// ========================================

export const updateDutyStatus = async (
  req: Request,
  res: Response
) => {
  try {
    const id = String(req.params.id);

    if (!validId(id)) {
      fail(400, 'Invalid duty ID');
    }

    const active = req.body?.is_active;

    if (typeof active !== 'boolean') {
      fail(
        400,
        'is_active must be true or false'
      );
    }

    const result = await pool.query(
      `
      UPDATE volunteer_duties

      SET
        is_active = $1,
        updated_at = NOW()

      WHERE id = $2

      RETURNING *
      `,
      [active, id]
    );

    if (!result.rows.length) {
      fail(404, 'Volunteer duty not found');
    }

    return res.json({
      success: true,

      message: active
        ? 'Volunteer duty enabled'
        : 'Volunteer duty disabled',

      data: result.rows[0],
    });
  } catch (error) {
    return handleError(res, error);
  }
};