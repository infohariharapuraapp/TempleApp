import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import bcrypt from 'bcryptjs';
import { pool } from '../db';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import {
  sendPasswordResetOTP,
  sendRegistrationConfirmation,
} from '../services/emailService';

import { randomInt } from 'node:crypto';

// =========================
// REGISTER
// =========================

// ========================================
// REGISTER - EMAIL OPTIONAL
// ========================================

export const register = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      full_name,
      email,
      phone,
      password,
    } = req.body || {};

    const cleanName =
      typeof full_name === 'string'
        ? full_name.trim()
        : '';

    const cleanEmail =
      typeof email === 'string'
        ? email.trim().toLowerCase()
        : '';

    const cleanPhone =
      typeof phone === 'string'
        ? phone.trim()
        : '';

    if (
      cleanName.length < 2 ||
      cleanName.length > 100
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Full name must contain between 2 and 100 characters.',
      });
    }

    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      return res.status(400).json({
        success: false,
        message:
          'Enter a valid 10-digit Indian mobile number.',
      });
    }

 if (!cleanEmail) {
  return res.status(400).json({
    success: false,
    message: 'Email address is required.',
  });
}

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
  return res.status(400).json({
    success: false,
    message: 'Enter a valid email address.',
  });
}

    if (
      typeof password !== 'string' ||
      password.length < 8 ||
      Buffer.byteLength(password, 'utf8') > 72
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Password must be at least 8 characters and no more than 72 UTF-8 bytes.',
      });
    }

    const existingUser = await pool.query(
      `SELECT id
       FROM users
       WHERE phone = $1
          OR ($2::text IS NOT NULL AND LOWER(email) = $2)
       LIMIT 1`,
      [
        cleanPhone,
       cleanEmail,
      ]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message:
          'Mobile number or email is already registered.',
      });
    }

    const passwordHash =
      await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (
        full_name,
        email,
        phone,
        password_hash
      )
      VALUES ($1, $2, $3, $4)
      RETURNING
        id,
        full_name,
        email,
        phone,
        role,
        created_at`,
      [
        cleanName,
        cleanEmail || null,
        cleanPhone,
        passwordHash,
      ]
    );

   // ========================================
// SEND REGISTRATION CONFIRMATION EMAIL
// ========================================

if (cleanEmail) {
  void sendRegistrationConfirmation(
    cleanEmail,
    cleanName
  ).catch((emailError) => {

    console.error(
      'Registration confirmation email error:',
      emailError
    );

  });
}

// ========================================
// RETURN REGISTRATION SUCCESS RESPONSE
// ========================================

return res.status(201).json({
  success: true,
  message:
    'Registration successful. Please login.',
  data: result.rows[0],
});

  } catch (error: any) {
    console.error('Registration error:', error);

    if (error?.code === '23505') {
      return res.status(409).json({
        success: false,
        message:
          'Mobile number or email is already registered.',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Registration failed.',
    });
  }
};

// =========================
// LOGIN
// =========================

// ========================================
// LOGIN - MOBILE OR EMAIL
// ========================================

export const login = async (
  req: Request,
  res: Response
) => {
  try {
    const { email, password } = req.body || {};

    // Keep "email" as the request key for
    // compatibility with the existing app.
    const identifier =
      typeof email === 'string'
        ? email.trim()
        : '';

    if (
      !identifier ||
      typeof password !== 'string' ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Mobile number or email and password are required.',
      });
    }

    const isPhone = /^[6-9]\d{9}$/.test(identifier);

    const result = await pool.query(
      `SELECT
        id,
        full_name,
        email,
        phone,
        password_hash,
        role,
        token_version
       FROM users
       WHERE ${
         isPhone
           ? 'phone = $1'
           : 'LOWER(email) = LOWER($1)'
       }
       LIMIT 1`,
      [identifier]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message:
          'Invalid login credentials.',
      });
    }

    const user = result.rows[0];

    if (!user.password_hash) {
      return res.status(401).json({
        success: false,
        message:
          'Password login is unavailable for this account.',
      });
    }

    const passwordMatches =
      await bcrypt.compare(
        password,
        user.password_hash
      );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message:
          'Invalid login credentials.',
      });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error(
        'JWT_SECRET is not configured'
      );
    }

    if (
      !Number.isSafeInteger(user.token_version) ||
      user.token_version < 0
    ) {
      throw new Error('Invalid account token version');
    }
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        tokenVersion: user.token_version,
      },
      process.env.JWT_SECRET,
      {
        algorithm: 'HS256',
        expiresIn: '7d',
      }
    );

    return res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          phone: user.phone,
          role: user.role,
        },
      },
    });

  } catch (error) {
    console.error('Login error:', error);

    return res.status(500).json({
      success: false,
      message: 'Login failed.',
    });
  }
};
// =========================
// GET CURRENT USER
// =========================

export const getMe = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const result = await pool.query(
      `SELECT
         id,
         full_name,
         email,
         phone,
         role,
         created_at
       FROM users
       WHERE id = $1`,
      [userId]
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
    console.error('Get current user error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch user',
    });
  }
};

 // ========================================
 // UPDATE CURRENT USER PROFILE
 // PUT /api/auth/profile
 // ========================================

export const updateProfile = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const { full_name, phone } = req.body || {};

    // Validate full name
    if (
      typeof full_name !== 'string' ||
      full_name.trim().length < 2 ||
      full_name.trim().length > 100
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Name must contain between 2 and 100 characters.',
      });
    }

    // Validate Indian mobile number
    const cleanPhone =
      typeof phone === 'string'
        ? phone.trim()
        : '';

    if (
      cleanPhone !== '' &&
      !/^[6-9]\d{9}$/.test(cleanPhone)
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Enter a valid 10-digit Indian mobile number.',
      });
    }

    const result = await pool.query(
  `
  UPDATE users
  SET full_name = $1
  WHERE id = $2
  RETURNING
    id,
    full_name,
    email,
    phone,
    role,
    created_at
  `,
  [
    full_name.trim(),
    userId,
  ]
);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    return res.json({
      success: true,
      message: 'Profile updated successfully.',
      data: result.rows[0],
    });
  } catch (error: any) {
    console.error(
      'Update profile error:',
      error
    );

    if (error?.code === '23505') {
      return res.status(409).json({
        success: false,
        message:
          'This mobile number is already registered.',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to update profile.',
    });
  }
};

// =========================
// FORGOT PASSWORD
// =========================


export const forgotPassword = async (
  req: Request,
  res: Response
) => {
  let client: import('pg').PoolClient | undefined;
  let discardClient = false;
  let delivery: { email: string; otp: string } | undefined;
  const genericMessage =
    'If your account has a registered email, a password reset OTP will be sent there.';
  try {
    const identifier =
      typeof req.body?.identifier === 'string'
        ? req.body.identifier.trim().toLowerCase()
        : '';
    const isPhone = /^[6-9]\d{9}$/.test(identifier);
    const isEmail =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
    if (!isPhone && !isEmail) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid email or mobile number.',
      });
    }
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query(
      "SET LOCAL lock_timeout = '5s'"
    );
    // Serialize password recovery operations per user.
    const userResult = await client.query(
      `SELECT id, email
       FROM users
       WHERE phone = $1 OR LOWER(email) = $1
       LIMIT 1
       FOR UPDATE`,
      [identifier]
    );
    const user = userResult.rows[0];
    if (!user || !user.email) {
      await client.query('COMMIT');
      return res.json({
        success: true,
        message: genericMessage,
      });
    }
    // Check cooldown while holding the user lock.
    const recent = await client.query(
      `SELECT id
       FROM password_reset_otps
       WHERE user_id = $1
         AND created_at >
             clock_timestamp() - INTERVAL '60 seconds'
       LIMIT 1`,
      [user.id]
    );
    if (recent.rows.length > 0) {
      await client.query('COMMIT');
      return res.json({
        success: true,
        message: genericMessage,
      });
    }
    const accountRequests = await client.query(
      `SELECT COUNT(*)::int AS total
       FROM password_reset_request_events
       WHERE user_id = $1
         AND requested_at >
             clock_timestamp() - INTERVAL '15 minutes'`,
      [user.id]
    );
    // Keep responses generic to prevent account enumeration.
    if (Number(accountRequests.rows[0].total) >= 5) {
      await client.query('COMMIT');
      return res.json({
        success: true,
        message: genericMessage,
      });
    }
    const otp = randomInt(100000, 1000000).toString();
    const otpHash = await bcrypt.hash(otp, 10);
    // Replace the previous OTP atomically.
    await client.query(
      `INSERT INTO password_reset_otps (
         user_id,
         otp_hash,
         expires_at,
         verified,
         attempt_count,
         created_at
       )
       VALUES (
         $1,
         $2,
         clock_timestamp() + INTERVAL '5 minutes',
         FALSE,
         0,
         clock_timestamp()
       )
       ON CONFLICT (user_id)
       DO UPDATE SET
         otp_hash = EXCLUDED.otp_hash,
         expires_at = EXCLUDED.expires_at,
         verified = FALSE,
         attempt_count = 0,
         created_at = EXCLUDED.created_at`,
      [user.id, otpHash]
    );
    await client.query(
      `INSERT INTO password_reset_request_events (user_id)
       VALUES ($1)`,
      [user.id]
    );
    await client.query('COMMIT');
    delivery = {
      email: user.email,
      otp,
    };
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch {
        discardClient = true;
        console.error('Password recovery rollback failed.');
      }
    }
    console.error('Forgot password database operation failed.');
    return res.status(500).json({
      success: false,
      message: 'Unable to process password reset.',
    });
  } finally {
    if (client) {
      client.release(discardClient);
    }
  }
  // Occasionally remove old tracking records.
  // Keep cleanup bounded and outside the OTP transaction.
  if (delivery && randomInt(0, 20) === 0) {
    try {
      await pool.query(
        `DELETE FROM password_reset_request_events
         WHERE id IN (
           SELECT id
           FROM password_reset_request_events
           WHERE requested_at <
                 clock_timestamp() - INTERVAL '24 hours'
           ORDER BY requested_at
           LIMIT 500
           FOR UPDATE SKIP LOCKED
         )`
      );
    } catch {
      console.error('Password recovery event cleanup failed.');
    }
  }
  // Send email after releasing the database connection.
  if (delivery) {
    try {
      await sendPasswordResetOTP(
        delivery.email,
        delivery.otp
      );
    } catch {
      // Retain the cooldown even if email delivery fails.
      // Never log the OTP or recipient details.
      console.error('Password reset email delivery failed.');
      return res.status(503).json({
        success: false,
        message:
          'Email service is temporarily unavailable. Please try again later.',
      });
    }
  }
  return res.json({
    success: true,
    message: genericMessage,
  });
};

// =========================
// VERIFY RESET OTP
// =========================


export const verifyResetOtp = async (
  req: Request,
  res: Response
) => {
  const identifier =
    typeof req.body?.identifier === 'string'
      ? req.body.identifier.trim().toLowerCase()
      : '';

  const otp = String(req.body?.otp ?? '').trim();

  if (
    !identifier ||
    !/^\d{6}$/.test(otp)
  ) {
    return res.status(400).json({
      success: false,
      message: 'Invalid email, mobile number or OTP.',
    });
  }

  let client: import('pg').PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query(
      "SET LOCAL lock_timeout = '5s'"
    );

    const userResult = await client.query(
      `SELECT id FROM users
       WHERE phone = $1 OR LOWER(email) = $1
       LIMIT 1
       FOR UPDATE`,
      [identifier]
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP.',
      });
    }

    const userId = userResult.rows[0].id;

    const otpResult = await client.query(
      `SELECT id, otp_hash, expires_at, attempt_count,
              expires_at <= clock_timestamp() AS expired
       FROM password_reset_otps
       WHERE user_id = $1 AND verified = FALSE
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [userId]
    );

    if (otpResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP.',
      });
    }

    const record = otpResult.rows[0];

    if (record.attempt_count >= 5) {
      await client.query('ROLLBACK');
      return res.status(429).json({
        success: false,
        message:
          'Too many attempts. Request a new OTP.',
      });
    }

    if (record.expired !== false) {
      await client.query(
        `DELETE FROM password_reset_otps WHERE id = $1`,
        [record.id]
      );
      await client.query('COMMIT');

      return res.status(400).json({
        success: false,
        message: 'OTP expired. Request a new OTP.',
      });
    }

    const valid = await bcrypt.compare(
      otp,
      record.otp_hash
    );

    if (!valid) {
      await client.query(
        `UPDATE password_reset_otps
         SET attempt_count = attempt_count + 1
         WHERE id = $1`,
        [record.id]
      );

      await client.query('COMMIT');

      return res.status(400).json({
        success: false,
        message: 'Invalid OTP.',
      });
    }

    const resetToken = crypto
      .randomBytes(32)
      .toString('hex');

    const tokenHash = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Reuse otp_hash for the reset-token hash.
    // A verified OTP cannot be verified again.
    await client.query(
      `UPDATE password_reset_otps
       SET verified = TRUE, otp_hash = $1
       WHERE id = $2`,
      [tokenHash, record.id]
    );

    await client.query('COMMIT');

    return res.json({
      success: true,
      message: 'OTP verified successfully.',
      data: {
        resetToken,
      },
    });
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch {}
    }

    console.error('Verify OTP error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to verify OTP.',
    });
  } finally {
    if (client) {
      client.release();
    }
  }
};

