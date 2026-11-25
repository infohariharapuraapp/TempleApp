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
    decoded.userId <= 0 ||
    typeof decoded.exp !== 'number' ||
    !Number.isSafeInteger(decoded.exp) ||
    typeof decoded.iat !== 'number' ||
    !Number.isSafeInteger(decoded.iat) ||
    decoded.iat <= 0 ||
    decoded.exp <= decoded.iat ||
    decoded.iat > Math.floor(Date.now() / 1000) + 60 ||
    decoded.exp - decoded.iat > 7 * 24 * 60 * 60
  ) {
    return null;
  }

  const tokenVersion =
    decoded.tokenVersion === undefined
      ? 0
      : decoded.tokenVersion;
  if (
    typeof tokenVersion !== 'number' ||
    !Number.isSafeInteger(tokenVersion) ||
    tokenVersion < 0
  ) {
    return null;
  }
  return {
    tokenVersion,
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
      process.env.JWT_SECRET as string,
      { algorithms: ['HS256'] }
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
      `SELECT id, email, role, token_version
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
    if (dbUser.token_version !== user.tokenVersion) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }
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
      process.env.JWT_SECRET as string,
      { algorithms: ['HS256'] }
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
      `SELECT id, email, role, token_version
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [user.userId]
    );

    if (result.rows.length > 0) {
      const dbUser = result.rows[0];
      if (dbUser.token_version !== user.tokenVersion) {
        return next();
      }
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
