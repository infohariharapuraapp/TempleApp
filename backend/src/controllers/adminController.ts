import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { pool } from '../db';
import {
  createNotification,
  sendNotificationRecord,
} from '../services/notificationService';

/* =========================================================
   DASHBOARD
========================================================= */

export const getDashboardSummary = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const usersResult = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM users
       WHERE role = 'devotee'`
    );

    const roomsResult = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM rooms
       WHERE is_active = TRUE`
    );

    const pendingRoomBookingsResult = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM room_bookings
       WHERE booking_status = 'pending'`
    );

    const confirmedRoomBookingsResult = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM room_bookings
       WHERE booking_status = 'confirmed'`
    );

    const pendingServiceBookingsResult = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM service_bookings
       WHERE booking_status = 'pending'`
    );

    const confirmedServiceBookingsResult = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM service_bookings
       WHERE booking_status = 'confirmed'`
    );

    return res.json({
      success: true,
      data: {
        total_devotees: usersResult.rows[0].count,
        total_rooms: roomsResult.rows[0].count,
        pending_room_bookings:
          pendingRoomBookingsResult.rows[0].count,
        confirmed_room_bookings:
          confirmedRoomBookingsResult.rows[0].count,
        pending_service_bookings:
          pendingServiceBookingsResult.rows[0].count,
        confirmed_service_bookings:
          confirmedServiceBookingsResult.rows[0].count,
      },
    });
  } catch (error) {
    console.error('Dashboard summary error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard summary',
    });
  }
};

/* =========================================================
   USERS
========================================================= */

export const getAllUsers = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const result = await pool.query(
      `SELECT
         id,
         full_name,
         email,
         phone,
         role,
         created_at,
         updated_at
       FROM users
       ORDER BY created_at DESC`
    );

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get all users error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
    });
  }
};

export const getUserById = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT
         id,
         full_name,
         email,
         phone,
         role,
         created_at,
         updated_at
       FROM users
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    return res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Get user by ID error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch user',
    });
  }
};

export const updateUser = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { id } = req.params;

    const {
      full_name,
      email,
      phone,
      role,
    } = req.body;

    if (!full_name || !email || !role) {
      return res.status(400).json({
        success: false,
        message: 'Full name, email and role are required',
      });
    }

    const allowedRoles = [
      'devotee',
      'admin',
    ];

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role',
      });
    }

    const result = await pool.query(
      `UPDATE users
       SET
         full_name = $1,
         email = $2,
         phone = $3,
         role = $4,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING
         id,
         full_name,
         email,
         phone,
         role,
         created_at,
         updated_at`,
      [
        full_name,
        email,
        phone || null,
        role,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    return res.json({
      success: true,
      message: 'User updated successfully',
      data: result.rows[0],
    });
  } catch (error: any) {
    console.error('Update user error:', error);

    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'Email or phone already registered',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to update user',
    });
  }
};


/* =========================================================
   EVENTS
========================================================= */

/**
 * Create a scheduled event reminder.
 *
 * Reminder time:
 * 24 hours before event start.
 *
 * If the event has no start_time,
 * 09:00 AM is used as the default event time.
 */
