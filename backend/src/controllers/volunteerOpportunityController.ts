import { Request, Response } from 'express';
import { pool } from '../db';
import { AuthRequest } from '../middleware/authMiddleware';
import {
  queueVolunteerRegistrationEvent,
} from '../services/volunteerRegistrationEventService';
// ========================================
// HELPERS
// ========================================

const validId = (id: string) =>
  /^[1-9]\d*$/.test(id) &&
  Number(id) <= 2147483647;

const validInteger = (
  value: unknown,
  minimum: number,
  maximum = 2147483647
): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= minimum &&
  value <= maximum;

const validDate = (value: unknown): value is string => {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const date = new Date(value + 'T00:00:00Z');

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
};

const validTimestamp = (
  value: unknown
): value is string => {
  if (typeof value !== 'string') return false;

  const match = value.match(
    /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/
  );

  if (!match || !validDate(match[1])) {
    return false;
  }

  if (
    Number(match[2]) > 23 ||
    Number(match[3]) > 59 ||
    Number(match[4] || 0) > 59
  ) {
    return false;
  }

  return !Number.isNaN(Date.parse(value));
};

const optionalText = (value: unknown) =>
  typeof value === 'string'
    ? value.trim() || null
    : null;

const badRequest = (
  res: Response,
  message: string
) =>
  res.status(400).json({
    success: false,
    message,
  });

const sendError = (
  res: Response,
  error: unknown
) => {
  console.error(
    'Volunteer Opportunity API error:',
    error
  );

  return res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
};

// ========================================
// AUTOMATIC REGISTRATION STATUS
// ========================================

const STATUS_SQL = `
  CASE
    WHEN o.is_published = FALSE
      THEN 'draft'

    WHEN o.registration_enabled = FALSE
      THEN 'closed'

    WHEN NOW() < o.registration_start_at
      THEN 'upcoming'

    WHEN NOW() >= o.registration_end_at
      THEN 'closed'

    WHEN (NOW() AT TIME ZONE 'Asia/Kolkata')::date
         > o.service_end_date
      THEN 'closed'

    ELSE 'open'
  END
`;

const ADMIN_SELECT = `
  SELECT
    o.*,

    o.service_start_date::text
      AS service_start_date,

    o.service_end_date::text
      AS service_end_date,

    ${STATUS_SQL} AS registration_status,

    (
      SELECT COUNT(*)::integer
      FROM volunteer_registrations r
      WHERE r.opportunity_id = o.id
      AND r.status NOT IN ('rejected', 'cancelled')
    ) AS total_registrations,

    (
      SELECT COALESCE(SUM(r.total_members), 0)::integer
      FROM volunteer_registrations r
      WHERE r.opportunity_id = o.id
      AND r.status NOT IN ('rejected', 'cancelled')
    ) AS registered_volunteers,

    (
      SELECT COUNT(*)::integer
      FROM volunteer_members m
      JOIN volunteer_registrations r
        ON r.id = m.registration_id
      WHERE m.opportunity_id = o.id
      AND m.status IN ('approved', 'completed')
      AND r.status NOT IN (
        'pending', 'rejected', 'cancelled'
      )
    ) AS approved_volunteers

  FROM volunteer_opportunities o
`;

const PUBLIC_SELECT = `
  SELECT
    o.id,
    o.title,
    o.description,
    o.instructions,
    o.image_url,

    o.registration_start_at,
    o.registration_end_at,

    o.service_start_date::text
      AS service_start_date,

    o.service_end_date::text
      AS service_end_date,

    o.required_volunteers,
    o.attendance_mode,
    o.accommodation_enabled,
    o.allow_individual,
    o.allow_group,
    o.minimum_group_size,
    o.maximum_group_size,

    ${STATUS_SQL} AS registration_status

  FROM volunteer_opportunities o
`;

// ========================================
// VALIDATE OPPORTUNITY
// ========================================

