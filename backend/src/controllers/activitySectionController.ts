import { Request, Response } from 'express';
import { pool } from '../db';

/*
|--------------------------------------------------------------------------
| PUBLIC - Get Active Activity Sections
|--------------------------------------------------------------------------
*/

export const getActivitySections = async (
  _req: Request,
  res: Response
) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        name,
        description,
        icon,
        image_url,
        display_order,
        is_active
      FROM activity_sections
      WHERE is_active = TRUE
      ORDER BY display_order ASC, id ASC
    `);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error(
      'Error fetching activity sections:',
      error
    );

    res.status(500).json({
      success: false,
      message: 'Failed to fetch activity sections',
    });
  }
};

/*
|--------------------------------------------------------------------------
| PUBLIC - Get One Section
|--------------------------------------------------------------------------
*/

export const getActivitySectionById = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        id,
        name,
        description,
        icon,
        image_url,
        display_order,
        is_active
      FROM activity_sections
      WHERE id = $1
        AND is_active = TRUE
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Activity section not found',
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error(
      'Error fetching activity section:',
      error
    );

    res.status(500).json({
      success: false,
      message: 'Failed to fetch activity section',
    });
  }
};

/*
|--------------------------------------------------------------------------
| ADMIN - Get All Sections
|--------------------------------------------------------------------------
*/

export const getAdminActivitySections = async (
  _req: Request,
  res: Response
) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        name,
        description,
        icon,
        image_url,
        display_order,
        is_active,
        created_at,
        updated_at
      FROM activity_sections
      ORDER BY display_order ASC, id ASC
    `);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error(
      'Error fetching admin activity sections:',
      error
    );

    res.status(500).json({
      success: false,
      message: 'Failed to fetch activity sections',
    });
  }
};

/*
|--------------------------------------------------------------------------
| ADMIN - Create Section
|--------------------------------------------------------------------------
*/

export const createActivitySection = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      name,
      description,
      icon,
      image_url,
      display_order,
      is_active = true,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Section name is required',
      });
    }

    const result = await pool.query(
      `
      INSERT INTO activity_sections
      (
        name,
        description,
        icon,
        image_url,
        display_order,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING
        id,
        name,
        description,
        icon,
        image_url,
        display_order,
        is_active,
        created_at,
        updated_at
      `,
      [
        name.trim(),
        description?.trim() || null,
        icon?.trim() || null,
        image_url?.trim() || null,
        Number(display_order) || 0,
        Boolean(is_active),
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Activity section created successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error(
      'Error creating activity section:',
      error
    );

    res.status(500).json({
      success: false,
      message: 'Failed to create activity section',
    });
  }
};

/*
|--------------------------------------------------------------------------
| ADMIN - Update Section
|--------------------------------------------------------------------------
*/

export const updateActivitySection = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;

    const {
      name,
      description,
      icon,
      image_url,
      display_order,
      is_active,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Section name is required',
      });
    }

    const result = await pool.query(
      `
      UPDATE activity_sections
      SET
        name = $1,
        description = $2,
        icon = $3,
        image_url = $4,
        display_order = $5,
        is_active = $6,
        updated_at = NOW()
      WHERE id = $7
      RETURNING
        id,
        name,
        description,
        icon,
        image_url,
        display_order,
        is_active,
        created_at,
        updated_at
      `,
      [
        name.trim(),
        description?.trim() || null,
        icon?.trim() || null,
        image_url?.trim() || null,
        Number(display_order) || 0,
        typeof is_active === 'boolean'
          ? is_active
          : true,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Activity section not found',
      });
    }

    res.json({
      success: true,
      message: 'Activity section updated successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error(
      'Error updating activity section:',
      error
    );

    res.status(500).json({
      success: false,
      message: 'Failed to update activity section',
    });
  }
};

/*
|--------------------------------------------------------------------------
| ADMIN - Deactivate Section
|--------------------------------------------------------------------------
*/

export const deactivateActivitySection = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      UPDATE activity_sections
      SET
        is_active = FALSE,
        updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        name,
        description,
        icon,
        image_url,
        display_order,
        is_active
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Activity section not found',
      });
    }

    res.json({
      success: true,
      message: 'Activity section deactivated successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error(
      'Error deactivating activity section:',
      error
    );

    res.status(500).json({
      success: false,
      message: 'Failed to deactivate activity section',
    });
  }
};


/*
|--------------------------------------------------------------------------
| ADMIN - Permanently Delete Activity Section
|--------------------------------------------------------------------------
|
| Safety:
| - Only valid section IDs are accepted.
| - Sections containing activities cannot be deleted.
| - Existing activities are never automatically deleted.
| - Foreign key violations are handled safely.
|
*/

export const deleteActivitySection = async (
  req: Request,
  res: Response
) => {
  try {
    const sectionId = Number(req.params.id);

    if (
      !Number.isSafeInteger(sectionId) ||
      sectionId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid activity section ID',
      });
    }

    // Delete only when no activities reference this section.
    // The NOT EXISTS check is enforced in the database query.
    const result = await pool.query(
      `
      DELETE FROM activity_sections AS s
      WHERE s.id = $1
        AND NOT EXISTS (
          SELECT 1
          FROM activities AS a
          WHERE a.section_id = s.id
        )
      RETURNING s.id, s.name
      `,
      [sectionId]
    );

    if (result.rows.length > 0) {
      return res.status(200).json({
        success: true,
        message: 'Activity section permanently deleted',
        data: result.rows[0],
      });
    }

    // Determine whether the section exists or contains activities.
    const sectionResult = await pool.query(
      `
      SELECT
        s.id,
        (
          SELECT COUNT(*)::int
          FROM activities AS a
          WHERE a.section_id = s.id
        ) AS activity_count
      FROM activity_sections AS s
      WHERE s.id = $1
      `,
      [sectionId]
    );

    if (sectionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Activity section not found',
      });
    }

    return res.status(409).json({
      success: false,
      message:
        'Cannot delete this section because it contains ' +
        `${sectionResult.rows[0].activity_count} activities. ` +
        'Move or delete those activities first.',
    });
  } catch (error: unknown) {
    console.error('Error deleting activity section:', error);

    // PostgreSQL foreign key constraint violation
    if (
      error !== null &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === '23503'
    ) {
      return res.status(409).json({
        success: false,
        message:
          'This section is referenced by existing records ' +
          'and cannot be deleted.',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to delete activity section',
    });
  }
};
