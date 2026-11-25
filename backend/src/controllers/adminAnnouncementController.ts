
import { Request, Response } from 'express';
import { pool } from '../db';
import {
  sendNotificationRecord,
} from '../services/notificationService';

// ========================================
// DIVYAKSHETRA UPDATES CONFIGURATION
// ========================================

const CATEGORIES = [
  'General',
  'Festivals',
  'Poojas',
  'Sevas',
  'Important Notices',
  'Special Events',
] as const;

const ANNOUNCEMENT_COLUMNS = `
  id,
  title,
  message,
  image_url,
  category,
  is_pinned,
  expires_at,
  attachment_url,
  is_active,
  publish_at,
  created_at,
  updated_at
`;

function validId(value: unknown): number | null {
  const id = Number(value);

  return Number.isSafeInteger(id) && id > 0
    ? id
    : null;
}

function parseOptionalDate(value: unknown): {
  valid: boolean;
  value: Date | null;
} {
  if (value === null || value === undefined || value === '') {
    return { valid: true, value: null };
  }

  if (typeof value !== 'string' && !(value instanceof Date)) {
    return { valid: false, value: null };
  }

  const date = new Date(value instanceof Date ? value.getTime() : value);

  if (Number.isNaN(date.getTime())) {
    return { valid: false, value: null };
  }

  return { valid: true, value: date };
}

function parseOptionalUrl(value: unknown): {
  valid: boolean;
  value: string | null;
} {
  if (value === null || value === undefined || value === '') {
    return { valid: true, value: null };
  }

  if (typeof value !== 'string') {
    return { valid: false, value: null };
  }

  try {
    const url = new URL(value.trim());

    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return { valid: false, value: null };
    }

    return { valid: true, value: url.toString() };
  } catch {
    return { valid: false, value: null };
  }
}

function validateAnnouncement(
  body: Record<string, unknown>
): {
  error?: string;
  values?: {
    title: string;
    message: string;
    imageUrl: string | null;
    category: string;
    isPinned: boolean;
    expiresAt: Date | null;
    attachmentUrl: string | null;
    isActive: boolean;
    publishAt: Date | null;
  };
} {
  const {
    title,
    message,
    image_url,
    category,
    is_pinned,
    expires_at,
    attachment_url,
    is_active,
    publish_at,
  } = body;

  if (typeof title !== 'string' || !title.trim()) {
    return { error: 'Title is required' };
  }

  if (typeof message !== 'string' || !message.trim()) {
    return { error: 'Message is required' };
  }

  const selectedCategory =
    category === undefined || category === null || category === ''
      ? 'General'
      : category;

  if (
    typeof selectedCategory !== 'string' ||
    !CATEGORIES.some(item => item === selectedCategory)
  ) {
    return { error: 'Invalid announcement category' };
  }

  if (
    is_pinned !== undefined &&
    typeof is_pinned !== 'boolean'
  ) {
    return { error: 'is_pinned must be a boolean' };
  }

  if (
    is_active !== undefined &&
    typeof is_active !== 'boolean'
  ) {
    return { error: 'is_active must be a boolean' };
  }

  const imageUrl = parseOptionalUrl(image_url);
  const attachmentUrl = parseOptionalUrl(attachment_url);
  const publishAt = parseOptionalDate(publish_at);
  const expiresAt = parseOptionalDate(expires_at);

  if (!imageUrl.valid) {
    return { error: 'Invalid image URL' };
  }

  if (!attachmentUrl.valid) {
    return { error: 'Invalid attachment URL' };
  }

  if (!publishAt.valid) {
    return { error: 'Invalid publish date' };
  }

  if (!expiresAt.valid) {
    return { error: 'Invalid expiry date' };
  }

  if (
    expiresAt.value &&
    publishAt.value &&
    expiresAt.value <= publishAt.value
  ) {
    return {
      error: 'Expiry date must be after publish date',
    };
  }

  return {
    values: {
      title: title.trim(),
      message: message.trim(),
      imageUrl: imageUrl.value,
      category: selectedCategory,
      isPinned: is_pinned === true,
      expiresAt: expiresAt.value,
      attachmentUrl: attachmentUrl.value,
      isActive: is_active === undefined ? true : is_active,
      publishAt: publishAt.value,
    },
  };
}

