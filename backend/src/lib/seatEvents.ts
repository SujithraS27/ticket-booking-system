import { prisma } from './prisma';
import { emitSeatUpdate, emitShowStats, type SeatUpdate, type ShowStatsUpdate } from './events';

const SEAT_INCLUDE = {
  seat: { select: { label: true, row: true, col: true, category: true } },
} as const;

export function seatRowToDto(s: {
  id: string;
  seatId: string;
  status: string;
  seat: { label: string; row: number; col: number; category: string };
  holdExpiresAt: Date | null;
}): SeatUpdate['seats'][number] {
  return {
    id: s.id,
    seatId: s.seatId,
    label: s.seat.label,
    row: s.seat.row,
    col: s.seat.col,
    category: s.seat.category,
    status: s.status,
    holdExpiresAt: s.holdExpiresAt ? s.holdExpiresAt.toISOString() : null,
  };
}

/**
 * Loads the given show-seat rows and emits their current state to the
 * `seat:update` channel (wired to the Socket.IO room in server.ts).
 */
export async function emitShowSeats(showId: string, ids: string[]): Promise<void> {
  const uniqueIds = Array.from(new Set(ids));
  if (uniqueIds.length === 0) return;
  const fresh = await prisma.showSeat.findMany({
    where: { id: { in: uniqueIds } },
    include: SEAT_INCLUDE,
  });
  if (fresh.length === 0) return;
  const payload: SeatUpdate = { showId, seats: fresh.map(seatRowToDto) };
  emitSeatUpdate(payload);
  await emitSeatTotals(showId);
}

/** Recomputes and emits the AVAILABLE/HELD/BOOKED/OFFERED counters. */
export async function emitSeatTotals(showId: string): Promise<void> {
  const groups = await prisma.showSeat.groupBy({
    by: ['status'],
    where: { showId },
    _count: { _all: true },
  });
  const stats: ShowStatsUpdate['stats'] = { available: 0, held: 0, booked: 0, offered: 0 };
  for (const g of groups) {
    const key = g.status.toLowerCase() as keyof ShowStatsUpdate['stats'];
    if (key in stats) stats[key] = g._count._all;
  }
  emitShowStats({ showId, stats, updatedAt: new Date().toISOString() });
}