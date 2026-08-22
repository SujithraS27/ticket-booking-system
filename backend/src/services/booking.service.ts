import { Prisma, type SeatCategory } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { generateBookingReference } from '../lib/references';
import { generateQrDataUrl } from '../lib/qr';
import { emitShowSeats } from '../lib/seatEvents';
import { notifyBookingConfirmed } from '../lib/email';
import {
  AppError,
  ForbiddenError,
  HoldExpiredError,
  NotFoundError,
  SeatConflictError,
} from '../lib/errors';
import { lockShowSeats, type Tx } from './hold.service';

/**
 * BOOKING / CONFIRM PURCHASE
 * --------------------------
 * Converts held (or waitlist-offered) seats into a confirmed booking,
 * generates the QR ticket and streams real-time seat updates.
 */

function assertNotConflict(row: {
  status: string;
  heldById: string | null;
  holdExpiresAt: string | Date | null;
}, userId: string): void {
  if (row.status === 'BOOKED') {
    throw new SeatConflictError('One or more seats are already booked');
  }
  if (row.status !== 'HELD' && row.status !== 'OFFERED') {
    throw new SeatConflictError('One or more seats are not available to book');
  }
  if (row.heldById !== userId) {
    throw new SeatConflictError('One or more seats are held by someone else');
  }
  if (row.holdExpiresAt && new Date(row.holdExpiresAt).getTime() <= Date.now()) {
    throw new HoldExpiredError('Seat hold/offer expired before booking completed');
  }
}

/**
 * Shared seat-to-booking step. Re-locks the rows `FOR UPDATE` and
 * re-validates status, holder and TTL before writing atomically.
 */
export async function bookSeatsInTx(
  tx: Tx,
  opts: { userId: string; showId: string; showSeatIds: string[]; reference: string },
): Promise<{
  bookingId: string;
  reference: string;
  totalCents: number;
  labels: Array<{ label: string; category: SeatCategory }>;
  qrDataUrl: string;
}> {
  const seatIds = Array.from(new Set(opts.showSeatIds));
  if (seatIds.length === 0) {
    throw new AppError(400, 'At least one seat is required', 'VALIDATION_ERROR');
  }

  const rows = await lockShowSeats(tx, opts.showId, seatIds);
  if (rows.length !== seatIds.length) {
    throw new NotFoundError('One or more seats do not belong to this show');
  }
  rows.forEach((r) => assertNotConflict(r, opts.userId));

  const show = await tx.show.findUnique({
    where: { id: opts.showId },
    include: { pricing: true, venue: true },
  });
  if (!show) throw new NotFoundError('Show not found');

  const detail = await tx.showSeat.findMany({
    where: { id: { in: seatIds } },
    include: { seat: { select: { label: true, category: true } } },
  });
  const priceByCategory = new Map(show.pricing.map((p) => [p.category, p.priceCents]));
  const seatsMeta = detail.map((s) => ({
    label: s.seat.label,
    category: s.seat.category,
    priceCents: priceByCategory.get(s.seat.category) ?? 0,
  }));
  const totalCents = seatsMeta.reduce((sum, s) => sum + s.priceCents, 0);

  const user = await tx.user.findUnique({ where: { id: opts.userId } });
  const qrDataUrl = await generateQrDataUrl({
    system: 'TBS',
    ref: opts.reference,
    event: show.title,
    venue: show.venue.name,
    startsAt: show.startsAt.toISOString(),
    seats: seatsMeta.map((s) => s.label),
    holder: user?.name ?? 'Customer',
  });

  const booking = await tx.booking.create({
    data: { reference: opts.reference, showId: opts.showId, userId: opts.userId, totalCents, qrDataUrl },
  });

  await tx.showSeat.updateMany({
    where: { id: { in: seatIds }, heldById: opts.userId, status: { in: ['HELD', 'OFFERED'] } },
    data: { status: 'BOOKED', bookingId: booking.id, holdExpiresAt: null },
  });

  await tx.ticket.createMany({
    data: detail.map((s) => ({
      bookingId: booking.id,
      showId: opts.showId,
      seatLabel: s.seat.label,
      seatId: s.seatId,
      category: s.seat.category,
      qrDataUrl,
    })),
  });

  return {
    bookingId: booking.id,
    reference: booking.reference,
    totalCents,
    labels: seatsMeta,
    qrDataUrl,
  };
}

/** Public API used by `POST /api/bookings`. */
export async function createBooking(userId: string, showId: string, seatIds: string[]) {
  const reference = generateBookingReference();
  const outcome = await prisma.$transaction(
    async (tx) => bookSeatsInTx(tx, { userId, showId, showSeatIds: seatIds, reference }),
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  );

  await emitShowSeats(showId, seatIds);

  // Send the QR ticket email. Best-effort: failures are logged, never
  // fail the booking — but we await the attempt so callers/tests observe it.
  await deliverBookingEmail(userId, showId, outcome);

  return {
    booking: {
      id: outcome.bookingId,
      reference: outcome.reference,
      totalCents: outcome.totalCents,
      qrDataUrl: outcome.qrDataUrl,
      status: 'CONFIRMED',
    },
    seats: outcome.labels,
  };
}

export async function deliverBookingEmail(
  userId: string,
  showId: string,
  outcome: Awaited<ReturnType<typeof bookSeatsInTx>>,
): Promise<void> {
  try {
    const [user, show] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.show.findUnique({ where: { id: showId }, include: { venue: true } }),
    ]);
    if (!user || !show) return;
    notifyBookingConfirmed({
      to: user.email,
      customerName: user.name,
      reference: outcome.reference,
      eventTitle: show.title,
      venueName: show.venue.name,
      startsAt: show.startsAt,
      seats: outcome.labels.map((l) => ({ label: l.label, category: l.category })),
      totalCents: outcome.totalCents,
      qrDataUrl: outcome.qrDataUrl,
    });
  } catch (err) {
    console.error('[email] booking confirmation delivery failed:', err);
  }
}

export interface BookingWithShow extends Prisma.BookingGetPayload<{
  include: {
    show: { include: { venue: true } };
    seats: { include: { seat: true } };
    tickets: true;
  };
}> {}

export async function getBookingForUser(bookingId: string, userId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      show: { include: { venue: true } },
      seats: { include: { seat: true } },
    },
  });
  if (!booking) throw new NotFoundError('Booking not found');
  if (booking.userId !== userId) throw new ForbiddenError('You do not own this booking');
  return booking;
}

export async function listUserBookings(userId: string) {
  return prisma.booking.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      show: { include: { venue: true } },
      seats: { include: { seat: true } },
      tickets: { select: { id: true, seatLabel: true, category: true } },
    },
  });
}