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
      `${typeof event.event_date === 'string' ? event.event_date.slice(0, 10) : new Date(event.event_date).toISOString().slice(0, 10)}T${eventTime}+05:30`
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
 * Validate event input. Images are Cloudinary URLs returned by
 * the authenticated /admin/events/upload-images endpoint.
 */
function parseEventInput(body: Record<string, unknown>) {
  const title = body.title;
  const eventDate = body.event_date;
  const endDate = body.event_end_date === '' || body.event_end_date == null
    ? null : body.event_end_date;
  const dateValid = (value: unknown): value is string => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  if (typeof title !== 'string' || !title.trim() || !dateValid(eventDate)) {
    throw new Error('Valid title and event date are required');
  }
  if (endDate !== null && (!dateValid(endDate) || endDate < eventDate)) {
    throw new Error('End date must be on or after the event date');
  }
  for (const field of ['description', 'location', 'image_url', 'start_time', 'end_time']) {
    if (body[field] != null && typeof body[field] !== 'string') {
      throw new Error(`Invalid ${field}`);
    }
  }
  const startTime = (body.start_time as string | undefined) || null;
  const endTime = (body.end_time as string | undefined) || null;
  const validTime = (value: string | null) => !value || /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value);
  if (!validTime(startTime) || !validTime(endTime)) throw new Error('Invalid event time');
  if (startTime && endTime && (!endDate || endDate === eventDate) && endTime < startTime) {
    throw new Error('End time cannot be earlier than start time for a single-day event');
  }
  let images: string[] | undefined;
  if (body.images !== undefined) {
    if (!Array.isArray(body.images) || body.images.length > 10 ||
        !body.images.every((url: unknown) => typeof url === 'string' && isCloudinaryImage(url))) {
      throw new Error('Images must be an array of up to 10 valid Cloudinary image URLs');
    }
    images = body.images;
    if (new Set(images).size !== images.length) throw new Error('Duplicate event images are not allowed');
  }
  return {
    title: title.trim(),
    description: (body.description as string | undefined)?.trim() || null,
    eventDate,
    endDate,
    startTime,
    endTime,
    location: (body.location as string | undefined)?.trim() || null,
    images,
    legacyImageUrl: (body.image_url as string | undefined)?.trim() || null,
  };
}

function isCloudinaryImage(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'res.cloudinary.com' &&
      /^\/[^/]+\/image\/upload\//.test(url.pathname) && value.length <= 2048;
  } catch { return false; }
}

const eventSelect = `
  SELECT e.*, c.name AS category_name,
    COALESCE((
      SELECT json_agg(ei.image_url ORDER BY ei.display_order, ei.id)
      FROM event_images ei WHERE ei.event_id = e.id
    ), '[]'::json) AS images
  FROM events e
  LEFT JOIN event_categories c ON c.id = e.category_id`;

export const getAllEvents = async (_req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `${eventSelect} ORDER BY e.event_date ASC NULLS LAST, e.start_time ASC NULLS LAST, e.id ASC`
    );
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get all events error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch events' });
  }
};

