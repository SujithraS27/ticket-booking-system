import 'dotenv/config';

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function str(value: string | undefined, fallback: string): string {
  return value && value.trim().length > 0 ? value.trim() : fallback;
}

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes'].includes(value.toLowerCase());
}

export const config = {
  nodeEnv: str(process.env.NODE_ENV, 'development'),
  isDev: str(process.env.NODE_ENV, 'development') !== 'production',
  port: num(process.env.PORT, 5000),
  databaseUrl: str(process.env.DATABASE_URL, ''),
  testDatabaseUrl: str(process.env.TEST_DATABASE_URL, ''),

  jwtSecret: str(process.env.JWT_SECRET, 'dev-secret-change-me'),
  jwtExpiresIn: str(process.env.JWT_EXPIRES_IN, '7d'),
  bcryptRounds: num(process.env.BCRYPT_ROUNDS, 10),

  // Configurable seat hold TTL (default 10 minutes).
  seatHoldTtlMs: num(process.env.SEAT_HOLD_TTL_MS, 10 * 60 * 1000),
  // Configurable time-limited waitlist offer TTL (default 10 minutes).
  waitlistOfferTtlMs: num(process.env.WAITLIST_OFFER_TTL_MS, 10 * 60 * 1000),
  schedulerIntervalMs: num(process.env.SCHEDULER_INTERVAL_MS, 5000),
  startScheduler: bool(process.env.START_SCHEDULER, true),

  emailTransport: str(process.env.EMAIL_TRANSPORT, 'log'), // 'log' | 'smtp'
  emailFrom: str(process.env.EMAIL_FROM, 'Ticket Booking <tickets@example.com>'),
  smtpHost: str(process.env.SMTP_HOST, ''),
  smtpPort: num(process.env.SMTP_PORT, 587),
  smtpUser: str(process.env.SMTP_USER, ''),
  smtpPass: str(process.env.SMTP_PASS, ''),

  frontendUrl: str(process.env.FRONTEND_URL, 'http://localhost:5173'),
  corsOrigins: str(process.env.CORS_ORIGINS, 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
};