function validateOpportunity(body: any): string | null {
  if (
    typeof body.accommodation_enabled !== 'boolean'
  ) {
    return 'accommodation_enabled must be true or false';
  }
  if (
    !['legacy', 'simple', 'detailed', 'none']
      .includes(body.attendance_mode)
  ) {
    return 'Invalid attendance mode';
  }
  if (
    typeof body.title !== 'string' ||
    !body.title.trim() ||
    body.title.trim().length > 255
  ) {
    return 'Valid opportunity title is required';
  }

  for (const field of [
    'description',
    'instructions',
    'image_url',
  ]) {
    if (
      body[field] !== undefined &&
      body[field] !== null &&
      typeof body[field] !== 'string'
    ) {
      return `Invalid ${field}`;
    }
  }

  if (
    !validTimestamp(body.registration_start_at) ||
    !validTimestamp(body.registration_end_at)
  ) {
    return 'Valid registration timestamps with timezone are required';
  }

  if (
    Date.parse(body.registration_end_at) <=
    Date.parse(body.registration_start_at)
  ) {
    return 'Registration end must be after start';
  }

  if (
    !validDate(body.service_start_date) ||
    !validDate(body.service_end_date)
  ) {
    return 'Valid service dates are required';
  }

  if (
    body.service_end_date < body.service_start_date
  ) {
    return 'Service end date cannot be before start date';
  }

  const registrationEndLimit = Date.parse(
    body.service_end_date + 'T23:59:59.999+05:30'
  );

  if (
    Date.parse(body.registration_end_at) >
    registrationEndLimit
  ) {
    return 'Registration cannot end after the service period';
  }

  if (
    !validInteger(body.required_volunteers, 1)
  ) {
    return 'Required volunteers must be a positive integer';
  }

  if (
    typeof body.allow_individual !== 'boolean' ||
    typeof body.allow_group !== 'boolean'
  ) {
    return 'Registration types must be boolean values';
  }

  if (!body.allow_individual && !body.allow_group) {
    return 'At least one registration type must be enabled';
  }

  if (
    !validInteger(body.minimum_group_size, 2) ||
    !validInteger(body.maximum_group_size, 2)
  ) {
    return 'Invalid group size';
  }

  if (
    body.maximum_group_size <
    body.minimum_group_size
  ) {
    return 'Maximum group size cannot be below minimum group size';
  }

  return null;
}

// ========================================
// PUBLIC: AVAILABLE OPPORTUNITIES
// ========================================