export const createEvent = async (req: AuthRequest, res: Response) => {
  let input: ReturnType<typeof parseEventInput>;
  try { input = parseEventInput(req.body ?? {}); }
  catch (error) {
    return res.status(400).json({ success: false, message: (error as Error).message });
  }
  const categoryId = req.body.category_id;
  if (!Number.isSafeInteger(categoryId) || categoryId <= 0) {
    return res.status(400).json({ success: false, message: 'Valid event category is required' });
  }
  const client = await pool.connect();
  let event: any;
  try {
    await client.query('BEGIN');
    const category = await client.query(
      'SELECT id FROM event_categories WHERE id = $1 AND is_active = TRUE', [categoryId]
    );
    if (!category.rowCount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Selected event category is unavailable' });
    }
    const cover = input.images?.[0] ?? input.legacyImageUrl;
    const result = await client.query(
      `INSERT INTO events
       (title, description, image_url, event_date, event_end_date, start_time, end_time, location, category_id, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE) RETURNING *`,
      [input.title, input.description, cover, input.eventDate, input.endDate,
       input.startTime, input.endTime, input.location, categoryId]
    );
    event = result.rows[0];
    for (const [index, url] of (input.images ?? []).entries()) {
      await client.query(
        'INSERT INTO event_images (event_id, image_url, display_order) VALUES ($1,$2,$3)',
        [event.id, url, index]
      );
    }
    await client.query('COMMIT');
    event.images = input.images ?? [];
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create event error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create event' });
  } finally { client.release(); }

  // Notifications run only after a successful database commit.
  try {
    const notification = await createNotification({
      title: `📅 ${event.title}`,
      body: `New event: ${event.title} on ${input.eventDate}` +
        (input.endDate ? ` to ${input.endDate}` : '') +
        (input.startTime ? ` at ${input.startTime}` : '') +
        (input.location ? ` at ${input.location}` : '') + '.',
      notificationType: 'event',
      data: { type: 'event', eventId: event.id, screen: '/events' },
      targetType: 'all', scheduledAt: null,
    });
    await sendNotificationRecord(notification.id);
  } catch (error) { console.error('Event notification error:', error); }
  await createEventReminderNotification({ ...event, event_date: input.eventDate });
  return res.status(201).json({ success: true, message: 'Event created successfully', data: event });
};

export const updateEvent = async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid event ID' });
  }
  let input: ReturnType<typeof parseEventInput>;
  try { input = parseEventInput(req.body ?? {}); }
  catch (error) {
    return res.status(400).json({ success: false, message: (error as Error).message });
  }
  const client = await pool.connect();
  let event: any;
  try {
    await client.query('BEGIN');
    const existingResult = await client.query('SELECT * FROM events WHERE id = $1 FOR UPDATE', [id]);
    if (!existingResult.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    const existing = existingResult.rows[0];
    const categoryId = req.body.category_id === undefined ? existing.category_id : req.body.category_id;
    if (!Number.isSafeInteger(categoryId) || categoryId <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Valid event category is required' });
    }
    const category = await client.query(
      'SELECT id FROM event_categories WHERE id = $1 AND (is_active = TRUE OR id = $2)',
      [categoryId, existing.category_id]
    );
    if (!category.rowCount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Selected event category is unavailable' });
    }
    const cover = input.images !== undefined
      ? (input.images[0] ?? null)
      : (input.legacyImageUrl ?? existing.image_url);
    const updated = await client.query(
      `UPDATE events SET title=$1, description=$2, image_url=$3, event_date=$4,
       event_end_date=$5, start_time=$6, end_time=$7, location=$8, category_id=$9,
       updated_at=CURRENT_TIMESTAMP WHERE id=$10 RETURNING *`,
      [input.title, input.description, cover, input.eventDate, input.endDate,
       input.startTime, input.endTime, input.location, categoryId, id]
    );
    event = updated.rows[0];
    if (input.images !== undefined) {
      await client.query('DELETE FROM event_images WHERE event_id = $1', [id]);
      for (const [index, url] of input.images.entries()) {
        await client.query(
          'INSERT INTO event_images (event_id, image_url, display_order) VALUES ($1,$2,$3)',
          [id, url, index]
        );
      }
    }
    const images = await client.query(
      'SELECT image_url FROM event_images WHERE event_id=$1 ORDER BY display_order, id', [id]
    );
    event.images = images.rows.map((row: { image_url: string }) => row.image_url);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update event error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update event' });
  } finally { client.release(); }

  // Preserve existing reminder cancellation and rescheduling behavior.
  try {
    await pool.query(
      `UPDATE notifications SET status='cancelled', updated_at=CURRENT_TIMESTAMP
       WHERE notification_type='event_reminder' AND data->>'eventId'=$1 AND status='scheduled'`,
      [String(id)]
    );
    if (event.is_active) {
      await createEventReminderNotification({ ...event, event_date: input.eventDate });
    }
  } catch (error) { console.error('Event reminder update error:', error); }
  return res.json({ success: true, message: 'Event updated successfully', data: event });
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