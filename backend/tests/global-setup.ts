import 'dotenv/config';
import { execFileSync } from 'child_process';
import path from 'path';

/**
 * Vitest global setup (runs once, in its own worker pool).
 * Pushes the Prisma schema onto the TEST database so tests run against a
 * clean, up-to-date schema, then truncates all data.
 */

function pickPrismaCli(): string[] {
  const candidates = [
    path.resolve(process.cwd(), 'node_modules', 'prisma', 'build', 'index.js'),
    path.resolve(process.cwd(), '..', 'node_modules', 'prisma', 'build', 'index.js'),
    path.resolve(process.cwd(), '..', '..', 'node_modules', 'prisma', 'build', 'index.js'),
  ];
  for (const c of candidates) {
    try {
      require.resolve(c);
      return [c];
    } catch {
      /* try next */
    }
  }
  return ['prisma']; // fall back to PATH / npx resolution
}

export default async function globalSetup(): Promise<void> {
  const url =
    process.env.TEST_DATABASE_URL?.trim() ||
    'postgresql://postgres:password@localhost:5432/ticket_booking_test';
  process.env.DATABASE_URL = url;

  const cli = pickPrismaCli();
  execFileSync(process.execPath, [...cli, 'db', 'push', '--skip-generate', '--accept-data-loss'], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });
}