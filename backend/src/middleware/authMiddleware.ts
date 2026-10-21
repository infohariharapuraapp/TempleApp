
import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { pool } from '../db';

export interface AuthRequest extends Request {
  user?: {
    userId: number;
    email: string;
    role: string;
  };
}

function extractUser(decoded: string | JwtPayload) {
  if (
    typeof decoded === 'string' ||
    typeof decoded.userId !== 'number' ||
    !Number.isSafeInteger(decoded.userId) ||
    decoded.userId <= 0
  ) {
    return null;
  }

  return {
    userId: decoded.userId,
    email: typeof decoded.email === 'string' ? decoded.email : '',
    role: typeof decoded.role === 'string' ? decoded.role : '',
  };
}

export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Authentication token required',
    });
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication token required',
    });
  }

  let decoded: string | JwtPayload;

  try {
    decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    );
  } catch {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }

  const user = extractUser(decoded);

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Invalid authentication token',
    });
  }

  try {
    const result = await pool.query(
      `SELECT id, email, role
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Account no longer exists',
      });
    }

    const dbUser = result.rows[0];

    req.user = {
      userId: dbUser.id,
      email: dbUser.email ?? '',
      role: dbUser.role,
    };

    return next();
  } catch (error) {
    console.error('Authentication database error:', error);

    return res.status(503).json({
      success: false,
      message: 'Authentication service temporarily unavailable',
    });
  }
};

export const optionalAuthenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    return next();
  }

  let decoded: string | JwtPayload;

  try {
    decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    );
  } catch {
    return next();
  }

  const user = extractUser(decoded);

  if (!user) {
    return next();
  }

  try {
    const result = await pool.query(
      `SELECT id, email, role
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [user.userId]
    );

    if (result.rows.length > 0) {
      const dbUser = result.rows[0];

      req.user = {
        userId: dbUser.id,
        email: dbUser.email ?? '',
        role: dbUser.role,
      };
    }

    return next();
  } catch (error) {
    console.error('Optional authentication error:', error);

    return res.status(503).json({
      success: false,
      message: 'Authentication service temporarily unavailable',
    });
  }
};
