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

    if (
      cleanEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
    ) {
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
        cleanEmail || null,
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
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number is required',
      });
    }

    // Find user by mobile number
   const userResult = await pool.query(
  `SELECT id, full_name, phone, email
   FROM users
   WHERE phone = $1`,
  [phone]
);

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this mobile number',
      });
    }

   const user = userResult.rows[0];

if (!user.email) {
  return res.status(400).json({
    success: false,
    message:
      'No email address is registered with this account. Please contact temple support.',
  });
}

// Generate secure six-digit OTP
const otp = randomInt(100000, 1000000).toString();

    // Generate 6-digit OTP
   //const otp = crypto
  //.randomInt(100000, 1000000)
  //toString();
    // Hash OTP before storing
    const otpHash = await bcrypt.hash(otp, 10);

    // OTP valid for 5 minutes
    const expiresAt = new Date(
      Date.now() + 5 * 60 * 1000
    );

    // Remove previous password reset OTPs for this user
    await pool.query(
      `DELETE FROM password_reset_otps
       WHERE user_id = $1`,
      [user.id]
    );

    // Store new OTP
    await pool.query(
      `INSERT INTO password_reset_otps (
        user_id,
        otp_hash,
        expires_at
      )
      VALUES ($1, $2, $3)`,
      [
        user.id,
        otpHash,
        expiresAt,
      ]
    );

    try {
  await sendPasswordResetOTP(
    user.email,
    otp
  );
} catch (emailError) {
  console.error(
    'Password reset email delivery failed:',
    emailError
  );

  await pool.query(
    `DELETE FROM password_reset_otps
     WHERE user_id = $1`,
    [user.id]
  );

  return res.status(503).json({
    success: false,
    message:
      'Unable to send OTP email. Please try again later.',
  });
}

return res.json({
  success: true,
  message:
    'Password reset OTP sent to your registered email address.',
}); 
  } catch (error) {
    console.error(
      'Forgot password error:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to generate OTP',
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
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number and OTP are required',
      });
    }

    const userResult = await pool.query(
      `SELECT id
       FROM users
       WHERE phone = $1`,
      [phone]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP',
      });
    }

    const userId = userResult.rows[0].id;

    const otpResult = await pool.query(
      `SELECT id, otp_hash, expires_at, attempt_count
       FROM password_reset_otps
       WHERE user_id = $1
       AND verified = FALSE
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (otpResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP',
      });
    }

    const otpRecord = otpResult.rows[0];

    // Maximum 5 verification attempts
    if (otpRecord.attempt_count >= 5) {
      return res.status(429).json({
        success: false,
        message: 'Too many OTP attempts. Request a new OTP.',
      });
    }

    // Check expiry
    if (new Date() > new Date(otpRecord.expires_at)) {
      await pool.query(
        `DELETE FROM password_reset_otps
         WHERE id = $1`,
        [otpRecord.id]
      );

      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Request a new OTP.',
      });
    }

    const isValidOtp = await bcrypt.compare(
      String(otp),
      otpRecord.otp_hash
    );

    if (!isValidOtp) {
      await pool.query(
        `UPDATE password_reset_otps
         SET attempt_count = attempt_count + 1
         WHERE id = $1`,
        [otpRecord.id]
      );

      return res.status(400).json({
        success: false,
        message: 'Invalid OTP',
      });
    }

    await pool.query(
      `UPDATE password_reset_otps
       SET verified = TRUE
       WHERE id = $1`,
      [otpRecord.id]
    );

    return res.json({
      success: true,
      message: 'OTP verified successfully',
    });
  } catch (error) {
    console.error(
      'Verify reset OTP error:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to verify OTP',
    });
  }
};
// =========================
// RESET PASSWORD
// =========================

export const resetPassword = async (
  req: Request,
  res: Response
) => {
  try {
    const { phone, newPassword } = req.body;

    if (!phone || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number and new password are required',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters',
      });
    }

    const userResult = await pool.query(
      `SELECT id
       FROM users
       WHERE phone = $1`,
      [phone]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Unable to reset password',
      });
    }

    const userId = userResult.rows[0].id;

    const otpResult = await pool.query(
      `SELECT id, expires_at
       FROM password_reset_otps
       WHERE user_id = $1
       AND verified = TRUE
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (otpResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'OTP verification required',
      });
    }

    const otpRecord = otpResult.rows[0];

    if (new Date() > new Date(otpRecord.expires_at)) {
      await pool.query(
        `DELETE FROM password_reset_otps
         WHERE id = $1`,
        [otpRecord.id]
      );

      return res.status(400).json({
        success: false,
        message: 'Password reset session has expired',
      });
    }

    const passwordHash = await bcrypt.hash(
      newPassword,
      10
    );

    await pool.query(
      `UPDATE users
       SET password_hash = $1
       WHERE id = $2`,
      [passwordHash, userId]
    );

    // OTP can never be reused after password reset
    await pool.query(
      `DELETE FROM password_reset_otps
       WHERE user_id = $1`,
      [userId]
    );

    return res.json({
      success: true,
      message: 'Password reset successfully',
    });
  } catch (error) {
    console.error(
      'Reset password error:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to reset password',
    });
  }
};