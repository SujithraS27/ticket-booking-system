import { Prisma } from '@prisma/client';
import { config } from '../config';
import { prisma } from '../lib/prisma';
import { emitShowSeats } from '../lib/seatEvents';
import { AppError, NotFoundError, SeatConflictError } from '../lib/errors';

/**
 * SEAT HOLDING & CONCURRENCY PROTECTION
 * -------------------------------------
 * Every hold/booking mutation happens inside an interactive PostgreSQL
 * transaction. Rows are locked with `SELECT ... FOR UPDATE` before their
 * status is inspected, so concurrent requests for the same seat serialize:
 *  - T1 locks the row, sees status AVAILABLE, holds it, commits.
 *  - T2 blocks on T1's row lock until T1 commits, then sees status HELD
 *    and fails with 409 SEAT_CONFLICT.
 * A conditional `updateMany(where: { status: AVAILABLE })` acts as a second,
 * atomic guard (a PostgreSQL row can be updated by exactly one transaction).
 * No frontend state or in-process variable is ever used for protection.
 */

export type Tx = Prisma.TransactionClient;

export interface LockedShowSeatRow {
  id: string;
  seatId: string;
  status: string;
  heldById: string | null;
  holdExpiresAt: string | Date | null;
}

const SEAT_INCLUDE = {
  seat: { select: { label: true, row: true, col: true, category: true } },
} as const;

/** Lock per-show seat rows `FOR UPDATE` for the remainder of the transaction. */
export async function lockShowSeats(
  tx: Tx,
  showId: string,
  seatIds: string[],
): Promise<LockedShowSeatRow[]> {
  if (seatIds.length === 0) return [];
  return tx.$queryRaw<LockedShowSeatRow[]>(Prisma.sql`
    SELECT "id", "seatId", status, "heldById", "holdExpiresAt"
    FROM "ShowSeat"
    WHERE "showId" = ${showId} AND "id" IN (${Prisma.join(seatIds)})
    FOR UPDATE
  `);
}

export interface HeldSeatDto {
  id: string;
  seatId: string;
  label: string;
  row: number;
  col: number;
  category: string;
  status: string;
  holdExpiresAt: string | null;
}

export interface HoldResult {
  showId: string;
  expiresAt: string;
  seats: HeldSeatDto[];
}

export function seatsToDto(
  rows: Array<{
    id: string;
    seatId: string;
    status: string;
    holdExpiresAt: Date | null;
    seat: { label: string; row: number; col: number; category: string };
  }>,
): HeldSeatDto[] {
return rows.map((s) => ({
    id: s.id,
    seatId: s.seatId,
    label: s.seat.label,
    row: s.seat.row,
    col: s.seat.col,
    category: s.seat.category,
    status: s.status,
    holdExpiresAt: s.holdExpiresAt ? s.holdExpiresAt.toISOString() : null,
  }));
}

/**
 * Atomically places a hold on seats. `ttlMs` defaults to the configurable
 * SEAT_HOLD_TTL_MS (default 10 minutes). This is the primary concurrency
 * choke point for simultaneous seat selection.
 */
export async function holdSeats(
  showId: string,
  userId: string,
  requestedSeatIds: string[],
  ttlMs: number = config.seatHoldTtlMs,
): Promise<HoldResult> {
  const seatIds = Array.from(new Set(requestedSeatIds));
  if (seatIds.length === 0) {
    throw new AppError(400, 'At least one seat id is required', 'VALIDATION_ERROR');
  }

  const now = Date.now();
  const expiresAt = new Date(now + ttlMs);

  try {
    const completed = await prisma.$transaction(
      async (tx) => {
        const rows = await lockShowSeats(tx, showId, seatIds);
        if (rows.length !== seatIds.length) {
          throw new NotFoundError('One or more seats do not belong to this show');
        }

        const taken = rows.find((r) => r.status !== 'AVAILABLE');
        if (taken) {
          throw new SeatConflictError(
            `Seat is already ${taken.status.toLowerCase()} — it cannot be held by you at this time`,
          );
        }

        // Second atomic guard: this UPDATE only matches rows still AVAILABLE,
        // and a PostgreSQL row can be updated by exactly one transaction.
        const updated = await tx.showSeat.updateMany({
          where: { showId, id: { in: seatIds }, status: 'AVAILABLE' },
          data: {
            status: 'HELD',
            heldById: userId,
            holdExpiresAt: expiresAt,
            holdStartedAt: new Date(now),
            bookingId: null,
          },
        });
        if (updated.count !== seatIds.length) {
          throw new SeatConflictError('One or more seats changed state while being held');
        }

        return tx.showSeat.findMany({ where: { id: { in: seatIds } }, include: SEAT_INCLUDE });
      },
      // READ COMMITTED + FOR UPDATE row locks are sufficient and avoid
      // serializable-failure false positives between non-overlapping holds.
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );

    await emitShowSeats(showId, completed.map((s) => s.id));

    return {
      showId,
      expiresAt: expiresAt.toISOString(),
      seats: seatsToDto(completed),
    };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034') {
      throw new SeatConflictError('Another customer selected the same seat at the same time');
    }
    throw err;
  }
}

/** Explicit release of a hold (customer abandons checkout). */
export async function releaseHeldSeats(
  showId: string,
  userId: string,
  seatIds: string[],
): Promise<number> {
  const released = await prisma.showSeat.updateMany({
    where: { showId, id: { in: seatIds }, status: 'HELD', heldById: userId },
    data: { status: 'AVAILABLE', heldById: null, holdExpiresAt: null, holdStartedAt: null },
  });
  if (released.count > 0) {
    await emitShowSeats(showId, seatIds);
  }
  return released.count;
}

/**
 * Enforces the hold TTL at the database level: every HELD seat whose
 * `holdExpiresAt` is in the past is flipped back to AVAILABLE.
 * Runs periodically via the scheduler and on demand via an admin endpoint.
 */
export async function releaseExpiredHolds(now: Date = new Date()): Promise<number> {
  const expired = await prisma.showSeat.findMany({
    where: { status: 'HELD', holdExpiresAt: { lt: now } },
    select: { id: true, showId: true },
    take: 500,
  });
  if (expired.length === 0) return 0;

  const res = await prisma.showSeat.updateMany({
    where: { status: 'HELD', holdExpiresAt: { lt: now }, id: { in: expired.map((e) => e.id) } },
    data: { status: 'AVAILABLE', heldById: null, holdExpiresAt: null, holdStartedAt: null },
  });

  const perShow = new Map<string, string[]>();
  for (const e of expired) {
    const list = perShow.get(e.showId) ?? [];
    list.push(e.id);
    perShow.set(e.showId, list);
  }
  for (const [showId, ids] of perShow) {
    await emitShowSeats(showId, ids);
  }
  return res.count;
}