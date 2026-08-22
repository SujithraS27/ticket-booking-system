import { config } from '../config';
import { releaseExpiredHolds } from './hold.service';
import { resolveExpiredOffers } from './waitlist.service';

/**
 * AUTOMATIC EXPIRED-HOLD / EXPIRED-OFFER RELEASE
 * ----------------------------------------------
 * A background loop (configurable SCHEDULER_INTERVAL_MS) enforces the
 * seat-hold TTL entirely on the backend/database side:
 *   - HELD seats with holdExpiresAt < now  -> back to AVAILABLE
 *   - ACTIVE waitlist offers with expiresAt < now -> expire + hand the
 *     seat to the next waitlist customer (or make it AVAILABLE)
 * An explicit admin endpoint can trigger the same work on demand.
 */

let running = false;
let timer: NodeJS.Timeout | null = null;

export async function runSchedulerOnce(now: Date = new Date()): Promise<{
  holdsReleased: number;
  offersResolved: number;
}> {
  if (running) return { holdsReleased: 0, offersResolved: 0 };
  running = true;
  try {
    const holdsReleased = await releaseExpiredHolds(now);
    const offersResolved = await resolveExpiredOffers(now);
    return { holdsReleased, offersResolved };
  } finally {
    running = false;
  }
}

export function startScheduler(): NodeJS.Timeout {
  if (!config.startScheduler) return null as unknown as NodeJS.Timeout;
  stopScheduler();
  timer = setInterval(() => {
    runSchedulerOnce().catch((err) => {
      console.error('[scheduler] tick failed:', err);
    });
  }, config.schedulerIntervalMs);
  // run immediately on startup too
  runSchedulerOnce().catch((err) => {
    console.error('[scheduler] initial run failed:', err);
  });
  return timer;
}

export function stopScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}