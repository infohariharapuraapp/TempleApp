
import { Request, Response } from 'express';
import { pool } from '../db';

// ========================================
// GET PUBLIC EVENTS
// ========================================

export const getEvents = async (
  req: Request,
  res: Response
) => {
  try {
    const { type, category_id } = req.query;

    // Validate event type
    if (
      type !== undefined &&
      type !== 'upcoming' &&
      type !== 'past'
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid event type',
      });
    }

    // Validate category ID
    let categoryId: number | null = null;

    if (category_id !== undefined) {
      if (
        typeof category_id !== 'string' ||
        !/^[1-9]\d*$/.test(category_id)
      ) {
        return res.status(400).json({
          success: false,
          message: 'Invalid category ID',
        });
      }

      categoryId = Number(category_id);

      if (!Number.isSafeInteger(categoryId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid category ID',
        });
      }
    }

    // Use temple timezone for date comparison
    const todayExpression =
      "(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date";

    const conditions: string[] = [
      'e.is_active = TRUE',
      'c.is_active = TRUE',
    ];

    const values: unknown[] = [];

    // Default: Upcoming events
    if (type === 'past') {
      conditions.push(
        `e.event_date < ${todayExpression}`
      );
    } else {
      conditions.push(
        `e.event_date >= ${todayExpression}`
      );
    }

    // Optional category filter
    if (categoryId !== null) {
      values.push(categoryId);

      conditions.push(
        `e.category_id = $${values.length}`
      );
    }

    const sortDirection =
      type === 'past' ? 'DESC' : 'ASC';

    const result = await pool.query(
      `SELECT
         e.id,
         e.title,
         e.description,
         e.image_url,
         e.event_date,
         e.start_time,
         e.end_time,
         e.location,
         e.category_id,
         c.name AS category_name,
         e.is_active
       FROM events e
       INNER JOIN event_categories c
         ON e.category_id = c.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY
         e.event_date ${sortDirection},
         e.start_time ${sortDirection} NULLS LAST,
         e.id ${sortDirection}`,
      values
    );

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get events error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch events',
    });
  }
};