export const getAvailableOpportunities = async (
  req: Request,
  res: Response
) => {
  try {
    const includeClosed =
      req.query.include_closed === 'true';
    res.setHeader('Cache-Control', 'no-store');
    const result = await pool.query(`
      ${PUBLIC_SELECT}

      WHERE o.is_published = TRUE
      AND (
        $1::boolean = TRUE
        OR (
          o.registration_enabled = TRUE
          AND NOW() < o.registration_end_at
          AND o.service_end_date >=
            (NOW() AT TIME ZONE 'Asia/Kolkata')::date
        )
      )

      ORDER BY
        o.registration_start_at ASC,
        o.id DESC
    `, [includeClosed]);

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// ========================================
// PUBLIC: OPPORTUNITY DETAILS
// ========================================

export const getOpportunityById = async (
  req: Request,
  res: Response
) => {
  try {
    const id = String(req.params.id);

    if (!validId(id)) {
      return badRequest(
        res,
        'Invalid opportunity ID'
      );
    }

    const result = await pool.query(
      `
      ${PUBLIC_SELECT}
      WHERE o.id = $1
      AND o.is_published = TRUE
      `,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: 'Volunteer opportunity not found',
      });
    }

    return res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// ========================================
// ADMIN: ALL OPPORTUNITIES
// ========================================

export const getAdminOpportunities = async (
  _req: Request,
  res: Response
) => {
  try {
    const result = await pool.query(`
      ${ADMIN_SELECT}
      ORDER BY o.created_at DESC, o.id DESC
    `);

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// ========================================
// ADMIN: OPPORTUNITY DETAILS
// ========================================

export const getAdminOpportunityById = async (
  req: Request,
  res: Response
) => {
  try {
    const id = String(req.params.id);

    if (!validId(id)) {
      return badRequest(
        res,
        'Invalid opportunity ID'
      );
    }

    const result = await pool.query(
      `
      ${ADMIN_SELECT}
      WHERE o.id = $1
      `,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: 'Opportunity not found',
      });
    }

    return res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// ========================================
// ADMIN: CREATE OPPORTUNITY
// ========================================

export const createOpportunity = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const body = {
      ...(req.body ?? {}),

      allow_individual:
        req.body?.allow_individual ?? true,

      allow_group:
        req.body?.allow_group ?? true,

      minimum_group_size:
        req.body?.minimum_group_size ?? 10,

      maximum_group_size:
        req.body?.maximum_group_size ?? 100,
      attendance_mode:
        req.body?.attendance_mode ?? 'legacy',
      accommodation_enabled:
        req.body?.accommodation_enabled === undefined
          ? false
          : req.body.accommodation_enabled,
    };

    const validation = validateOpportunity(body);

    if (validation) {
      return badRequest(res, validation);
    }

    const result = await pool.query(
      `
      INSERT INTO volunteer_opportunities (
        title,
        description,
        instructions,
        image_url,
        registration_start_at,
        registration_end_at,
        service_start_date,
        service_end_date,
        required_volunteers,
        allow_individual,
        allow_group,
        minimum_group_size,
        maximum_group_size,
        is_published,
        registration_enabled,
        created_by,
        attendance_mode,
        accommodation_enabled
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,
        $9,$10,$11,$12,$13,
        FALSE,FALSE,$14,$15,$16
      )
      RETURNING *
      `,
      [
        body.title.trim(),
        optionalText(body.description),
        optionalText(body.instructions),
        optionalText(body.image_url),

        body.registration_start_at,
        body.registration_end_at,

        body.service_start_date,
        body.service_end_date,

        body.required_volunteers,
        body.allow_individual,
        body.allow_group,

        body.minimum_group_size,
        body.maximum_group_size,

        req.user!.userId,
        body.attendance_mode,
        body.accommodation_enabled,
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Volunteer opportunity created successfully',
      data: result.rows[0],
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// ========================================
// ADMIN: UPDATE OPPORTUNITY
// ========================================

const EDITABLE_FIELDS = [
  'title',
  'description',
  'instructions',
  'image_url',
  'registration_start_at',
  'registration_end_at',
  'service_start_date',
  'service_end_date',
  'required_volunteers',
  'allow_individual',
  'allow_group',
  'minimum_group_size',
  'maximum_group_size',
  'attendance_mode',
  'accommodation_enabled',
];

export const updateOpportunity = async (
  req: Request,
  res: Response
) => {
  const id = String(req.params.id);

  if (!validId(id)) {
    return badRequest(res, 'Invalid opportunity ID');
  }

  const body = req.body ?? {};

  const provided = EDITABLE_FIELDS.filter(
    field => body[field] !== undefined
  );

  if (!provided.length) {
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

    const existing = await client.query(
      `
      SELECT *,
        service_start_date::text AS service_start_date,
        service_end_date::text AS service_end_date
      FROM volunteer_opportunities
      WHERE id = $1
      FOR UPDATE
      `,
      [id]
    );

    if (!existing.rows.length) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        success: false,
        message: 'Opportunity not found',
      });
    }

    const current = existing.rows[0];

    const merged = {
      ...current,

      registration_start_at:
        new Date(current.registration_start_at).toISOString(),

      registration_end_at:
        new Date(current.registration_end_at).toISOString(),
    };

    for (const field of provided) {
      merged[field] = body[field];
    }

    const validation = validateOpportunity(merged);

    if (validation) {
      await client.query('ROLLBACK');
      return badRequest(res, validation);
    }

    // Accommodation cannot be disabled while
    // existing allocation records are present.
    // The opportunity row is already locked.
    if (
      current.accommodation_enabled === true &&
      merged.accommodation_enabled === false
    ) {
      const existingAllocations =
        await client.query(
          `
          SELECT id
          FROM volunteer_accommodation
          WHERE opportunity_id = $1
          LIMIT 1
          `,
          [id]
        );
      if (existingAllocations.rows.length) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          message:
            'Accommodation cannot be disabled because this programme has existing accommodation allocations',
        });
      }
    }
    // Attendance mode cannot change after registration.
    if (
      merged.attendance_mode !== current.attendance_mode
    ) {
      const registrations = await client.query(
        `
        SELECT id
        FROM volunteer_registrations
        WHERE opportunity_id = $1
        LIMIT 1
        `,
        [id]
      );
      if (registrations.rows.length) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          message:
            'Attendance mode cannot change after volunteers have registered',
        });
      }
    }
    // Preserve dates already selected by volunteers.
    const invalidServiceDates = await client.query(
      `
      SELECT id
      FROM volunteer_service_dates
      WHERE opportunity_id = $1
        AND (
          service_date < $2::date
          OR service_date > $3::date
        )
      LIMIT 1
      `,
      [
        id,
        merged.service_start_date,
        merged.service_end_date,
      ]
    );
    if (invalidServiceDates.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message:
          'Service dates cannot exclude dates selected by volunteers',
      });
    }
    // Existing shifts must remain within service dates.

    const invalidShifts = await client.query(
      `
      SELECT id
      FROM volunteer_shifts
      WHERE opportunity_id = $1
      AND (
        service_date < $2::date
        OR service_date > $3::date
      )
      LIMIT 1
      `,
      [
        id,
        merged.service_start_date,
        merged.service_end_date,
      ]
    );

    if (invalidShifts.rows.length) {
      await client.query('ROLLBACK');

      return res.status(409).json({
        success: false,
        message:
          'Service dates cannot exclude existing service shifts',
      });
    }

    const values = provided.map(field => {
      if (field === 'title') {
        return merged[field].trim();
      }

      if (
        ['description', 'instructions', 'image_url']
          .includes(field)
      ) {
        return optionalText(merged[field]);
      }

      return merged[field];
    });

    const assignments = provided.map(
      (field, index) =>
        `${field} = $${index + 1}`
    );

    const result = await client.query(
      `
      UPDATE volunteer_opportunities
      SET
        ${assignments.join(', ')},
        updated_at = NOW()
      WHERE id = $${values.length + 1}
      RETURNING *
      `,
      [...values, id]
    );

   const updatedOpportunity =
  result.rows[0];