async function createEventReminderNotification(
  event: any
) {
  try {
    const eventTime =
      event.start_time || '09:00:00';

    /*
     * Temple timezone is treated as IST (+05:30).
     */
    const eventDateTime = new Date(
      `${event.event_date}T${eventTime}+05:30`
    );

    if (Number.isNaN(eventDateTime.getTime())) {
      console.error(
        'Invalid event date/time for reminder:',
        event.event_date,
        event.start_time
      );

      return null;
    }

    const reminderTime = new Date(
      eventDateTime.getTime() -
        24 * 60 * 60 * 1000
    );

    /*
     * If the reminder time has already passed,
     * don't create a scheduled reminder.
     */
    if (reminderTime <= new Date()) {
      console.log(
        `Reminder time already passed for event ${event.id}`
      );

      return null;
    }

    const notification =
      await createNotification({
        title: `🔔 Reminder: ${event.title}`,
        body:
          `Tomorrow's event is "${event.title}"` +
          `${
            event.start_time
              ? ` at ${event.start_time}`
              : ''
          }${
            event.location
              ? ` at ${event.location}`
              : ''
          }.`,
        notificationType:
          'event_reminder',
        data: {
          type: 'event_reminder',
          eventId: event.id,
          screen: '/events',
        },
        targetType: 'all',
        scheduledAt: reminderTime,
      });

    console.log(
      `Event reminder scheduled for event ${event.id}:`,
      reminderTime.toISOString()
    );

    return notification;
  } catch (error) {
    console.error(
      'Create event reminder notification error:',
      error
    );

    return null;
  }
}


/**
 * GET ALL EVENTS FOR ADMIN
 */

