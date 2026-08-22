import type { ShowSeat, SeatStatus } from '@prisma/client';

export interface PublicSeat {
  id: string;
  seatId: string;
  label: string;
  row: number;
  col: number;
  category: string;
  status: SeatStatus;
  priceCents: number;
  holdExpiresAt: string | null;
  heldByMe: boolean | null;
}

export function serializeSeats(
  showSeats: Array<ShowSeat & { seat: { label: string; row: number; col: number; category: string } }>,
  userId?: string | null,
): PublicSeat[] {
  return showSeats.map((s) => ({
    id: s.id,
    seatId: s.seatId,
    label: s.seat.label,
    row: s.seat.row,
    col: s.seat.col,
    category: s.seat.category,
    status: s.status,
    priceCents: 0, // filled in by caller when pricing is available
    holdExpiresAt: s.holdExpiresAt ? s.holdExpiresAt.toISOString() : null,
    heldByMe: s.heldById ? (userId ? s.heldById === userId : false) : null,
  }));
}