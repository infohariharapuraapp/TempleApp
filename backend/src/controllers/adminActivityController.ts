import { Request, Response } from 'express';
import { pool } from '../db';

export const getAdminActivities = async (
  _req: Request,
  res: Response
) => {
  try {
    const result = await pool.query(
      `SELECT
         a.id,
         a.title,
         a.description,
         a.image_url,
         a.activity_date,
         a.location,
         a.section_id,
         a.display_order,
         a.is_active,
         a.created_at,
         a.updated_at,
         s.name AS section_name
       FROM activities a
       LEFT JOIN activity_sections s
         ON a.section_id = s.id
       ORDER BY
         s.display_order ASC NULLS LAST,
         a.display_order ASC,
         a.activity_date ASC NULLS LAST,
         a.id ASC`
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Error fetching admin activities:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to fetch activities',
    });
  }
};

export const createActivity = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      title,
      description,
      image_url,
      activity_date,
      location,
      section_id,
      display_order,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Activity title is required',
      });
    }

    if (!section_id) {
      return res.status(400).json({
        success: false,
        message: 'Activity section is required',
      });
    }

    // Check whether the selected section exists and is active
    const sectionResult = await pool.query(
      `SELECT id
       FROM activity_sections
       WHERE id = $1
         AND is_active = TRUE`,
      [section_id]
    );

    if (sectionResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Selected activity section not found or inactive',
      });
    }

    const result = await pool.query(
      `INSERT INTO activities
       (
         title,
         description,
         image_url,
         activity_date,
         location,
         section_id,
         display_order,
         is_active
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
       RETURNING
         id,
         title,
         description,
         image_url,
         activity_date,
         location,
         section_id,
         display_order,
         is_active,
         created_at,
         updated_at`,
      [
        title.trim(),
        description?.trim() || null,
        image_url?.trim() || null,
        activity_date || null,
        location?.trim() || null,
        section_id,
        Number(display_order) || 0,
      ]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error creating activity:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to create activity',
    });
  }
};

export const updateActivity = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;

    const {
      title,
      description,
      image_url,
      activity_date,
      location,
      section_id,
      display_order,
      is_active,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Activity title is required',
      });
    }

    if (!section_id) {
      return res.status(400).json({
        success: false,
        message: 'Activity section is required',
      });
    }

    // Check whether the selected section exists and is active
    const sectionResult = await pool.query(
      `SELECT id
       FROM activity_sections
       WHERE id = $1
         AND is_active = TRUE`,
      [section_id]
    );

    if (sectionResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Selected activity section not found or inactive',
      });
    }

    const result = await pool.query(
      `UPDATE activities
       SET
         title = $1,
         description = $2,
         image_url = $3,
         activity_date = $4,
         location = $5,
         section_id = $6,
         display_order = $7,
         is_active = $8,
         updated_at = NOW()
       WHERE id = $9
       RETURNING
         id,
         title,
         description,
         image_url,
         activity_date,
         location,
         section_id,
         display_order,
         is_active,
         created_at,
         updated_at`,
      [
        title.trim(),
        description?.trim() || null,
        image_url?.trim() || null,
        activity_date || null,
        location?.trim() || null,
        section_id,
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
        message: 'Activity not found',
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error updating activity:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to update activity',
    });
  }
};

export const deactivateActivity = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE activities
       SET
         is_active = FALSE,
         updated_at = NOW()
       WHERE id = $1
       RETURNING
         id,
         title,
         description,
         image_url,
         activity_date,
         location,
         section_id,
         display_order,
         is_active,
         created_at,
         updated_at`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Activity not found',
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error deactivating activity:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to deactivate activity',
    });
  }
};


export const deleteActivity = async (
  req: Request,
  res: Response
) => {
  try {
    const activityId = Number(req.params.id);

    if (
      !Number.isSafeInteger(activityId) ||
      activityId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid activity ID',
      });
    }

    const result = await pool.query(
      `DELETE FROM activities
       WHERE id = $1
       RETURNING id, title`,
      [activityId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Activity not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Activity permanently deleted',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error deleting activity:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to delete activity',
    });
  }
};