// =========================
// RESET PASSWORD
// =========================


export const resetPassword = async (
  req: Request,
  res: Response
) => {
  const identifier =
    typeof req.body?.identifier === 'string'
      ? req.body.identifier.trim().toLowerCase()
      : '';

  const resetToken = req.body?.resetToken;
  const newPassword = req.body?.newPassword;

  if (
    !identifier ||
    typeof resetToken !== 'string' ||
    !/^[a-f0-9]{64}$/.test(resetToken)
  ) {
    return res.status(400).json({
      success: false,
      message:
        'Invalid reset session. Please verify OTP again.',
    });
  }

  if (
    typeof newPassword !== 'string' ||
    newPassword.length < 8 ||
    Buffer.byteLength(newPassword, 'utf8') > 72
  ) {
    return res.status(400).json({
      success: false,
      message:
        'Password must be at least 8 characters and no more than 72 UTF-8 bytes.',
    });
  }

  let client: import('pg').PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query(
      "SET LOCAL lock_timeout = '5s'"
    );

    const userResult = await client.query(
      `SELECT id FROM users
       WHERE phone = $1 OR LOWER(email) = $1
       LIMIT 1
       FOR UPDATE`,
      [identifier]
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset session.',
      });
    }

    const userId = userResult.rows[0].id;

    const tokenResult = await client.query(
      `SELECT id, otp_hash, expires_at,
              expires_at <= clock_timestamp() AS expired
       FROM password_reset_otps
       WHERE user_id = $1 AND verified = TRUE
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [userId]
    );

    if (tokenResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'OTP verification required.',
      });
    }

    const record = tokenResult.rows[0];

    if (
      record.expired !== false
    ) {
      await client.query(
        `DELETE FROM password_reset_otps WHERE id = $1`,
        [record.id]
      );

      await client.query('COMMIT');

      return res.status(400).json({
        success: false,
        message: 'Reset session expired.',
      });
    }

    const suppliedHash = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest();

    const storedHash = Buffer.from(
      record.otp_hash,
      'hex'
    );

    const validToken =
      storedHash.length === suppliedHash.length &&
      crypto.timingSafeEqual(
        storedHash,
        suppliedHash
      );

    if (!validToken) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Invalid reset session.',
      });
    }

    const passwordHash = await bcrypt.hash(
      newPassword,
      10
    );

    await client.query(
      `UPDATE users
       SET password_hash = $1,
           token_version = token_version + 1
       WHERE id = $2`,
      [passwordHash, userId]
    );

    // Consume all password-reset sessions.
    await client.query(
      `DELETE FROM password_reset_otps
       WHERE user_id = $1`,
      [userId]
    );

    await client.query('COMMIT');

    return res.json({
      success: true,
      message: 'Password reset successfully.',
    });
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch {}
    }

    console.error('Reset password error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to reset password.',
    });
  } finally {
    if (client) {
      client.release();
    }
  }
};



 // ========================================
 // DELETE DEVOTEE ACCOUNT
 // ========================================



export const deleteAccount = async (
  req: AuthRequest,
  res: Response
) => {
  const userId = req.user?.userId;
  const { password } = req.body ?? {};

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }

  if (
    typeof password !== 'string' ||
    password.length === 0
  ) {
    return res.status(400).json({
      success: false,
      message: 'Password is required to delete your account',
    });
  }

  let client;

  try {
    client = await pool.connect();

    await client.query('BEGIN');

    const result = await client.query(
      `SELECT id, password_hash, role
       FROM users
       WHERE id = $1
       FOR UPDATE`,
      [userId]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        success: false,
        message: 'Account not found',
      });
    }

    const user = result.rows[0];

    if (user.role !== 'devotee') {
      await client.query('ROLLBACK');

      return res.status(403).json({
        success: false,
        message: 'This account cannot be deleted here',
      });
    }

    if (!user.password_hash) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        success: false,
        message: 'Password verification is unavailable',
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordMatches) {
      await client.query('ROLLBACK');

      return res.status(401).json({
        success: false,
        message: 'Incorrect password',
      });
    }

  // ========================================
// REMOVE PERSONAL VOLUNTEER NOTIFICATIONS
// ========================================

await client.query(
  `
  DELETE FROM volunteer_notification_jobs
  WHERE recipient_user_id = $1
    AND target_type = 'user'
  `,
  [userId]
);

// ========================================
// DETACH VOLUNTEER REGISTRATION OWNERSHIP
// ========================================

// Preserve registrations and other group members.

await client.query(
  `
  UPDATE volunteer_registrations
  SET user_id = NULL,
      updated_at = CURRENT_TIMESTAMP
  WHERE user_id = $1
  `,
  [userId]
);

// ========================================
// DETACH LINKED VOLUNTEER MEMBERS
// ========================================

await client.query(
  `
  UPDATE volunteer_members
  SET user_id = NULL,
      updated_at = CURRENT_TIMESTAMP
  WHERE user_id = $1
  `,
  [userId]
);

// ========================================
// DELETE USER ACCOUNT
// ========================================

await client.query(
  'DELETE FROM users WHERE id = $1',
  [userId]
);

    await client.query('COMMIT');

    return res.json({
      success: true,
      message: 'Your account has been deleted successfully',
    });

  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Rollback error:', rollbackError);
      }
    }

    console.error('Delete account error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to delete account',
    });

  } finally {
    if (client) {
      client.release();
    }
  }
};
