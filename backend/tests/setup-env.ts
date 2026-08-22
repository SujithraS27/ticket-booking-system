import 'dotenv/config';

/**
 * Runs before every test file (in the same worker process).
 * Points Prisma at the dedicated TEST database. dotenv does not override
 * variables that already exist, so these values win over backend/.env.
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://postgres:password@localhost:5432/ticket_booking_test';
process.env.SEAT_HOLD_TTL_MS = process.env.SEAT_HOLD_TTL_MS ?? '60000';
process.env.WAITLIST_OFFER_TTL_MS = process.env.WAITLIST_OFFER_TTL_MS ?? '60000';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
process.env.START_SCHEDULER = 'false'; // never auto-run the scheduler in tests
process.env.EMAIL_TRANSPORT = 'log';