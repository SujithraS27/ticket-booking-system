import type { NextFunction, Request, Response } from 'express';
import { z, ZodError } from 'zod';
import { AppError } from '../lib/errors';

/**
 * Validates `req.body` (or a custom source) against a zod schema.
 * Replaces `req.body` with the parsed (stripped) result.
 */
export function validateBody(schema: z.ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(
          new AppError(
            400,
            'Validation failed',
            'VALIDATION_ERROR',
            err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
          ),
        );
      } else {
        next(err);
      }
    }
  };
}