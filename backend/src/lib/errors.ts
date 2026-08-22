/**
 * Application errors mapped to HTTP status codes by the error handler.
 */
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = 'APP_ERROR',
    public details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class AuthError extends AppError {
  constructor(message = 'Not authenticated') {
    super(401, message, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Not allowed') {
    super(403, message, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(404, message, 'NOT_FOUND');
  }
}

/** Seat could not be held/booked because another request got there first. */
export class SeatConflictError extends AppError {
  constructor(message = 'One or more seats are no longer available') {
    super(409, message, 'SEAT_CONFLICT');
  }
}

/** A hold or offer has expired. */
export class HoldExpiredError extends AppError {
  constructor(message = 'Seat hold has expired') {
    super(410, message, 'HOLD_EXPIRED', 'presentable');
  }
}

export class WaitlistConflictError extends AppError {
  constructor(message = 'You already have an active waitlist entry for this category') {
    super(409, message, 'WAITLIST_CONFLICT');
  }
}