function notificationData(announcement: any) {
  return {
    type: 'announcement',
    announcementId: announcement.id,
    screen: 'announcements',
    imageUrl: announcement.image_url || null,
  };
}

// ========================================
// ADMIN: SEND ANNOUNCEMENT NOW
// ========================================

class AnnouncementRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}
async function prepareAnnouncementNotification(
  announcementId: number,
  scheduledAt: Date | null
) {
  const client = await pool.connect();
  let discardClient = false;
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '10s'");
    const result = await client.query(
      `SELECT ${ANNOUNCEMENT_COLUMNS}
       FROM announcements
       WHERE id = $1
       FOR UPDATE`,
      [announcementId]
    );
    const announcement = result.rows[0];
    if (!announcement) {
      throw new AnnouncementRequestError(
        404, 'Announcement not found'
      );
    }
    if (!announcement.is_active) {
      throw new AnnouncementRequestError(
        400, 'Announcement is inactive'
      );
    }
    const clock = await client.query(
      'SELECT clock_timestamp() AS current_time'
    );
    const now = new Date(clock.rows[0].current_time);
    const publishTime = scheduledAt ?? now;
    if (scheduledAt && scheduledAt <= now) {
      throw new AnnouncementRequestError(
        400, 'Scheduled time must be in the future'
      );
    }
    if (
      announcement.expires_at &&
      new Date(announcement.expires_at) <= publishTime
    ) {
      throw new AnnouncementRequestError(
        400, 'Announcement expiry must be after publication'
      );
    }
    const existing = await client.query(
      `SELECT id, status, target_type
       FROM notifications
       WHERE notification_type = 'announcement'
         AND data->>'announcementId' = $1
         AND status IN (
           'scheduled', 'pending', 'processing', 'sent', 'unknown'
         )
       FOR UPDATE`,
      [String(announcementId)]
    );
    const current = existing.rows[0];
    if (current && current.status === 'unknown') {
      throw new AnnouncementRequestError(
        409,
        'Previous notification delivery is uncertain. Resending is blocked to prevent duplicates.'
      );
    }
    if (current && current.status === 'sent') {
      throw new AnnouncementRequestError(
        409, 'Notification has already been sent'
      );
    }
    if (
      current &&
      (
        current.status !== 'scheduled' ||
        current.target_type !== 'all'
      )
    ) {
      throw new AnnouncementRequestError(
        409, 'Notification is already being processed'
      );
    }
    const status = scheduledAt ? 'scheduled' : 'pending';
    const payload = JSON.stringify(
      notificationData(announcement)
    );
    let notificationId: number;
    if (current) {
      const updated = await client.query(
        `UPDATE notifications
         SET title = $1,
             body = $2,
             data = $3,
             scheduled_at = $4,
             status = $5,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $6
           AND status = 'scheduled'
         RETURNING id`,
        [
          announcement.title,
          announcement.message,
          payload,
          scheduledAt,
          status,
          current.id,
        ]
      );
      if (updated.rowCount !== 1) {
        throw new AnnouncementRequestError(
          409, 'Notification state has changed'
        );
      }
      notificationId = updated.rows[0].id;
    } else {
      const inserted = await client.query(
        `INSERT INTO notifications (
           title, body, notification_type,
           data, target_type, scheduled_at, status
         )
         VALUES (
           $1, $2, 'announcement',
           $3, 'all', $4, $5
         )
         RETURNING id`,
        [
          announcement.title,
          announcement.message,
          payload,
          scheduledAt,
          status,
        ]
      );
      notificationId = inserted.rows[0].id;
    }
    await client.query(
      `UPDATE announcements
       SET publish_at = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [publishTime, announcementId]
    );
    await client.query('COMMIT');
    return notificationId;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      discardClient = true;
    }
    throw error;
  } finally {
    client.release(discardClient);
  }
}
function announcementNotificationError(
  res: Response,
  error: unknown
) {
  if (error instanceof AnnouncementRequestError) {
    return res.status(error.status).json({
      success: false,
      message: error.message,
    });
  }
  const databaseError = error as {
    code?: string;
    constraint?: string;
  };
  if (
    databaseError?.code === '23505' &&
    databaseError.constraint ===
      'uq_announcement_active_notification'
  ) {
    return res.status(409).json({
      success: false,
      message: 'An active notification already exists',
    });
  }
  if (
    databaseError?.code === '55P03' ||
    databaseError?.code === '40P01' ||
    databaseError?.code === '40001'
  ) {
    return res.status(409).json({
      success: false,
      message: 'Announcement is busy. Please try again.',
    });
  }
  console.error('Announcement notification operation failed.');
  return res.status(500).json({
    success: false,
    message: 'Unable to process announcement notification',
  });
}
export async function sendAnnouncementNow(
  req: Request,
  res: Response
) {
  try {
    const announcementId = validId(req.params.id);
    if (!announcementId) {
      throw new AnnouncementRequestError(
        400, 'Invalid announcement ID'
      );
    }
    const notificationId =
      await prepareAnnouncementNotification(
        announcementId,
        null
      );
    const result =
      await sendNotificationRecord(notificationId);
    return res.status(result.success ? 200 : 409).json({
      success: result.success,
      message: result.success
        ? result.message || 'Announcement notification processed'
        : result.message || 'Notification submission unsuccessful',
      data: {
        ...result,
        announcementId,
        notificationId,
      },
    });
  } catch (error) {
    return announcementNotificationError(res, error);
  }
}
export async function scheduleAnnouncement(
  req: Request,
  res: Response
) {
  try {
    const announcementId = validId(req.params.id);
    if (!announcementId) {
      throw new AnnouncementRequestError(
        400, 'Invalid announcement ID'
      );
    }
    const scheduled = parseOptionalDate(
      req.body?.publish_at
    );
    if (!scheduled.valid || !scheduled.value) {
      throw new AnnouncementRequestError(
        400, 'Valid publish_at is required'
      );
    }
    const notificationId =
      await prepareAnnouncementNotification(
        announcementId,
        scheduled.value
      );
    return res.status(200).json({
      success: true,
      message: 'Announcement scheduled successfully',
      data: {
        announcementId,
        notificationId,
        scheduledAt: scheduled.value,
      },
    });
  } catch (error) {
    return announcementNotificationError(res, error);
  }
}
// ========================================
// ADMIN: GET ALL ANNOUNCEMENTS
// ========================================
export async function getAllAdminAnnouncements(
  req: Request,
  res: Response
) {
  try {
    const result = await pool.query(
      `SELECT ${ANNOUNCEMENT_COLUMNS}
       FROM announcements
       ORDER BY
         is_pinned DESC,
         COALESCE(publish_at, created_at) DESC,
         id DESC`
    );

    return res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Admin get announcements error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to load announcements',
    });
  }
}

// ========================================
// ADMIN: CREATE ANNOUNCEMENT
// ========================================

export async function createAnnouncement(
  req: Request,
  res: Response
) {
  try {
    const validation = validateAnnouncement(req.body);

    if (validation.error || !validation.values) {
      return res.status(400).json({
        success: false,
        message: validation.error || 'Invalid announcement',
      });
    }

    const v = validation.values;

    const result = await pool.query(
      `INSERT INTO announcements (
        title,
        message,
        image_url,
        category,
        is_pinned,
        expires_at,
        attachment_url,
        is_active,
        publish_at
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9
      )
      RETURNING ${ANNOUNCEMENT_COLUMNS}`,
      [
        v.title,
        v.message,
        v.imageUrl,
        v.category,
        v.isPinned,
        v.expiresAt,
        v.attachmentUrl,
        v.isActive,
        v.publishAt,
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Announcement created successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Admin create announcement error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to create announcement',
    });
  }
}

// ========================================
// ADMIN: UPDATE ANNOUNCEMENT
// ========================================

export async function updateAnnouncement(
  req: Request,
  res: Response
) {
  try {
    const announcementId = validId(req.params.id);

    if (!announcementId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid announcement ID',
      });
    }

    const existing = await pool.query(
      `SELECT ${ANNOUNCEMENT_COLUMNS}
       FROM announcements
       WHERE id = $1`,
      [announcementId]
    );

    if (!existing.rows.length) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found',
      });
    }

    // Preserve existing values when optional fields
    // are omitted by older admin dashboard versions.
    const current = existing.rows[0];

    const merged = {
      ...current,
      ...req.body,
      title:
        req.body.title === undefined
          ? current.title
          : req.body.title,
      message:
        req.body.message === undefined
          ? current.message
          : req.body.message,
    };

    const validation = validateAnnouncement(merged);

    if (validation.error || !validation.values) {
      return res.status(400).json({
        success: false,
        message: validation.error || 'Invalid announcement',
      });
    }

    const v = validation.values;

    const result = await pool.query(
      `UPDATE announcements
       SET
         title = $1,
         message = $2,
         image_url = $3,
         category = $4,
         is_pinned = $5,
         expires_at = $6,
         attachment_url = $7,
         is_active = $8,
         publish_at = $9,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $10
       RETURNING ${ANNOUNCEMENT_COLUMNS}`,
      [
        v.title,
        v.message,
        v.imageUrl,
        v.category,
        v.isPinned,
        v.expiresAt,
        v.attachmentUrl,
        v.isActive,
        v.publishAt,
        announcementId,
      ]
    );

    return res.status(200).json({
      success: true,
      message: 'Announcement updated successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Admin update announcement error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to update announcement',
    });
  }
}

// ========================================
// ADMIN: TOGGLE ANNOUNCEMENT STATUS
// ========================================

export async function toggleAnnouncementStatus(
  req: Request,
  res: Response
) {
  try {
    const announcementId = validId(req.params.id);

    if (!announcementId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid announcement ID',
      });
    }

    // Supports both existing toggle calls and
    // explicit is_active values from admin UI.
    const requestedStatus = req.body?.is_active;

    if (
      requestedStatus !== undefined &&
      typeof requestedStatus !== 'boolean'
    ) {
      return res.status(400).json({
        success: false,
        message: 'is_active must be a boolean',
      });
    }

    const result = await pool.query(
      `UPDATE announcements
       SET
         is_active = CASE
           WHEN $2::boolean IS NULL
             THEN NOT is_active
           ELSE $2::boolean
         END,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING ${ANNOUNCEMENT_COLUMNS}`,
      [
        announcementId,
        requestedStatus === undefined
          ? null
          : requestedStatus,
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: result.rows[0].is_active
        ? 'Announcement activated successfully'
        : 'Announcement deactivated successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error(
      'Admin toggle announcement status error:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to update announcement status',
    });
  }
}

 // ========================================
 // ADMIN: DELETE ANNOUNCEMENT
 // ========================================


export async function deleteAnnouncement(
  req: Request,
  res: Response
) {
  const client = await pool.connect();

  try {
    const announcementId = validId(req.params.id);

    if (!announcementId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid announcement ID',
      });
    }

    await client.query('BEGIN');

    const existing = await client.query(
      `SELECT id, title
       FROM announcements
       WHERE id = $1
       FOR UPDATE`,
      [announcementId]
    );

    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        success: false,
        message: 'Announcement not found',
      });
    }

    // Cancel only notifications that have not
    // started processing or been sent.
    const cancelled = await client.query(
      `UPDATE notifications
       SET status = 'cancelled',
           updated_at = CURRENT_TIMESTAMP
       WHERE notification_type = 'announcement'
         AND data->>'announcementId' = $1
         AND status IN ('scheduled', 'pending')
       RETURNING id`,
      [String(announcementId)]
    );

    const deleted = await client.query(
      `DELETE FROM announcements
       WHERE id = $1
       RETURNING id, title`,
      [announcementId]
    );

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: 'Announcement deleted successfully',
      data: {
        ...deleted.rows[0],
        cancelledNotifications: cancelled.rowCount ?? 0,
      },
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Delete rollback error:', rollbackError);
    }

    console.error('Admin delete announcement error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to delete announcement',
    });
  } finally {
    client.release();
  }
}


