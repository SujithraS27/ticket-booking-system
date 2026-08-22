import type { NextFunction, Request, Response } from 'express';

/**
 * Wraps async Express handlers so rejected promises are forwarded
 * to the central error handler.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}