// Compare previous and updated deadlines.

const previousDeadline =
  new Date(
    current.registration_end_at
  ).getTime();

const updatedDeadline =
  new Date(
    updatedOpportunity.registration_end_at
  ).getTime();

// Handle extensions performed through
// the general opportunity editing endpoint.

if (updatedDeadline > previousDeadline) {

  await queueVolunteerRegistrationEvent(

    Number(id),

    'registration_extended',

    client
  );
}

await client.query('COMMIT');

return res.json({

  success: true,

  message:
    'Opportunity updated successfully',

  data: updatedOpportunity,
});
  } catch (error) {
    await client.query('ROLLBACK').catch(console.error);

    return sendError(res, error);
  } finally {
    client.release();
  }
};

// ========================================
// ADMIN: PUBLISH / UNPUBLISH
// ========================================

export const updateOpportunityPublishStatus = async (
  req: Request,
  res: Response
) => {
  try {
    const id = String(req.params.id);

    if (!validId(id)) {
      return badRequest(res, 'Invalid opportunity ID');
    }

    const published = req.body?.is_published;

    if (typeof published !== 'boolean') {
      return badRequest(
        res,
        'is_published must be true or false'
      );
    }

    const result = await pool.query(
      `
      UPDATE volunteer_opportunities
      SET
        is_published = $1,

        registration_enabled = CASE
          WHEN $1 = FALSE THEN FALSE
          ELSE registration_enabled
        END,

        updated_at = NOW()

      WHERE id = $2
      RETURNING *
      `,
      [published, id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: 'Opportunity not found',
      });
    }

    return res.json({
      success: true,

      message: published
        ? 'Opportunity published'
        : 'Opportunity unpublished',

      data: result.rows[0],
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// ========================================
// ADMIN: OPEN / CLOSE REGISTRATION
// ========================================

 export const updateRegistrationStatus = async (
  req: Request,
  res: Response
) => {
  const id = String(req.params.id);

  if (!validId(id)) {
    return badRequest(
      res,
      'Invalid opportunity ID'
    );
  }

  const enabled =
    req.body?.registration_enabled;

  if (typeof enabled !== 'boolean') {
    return badRequest(
      res,
      'registration_enabled must be true or false'
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

    // Lock the opportunity before updating.

    const existing = await client.query(
      `
      SELECT *

      FROM volunteer_opportunities

      WHERE id = $1

      FOR UPDATE
      `,
      [id]
    );

    if (!existing.rows.length) {

      await client.query('ROLLBACK');

      return res.status(404).json({
        success: false,
        message: 'Opportunity not found',
      });
    }

    const previous =
      existing.rows[0];

    // Preserve existing eligibility rules.

    const result = await client.query(
      `
      UPDATE volunteer_opportunities o

      SET

        registration_enabled = $1,

        updated_at = NOW()

      WHERE o.id = $2

        AND (

          $1 = FALSE

          OR (

            o.is_published = TRUE

            AND o.registration_end_at > NOW()

            AND o.service_end_date >= (
              clock_timestamp()
              AT TIME ZONE 'Asia/Kolkata'
            )::date
          )
        )

      RETURNING *
      `,
      [
        enabled,
        id,
      ]
    );

    if (!result.rows.length) {

      await client.query('ROLLBACK');

      return res.status(409).json({
        success: false,
        message:
          'Publish the opportunity and ensure the registration deadline and service dates are valid',
      });
    }

    const updatedOpportunity =
      result.rows[0];

    // Queue notification only when registration
    // changes from disabled to enabled.

    if (
      enabled &&
      !previous.registration_enabled
    ) {

      await queueVolunteerRegistrationEvent(

        Number(id),

        'registration_opened',

        client
      );
    }

    // Commit opportunity and notification
    // job together.

    await client.query('COMMIT');

    return res.json({

      success: true,

      message: enabled

        ? 'Registration enabled for the configured period'

        : 'Registration closed successfully',

      data: updatedOpportunity,
    });

  } catch (error) {

    await client.query('ROLLBACK')
      .catch(console.error);

    return sendError(res, error);

  } finally {

    client.release();
  }
};

// ========================================
// ADMIN: EXTEND REGISTRATION DEADLINE
// ========================================

export const extendRegistrationDeadline = async (
  req: Request,
  res: Response
) => {

  const id = String(req.params.id);

  if (!validId(id)) {
    return badRequest(
      res,
      'Invalid opportunity ID'
    );
  }

  const endAt =
    req.body?.registration_end_at;

  if (!validTimestamp(endAt)) {

    return badRequest(
      res,
      'Valid registration end timestamp is required'
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

    // Lock current opportunity.

    const existing = await client.query(
      `
      SELECT *

      FROM volunteer_opportunities

      WHERE id = $1

      FOR UPDATE
      `,
      [id]
    );

    if (!existing.rows.length) {

      await client.query('ROLLBACK');

      return res.status(404).json({
        success: false,
        message: 'Opportunity not found',
      });
    }

    // Preserve existing deadline validation.

    const result = await client.query(
      `
      UPDATE volunteer_opportunities

      SET

        registration_end_at =
          $1::timestamptz,

        updated_at = NOW()

      WHERE id = $2

        AND $1::timestamptz >
          registration_end_at

        AND $1::timestamptz > NOW()

        AND $1::timestamptz < (

          (service_end_date + 1)::timestamp

          AT TIME ZONE 'Asia/Kolkata'
        )

      RETURNING *
      `,
      [
        endAt,
        id,
      ]
    );

    if (!result.rows.length) {

      await client.query('ROLLBACK');

      return badRequest(
        res,
        'New deadline must be later than the current deadline and within the service period'
      );
    }

    const updatedOpportunity =
      result.rows[0];

    // Persist extension notification
    // inside the same transaction.

    await queueVolunteerRegistrationEvent(

      Number(id),

      'registration_extended',

      client
    );

    await client.query('COMMIT');

    return res.json({

      success: true,

      message:
        'Registration deadline extended successfully',

      data: updatedOpportunity,
    });

  } catch (error) {

    await client.query('ROLLBACK')
      .catch(console.error);

    return sendError(res, error);

  } finally {

    client.release();
  }
};