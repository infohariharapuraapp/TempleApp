
import { Request, Response } from 'express';
import { pool } from '../db';

const VALID_STATUSES = ['upcoming', 'ongoing', 'completed'];

const FIELDS = [
  'title',
  'description',
  'image_url',
  'youtube_url',
  'start_date',
  'start_time',
  'end_date',
  'end_time',
  'venue',
  'status',
  'is_published',
];

const normalize = (value: unknown) =>
  value === '' ? null : value;

const validId = (id: string) =>
  /^[1-9]\d*$/.test(id);

const sendError = (res: Response, error: unknown) => {
  console.error('Mahaswamiji Programme API error:', error);
  return res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
};

// PUBLIC: published programmes
export const getPublishedProgrammes = async (
  req: Request,
  res: Response
) => {
  try {
    const status = req.query.status;

    if (
      status !== undefined &&
      (typeof status !== 'string' ||
        !VALID_STATUSES.includes(status))
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid programme status',
      });
    }

    const result = await pool.query(
      `SELECT * FROM mahaswamiji_programmes
       WHERE is_published = TRUE
       AND ($1::text IS NULL OR status = $1)
       ORDER BY created_at DESC, id DESC`,
      [status || null]
    );

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// PUBLIC: one published programme
export const getPublishedProgrammeById = async (
  req: Request,
  res: Response
) => {
  try {
    const id = String(req.params.id);

    if (!validId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid programme ID',
      });
    }

    const result = await pool.query(
      `SELECT * FROM mahaswamiji_programmes
       WHERE id = $1 AND is_published = TRUE`,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: 'Programme not found',
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

// ADMIN: all programmes
export const getAdminProgrammes = async (
  _req: Request,
  res: Response
) => {
  try {
    const result = await pool.query(
      `SELECT * FROM mahaswamiji_programmes
       ORDER BY created_at DESC, id DESC`
    );

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// ADMIN: create programme
export const createProgramme = async (
  req: Request,
  res: Response
) => {
  try {
    const body = req.body ?? {};

    if (
      typeof body.title !== 'string' ||
      !body.title.trim() ||
      body.title.length > 255 ||
      typeof body.description !== 'string' ||
      !body.description.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: 'Valid title and description are required',
      });
    }

    const status = body.status ?? 'upcoming';

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid programme status',
      });
    }

    if (
      body.is_published !== undefined &&
      typeof body.is_published !== 'boolean'
    ) {
      return res.status(400).json({
        success: false,
        message: 'is_published must be a boolean',
      });
    }

    const values = [
      body.title.trim(),
      body.description.trim(),
      normalize(body.image_url),
      normalize(body.youtube_url),
      normalize(body.start_date),
      normalize(body.start_time),
      normalize(body.end_date),
      normalize(body.end_time),
      normalize(body.venue),
      status,
      body.is_published ?? false,
    ];

    const result = await pool.query(
      `INSERT INTO mahaswamiji_programmes
       (${FIELDS.join(', ')})
       VALUES (${FIELDS.map((_, i) => `$${i + 1}`).join(', ')})
       RETURNING *`,
      values
    );

    return res.status(201).json({
      success: true,
      message: 'Programme created successfully',
      data: result.rows[0],
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// ADMIN: update programme
export const updateProgramme = async (
  req: Request,
  res: Response
) => {
  try {
    const id = String(req.params.id);

    if (!validId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid programme ID',
      });
    }

    const body = req.body ?? {};

    if (
      body.title !== undefined &&
      (typeof body.title !== 'string' ||
        !body.title.trim() ||
        body.title.length > 255)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid title',
      });
    }

    if (
      body.description !== undefined &&
      (typeof body.description !== 'string' ||
        !body.description.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid description',
      });
    }

    if (
      body.status !== undefined &&
      !VALID_STATUSES.includes(body.status)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status',
      });
    }

    if (
      body.is_published !== undefined &&
      typeof body.is_published !== 'boolean'
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid publication value',
      });
    }

    const provided = FIELDS.filter(
      (field) => body[field] !== undefined
    );

    if (!provided.length) {
      return res.status(400).json({
        success: false,
        message: 'No fields provided',
      });
    }

    const values = provided.map((field) => {
      const value = body[field];

      if (
        (field === 'title' || field === 'description') &&
        typeof value === 'string'
      ) {
        return value.trim();
      }

      return normalize(value);
    });

    const assignments = provided.map(
      (field, index) => `${field} = $${index + 1}`
    );

    const result = await pool.query(
      `UPDATE mahaswamiji_programmes
       SET ${assignments.join(', ')},
           updated_at = NOW()
       WHERE id = $${values.length + 1}
       RETURNING *`,
      [...values, id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: 'Programme not found',
      });
    }

    return res.json({
      success: true,
      message: 'Programme updated successfully',
      data: result.rows[0],
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// ADMIN: publish or unpublish
export const updateProgrammePublishStatus = async (
  req: Request,
  res: Response
) => {
  try {
    const id = String(req.params.id);

    if (!validId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid programme ID',
      });
    }

    if (typeof req.body?.is_published !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'is_published must be true or false',
      });
    }

    const result = await pool.query(
      `UPDATE mahaswamiji_programmes
       SET is_published = $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [req.body.is_published, id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: 'Programme not found',
      });
    }

    return res.json({
      success: true,
      message: 'Publication status updated',
      data: result.rows[0],
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// ADMIN: delete programme
export const deleteProgramme = async (
  req: Request,
  res: Response
) => {
  try {
    const id = String(req.params.id);

    if (!validId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid programme ID',
      });
    }

    const result = await pool.query(
      `DELETE FROM mahaswamiji_programmes
       WHERE id = $1 RETURNING id`,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: 'Programme not found',
      });
    }

    return res.json({
      success: true,
      message: 'Programme deleted successfully',
    });
  } catch (error) {
    return sendError(res, error);
  }
};
