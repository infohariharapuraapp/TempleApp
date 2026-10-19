import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: {
    userId: number;
    email: string;
    role: string;
  };

}

export const authenticateToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Authentication token required',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as {
      userId: number;
      email: string;
        role: string;
    };

    req.user = decoded;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }
};

export const optionalAuthenticateToken = (
  req: AuthRequest,
  _res: Response,
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

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    );

    if (
      typeof decoded !== 'string' &&
      typeof decoded.userId === 'number' &&
      Number.isSafeInteger(decoded.userId) &&
      decoded.userId > 0
    ) {
      req.user = {
        userId: decoded.userId,
        email:
          typeof decoded.email === 'string'
            ? decoded.email
            : '',
        role:
          typeof decoded.role === 'string'
            ? decoded.role
            : '',
      };
    }
  } catch {
    // Invalid or expired token:
    // Continue as a public visitor.
  }

  next();
};