export const getAllEvents = async (
  _req: AuthRequest,
  res: Response
) => {
  try {
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
         e.is_active,
         e.created_at,
         e.updated_at
       FROM events e
       LEFT JOIN event_categories c
         ON e.category_id = c.id
       ORDER BY
         e.event_date ASC NULLS LAST,
         e.start_time ASC NULLS LAST,
         e.id ASC`
    );

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get all events error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch events',
    });
  }
};


/**
 * CREATE EVENT
 */

export const createEvent = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const {
      title,
      description,
      image_url,
      event_date,
      start_time,
      end_time,
      location,
      category_id,
    } = req.body;

    if (
      typeof title !== 'string' ||
      !title.trim() ||
      typeof event_date !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(event_date)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Valid title and event date are required',
      });
    }

    if (
      !Number.isSafeInteger(category_id) ||
      category_id <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'Valid event category is required',
      });
    }

    const categoryResult = await pool.query(
      `SELECT id
       FROM event_categories
       WHERE id = $1 AND is_active = TRUE`,
      [category_id]
    );

    if (categoryResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Selected event category is unavailable',
      });
    }

    const result = await pool.query(
      `INSERT INTO events (
         title,
         description,
         image_url,
         event_date,
         start_time,
         end_time,
         location,
         category_id,
         is_active
       )
       VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, $8, TRUE
       )
       RETURNING
         id,
         title,
         description,
         image_url,
         event_date,
         start_time,
         end_time,
         location,
         category_id,
         is_active,
         created_at,
         updated_at`,
      [
        title.trim(),
        description || null,
        image_url || null,
        event_date,
        start_time || null,
        end_time || null,
        location || null,
        category_id,
      ]
    );

    const event = result.rows[0];

    // SEND NEW EVENT NOTIFICATION
    try {
      const notification = await createNotification({
        title: `📅 ${event.title}`,
        body:
          `New event: ${event.title}` +
          `${
            event.start_time
              ? ` on ${event.event_date} at ${event.start_time}`
              : ` on ${event.event_date}`
          }${
            event.location
              ? ` at ${event.location}`
              : ''
          }.`,
        notificationType: 'event',
        data: {
          type: 'event',
          eventId: event.id,
          screen: '/events',
        },
        targetType: 'all',
        scheduledAt: null,
      });

      await sendNotificationRecord(notification.id);
    } catch (notificationError) {
      console.error(
        'Event notification error:',
        notificationError
      );
    }

    // SCHEDULE 24-HOUR EVENT REMINDER
    await createEventReminderNotification(event);

    return res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: event,
    });
  } catch (error) {
    console.error('Create event error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to create event',
    });
  }
};



/**
 * UPDATE EVENT
 */

export const updateEvent = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { id } = req.params;

    const {
      title,
      description,
      image_url,
      event_date,
      start_time,
      end_time,
      location,
      category_id,
    } = req.body;

    if (
      typeof title !== 'string' ||
      !title.trim() ||
      typeof event_date !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(event_date)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Valid title and event date are required',
      });
    }

    const existingResult = await pool.query(
      `SELECT id, category_id, is_active
       FROM events
       WHERE id = $1`,
      [id]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    const selectedCategoryId =
      category_id === undefined
        ? existingResult.rows[0].category_id
        : category_id;

    if (
      !Number.isSafeInteger(selectedCategoryId) ||
      selectedCategoryId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'Valid event category is required',
      });
    }

    const categoryResult = await pool.query(
      `SELECT id
       FROM event_categories
       WHERE id = $1
         AND (is_active = TRUE OR id = $2)`,
      [
        selectedCategoryId,
        existingResult.rows[0].category_id,
      ]
    );

    if (categoryResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Selected event category is unavailable',
      });
    }

    const result = await pool.query(
      `UPDATE events
       SET
         title = $1,
         description = $2,
         image_url = $3,
         event_date = $4,
         start_time = $5,
         end_time = $6,
         location = $7,
         category_id = $8,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $9
       RETURNING
         id,
         title,
         description,
         image_url,
         event_date,
         start_time,
         end_time,
         location,
         category_id,
         is_active,
         created_at,
         updated_at`,
      [
        title.trim(),
        description || null,
        image_url || null,
        event_date,
        start_time || null,
        end_time || null,
        location || null,
        selectedCategoryId,
        id,
      ]
    );

    const event = result.rows[0];

    // CANCEL PREVIOUS SCHEDULED REMINDERS
    await pool.query(
      `UPDATE notifications
       SET
         status = 'cancelled',
         updated_at = CURRENT_TIMESTAMP
       WHERE notification_type = 'event_reminder'
         AND data->>'eventId' = $1
         AND status = 'scheduled'`,
      [String(id)]
    );

    // SCHEDULE NEW REMINDER IF PUBLISHED
    if (event.is_active) {
      await createEventReminderNotification(event);
    }

    return res.json({
      success: true,
      message: 'Event updated successfully',
      data: event,
    });
  } catch (error) {
    console.error('Update event error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to update event',
    });
  }
};


/**
 * UPDATE EVENT STATUS
 */
export const updateEventStatus = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { id } = req.params;

    const { is_active } = req.body;

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({
        success: false,
        message:
          'is_active must be true or false',
      });
    }


    /*
     * Get current status before updating.
     */
    const existingResult =
      await pool.query(
        `
        SELECT
          id,
          title,
          event_date,
          start_time,
          is_active
        FROM events
        WHERE id = $1
        `,
        [id]
      );

    if (
      existingResult.rows.length === 0
    ) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    const previousEvent =
      existingResult.rows[0];


    /*
     * Update status
     */
    const result = await pool.query(
      `
      UPDATE events
      SET
        is_active = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING
        id,
        title,
        description,
        image_url,
        event_date,
        start_time,
        end_time,
        location,
        is_active,
        created_at,
        updated_at
      `,
      [is_active, id]
    );

    const event = result.rows[0];


    /*
     * -------------------------------------------------------
     * EVENT DEACTIVATED
     * -------------------------------------------------------
     *
     * Cancel any pending reminder.
     */
    if (!is_active) {
      await pool.query(
        `
        UPDATE notifications
        SET
          status = 'cancelled',
          updated_at = CURRENT_TIMESTAMP
        WHERE notification_type = 'event_reminder'
          AND data->>'eventId' = $1
          AND status = 'scheduled'
        `,
        [String(id)]
      );
    }


    /*
     * -------------------------------------------------------
     * EVENT REACTIVATED
     * -------------------------------------------------------
     *
     * If event changes from inactive -> active,
     * create a fresh reminder.
     */
    if (
      previousEvent.is_active === false &&
      is_active === true
    ) {
      await createEventReminderNotification(
        event
      );
    }


    return res.json({
      success: true,
      message:
        'Event status updated successfully',
      data: event,
    });

  } catch (error) {
    console.error(
      'Update event status error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Failed to update event status',
    });
  }
};