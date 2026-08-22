import type { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../lib/jwt';
import { AuthError, ForbiddenError } from '../lib/errors';
import type { Role } from '@prisma/client';

export interface AuthedRequest extends Request {
  user?: { id: string; role: Role; email: string };
}

export function requireAuth(req: AuthedRequest, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new AuthError());
  }
  try {
    const payload = verifyToken(header.slice(7));
    req.user = { id: payload.sub, role: payload.role as Role, email: payload.email };
    next();
  } catch {
    return next(new AuthError('Invalid or expired token'));
  }
}

/** Decodes the JWT when present but never rejects the request (public endpoints). */
export function optionalAuth(req: AuthedRequest, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      const payload = verifyToken(header.slice(7));
      req.user = { id: payload.sub, role: payload.role as Role, email: payload.email };
    } catch {
      // anonymous view — ignore invalid tokens on public endpoints
    }
  }
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: AuthedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(new AuthError());
    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError('Insufficient permissions for this role'));
    }
    next();
  };
}

export const requireAdmin = requireRole('ADMIN');
export const requireOrgOrAdmin = requireRole('ORG', 'ADMIN');
export const requireCustomer = requireRole('CUSTOMER', 'ADMIN');