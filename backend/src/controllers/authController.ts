import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import bcrypt from 'bcryptjs';
import { pool } from '../db';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { sendPasswordResetOTP } from '../services/emailService';
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
        role
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

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
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

    const userResult = await pool.query(
      `SELECT id, email
       FROM users
       WHERE phone = $1 OR LOWER(email) = $1
       LIMIT 1`,
      [identifier]
    );

    const genericMessage =
      'If your account has a registered email, a password reset OTP will be sent there.';

    if (userResult.rows.length === 0) {
      return res.json({
        success: true,
        message: genericMessage,
      });
    }

    const user = userResult.rows[0];

    if (!user.email) {
      return res.json({
        success: true,
        message: genericMessage,
      });
    }

    // Limit OTP requests to once every 60 seconds.
    const recent = await pool.query(
      `SELECT id
       FROM password_reset_otps
       WHERE user_id = $1
         AND created_at > NOW() - INTERVAL '60 seconds'
       LIMIT 1`,
      [user.id]
    );

    if (recent.rows.length > 0) {
      return res.json({
        success: true,
        message: genericMessage,
      });
    }

    const otp = randomInt(100000, 1000000).toString();
    const otpHash = await bcrypt.hash(otp, 10);

    const expiresAt = new Date(
      Date.now() + 5 * 60 * 1000
    );

    await pool.query(
      `DELETE FROM password_reset_otps
       WHERE user_id = $1`,
      [user.id]
    );

    const inserted = await pool.query(
      `INSERT INTO password_reset_otps
       (user_id, otp_hash, expires_at)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [user.id, otpHash, expiresAt]
    );

    try {
      await sendPasswordResetOTP(user.email, otp);
    } catch (emailError) {
      console.error(
        'Password reset email error:',
        emailError
      );

      await pool.query(
        `DELETE FROM password_reset_otps
         WHERE id = $1`,
        [inserted.rows[0].id]
      );

      return res.status(503).json({
        success: false,
        message:
          'Email service is temporarily unavailable. Please try again later.',
      });
    }

    return res.json({
      success: true,
      message: genericMessage,
    });
  } catch (error) {
    console.error('Forgot password error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to process password reset.',
    });
  }
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

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userResult = await client.query(
      `SELECT id FROM users
       WHERE phone = $1 OR LOWER(email) = $1
       LIMIT 1`,
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
      `SELECT id, otp_hash, expires_at, attempt_count
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

    if (new Date(record.expires_at).getTime() <= Date.now()) {
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
    try {
      await client.query('ROLLBACK');
    } catch {}

    console.error('Verify OTP error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to verify OTP.',
    });
  } finally {
    client.release();
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

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userResult = await client.query(
      `SELECT id FROM users
       WHERE phone = $1 OR LOWER(email) = $1
       LIMIT 1`,
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
      `SELECT id, otp_hash, expires_at
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
      new Date(record.expires_at).getTime() <= Date.now()
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
       SET password_hash = $1
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
    try {
      await client.query('ROLLBACK');
    } catch {}

    console.error('Reset password error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to reset password.',
    });
  } finally {
    client.release();
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
