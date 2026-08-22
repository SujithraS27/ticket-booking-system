import { Prisma, type SeatCategory } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { config } from '../config';
import { generateBookingReference, generateToken } from '../lib/references';
import { emitShowSeats } from '../lib/seatEvents';
import { generateQrDataUrl } from '../lib/qr';
import {
  AppError,
  HoldExpiredError,
  NotFoundError,
  SeatConflictError,
  WaitlistConflictError,
} from '../lib/errors';
import { bookSeatsInTx, deliverBookingEmail } from './booking.service';
import { lockShowSeats, type Tx } from './hold.service';

/**
 * WAITLIST & TIME-LIMITED OFFERS
 * ------------------------------
 * The waitlist is a real ordered FIFO queue (per show + seat category),
 * ordered by the monotonically increasing `position` column.
 *
 * When a cancelled/expired seat becomes available it is never handed to
 * random browsers â€” it is atomically assigned to the next WAITING entry
 * as an `OFFERED` seat with a time-limited link. If the offer is not
 * accepted before `WAITLIST_OFFER_TTL_MS`, the scheduler expires it and
 * re-offers the same seat to the next person in line.
 */

export async function joinWaitlist(userId: string, showId: string, category: string) {
  if (category !== 'PREMIUM' && category !== 'STANDARD') {
    throw new AppError(400, 'Invalid seat category', 'VALIDATION_ERROR');
  }
  const cat = category as SeatCategory;
  const show = await prisma.show.findUnique({ where: { id: showId } });
  if (!show) throw new NotFoundError('Show not found');

  const existing = await prisma.waitlistEntry.findFirst({
    where: { showId, userId, category: cat, status: { in: ['WAITING', 'OFFERED'] } },
  });
  if (existing) throw new WaitlistConflictError();

  const available = await prisma.showSeat.count({
    where: { showId, status: 'AVAILABLE', seat: { category: cat } },
  });
  if (available > 0) {
    throw new AppError(400, 'Seats are still available for this category â€” book them instead');
  }

  const entry = await prisma.waitlistEntry.create({
    data: { showId, userId, category: cat, status: 'WAITING' },
  });
  return {
    id: entry.id,
    showId,
    category: cat,
    position: entry.position.toString(),
    status: entry.status,
    createdAt: entry.createdAt.toISOString(),
  };
}

export async function leaveWaitlist(userId: string, showId: string, category: string) {
  const cat = category as SeatCategory;
  const entry = await prisma.waitlistEntry.findFirst({
    where: { showId, userId, category: cat, status: 'WAITING' },
  });
  if (!entry) throw new NotFoundError('No active waitlist entry found');
  await prisma.waitlistEntry.update({
    where: { id: entry.id },
    data: { status: 'CANCELLED' },
  });
  return { id: entry.id, status: 'CANCELLED' };
}

interface OfferSeatInput {
  showId: string;
  showSeatId: string;
  category: SeatCategory;
}

/**
 * Atomically picks the next WAITING entry (FIFO by `position`) for a
 * category and ties the released seat to that customer with a new
 * time-limited offer. Returns the created offer or null when the queue
 * is empty (in which case the seat is released to AVAILABLE). Must be
 * called from within a transaction so the seat can never be double-claimed.
 */
export async function offerSeatToNext(
  tx: Tx,
  input: OfferSeatInput,
): Promise<{ offerId: string; token: string; expiresAt: Date; entryUserId: string; entryId: string } | null> {
  const next = await tx.waitlistEntry.findFirst({
    where: { showId: input.showId, category: input.category, status: 'WAITING' },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  });

  if (!next) {
    await tx.showSeat.update({
      where: { id: input.showSeatId },
      data: {
        status: 'AVAILABLE',
        heldById: null,
        holdExpiresAt: null,
        holdStartedAt: null,
        bookingId: null,
      },
    });
    return null;
  }

  const token = generateToken();
  const expiresAt = new Date(Date.now() + config.waitlistOfferTtlMs);

  const offer = await tx.waitlistOffer.create({
    data: { token, entryId: next.id, showSeatId: input.showSeatId, expiresAt, status: 'ACTIVE' },
  });
  await tx.waitlistEntry.update({ where: { id: next.id }, data: { status: 'OFFERED' } });
  await tx.showSeat.update({
    where: { id: input.showSeatId },
    data: {
      status: 'OFFERED',
      heldById: next.userId,
      holdExpiresAt: expiresAt,
      holdStartedAt: new Date(),
      bookingId: null,
    },
  });

  return {
    offerId: offer.id,
    token,
    expiresAt,
    entryUserId: next.userId,
    entryId: next.id,
  };
}
/**
 * Marks an ACTIVE offer as expired and hands the seat to the next person
 * in the queue (or releases it when the queue is empty). Runs inside the
 * caller's transaction.
 */
export async function expireOfferAndReoffer(tx: Tx, offerId: string): Promise<boolean> {
  const offer = await tx.waitlistOffer.findUnique({
    where: { id: offerId },
    include: { entry: true, showSeat: { include: { seat: true } } },
  });
  if (!offer || offer.status !== 'ACTIVE') return false;

  await tx.waitlistOffer.update({
    where: { id: offer.id },
    data: { status: 'EXPIRED', respondedAt: new Date() },
  });
  await tx.waitlistEntry.update({
    where: { id: offer.entryId },
    data: { status: 'EXPIRED' },
  });

  await offerSeatToNext(tx, {
    showId: offer.showSeat.showId,
    showSeatId: offer.showSeat.id,
    category: offer.showSeat.seat.category,
  });
  return true;
}

/**
 * Scheduler step: every ACTIVE offer past its TTL is expired and the
 * seat is re-offered to the next customer in line (FIFO), guaranteeing
 * the seat is never left stranded or double-assigned.
 */
export async function resolveExpiredOffers(now: Date = new Date()): Promise<number> {
  const expired = await prisma.waitlistOffer.findMany({
    where: { status: 'ACTIVE', expiresAt: { lt: now } },
    orderBy: { expiresAt: 'asc' },
    take: 100,
  });
  if (expired.length === 0) return 0;

  const handledShows = new Set<string>();
  let handled = 0;
  for (const offer of expired) {
    try {
      const changed = await prisma.$transaction(async (tx) => {
        return expireOfferAndReoffer(tx, offer.id);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
      if (changed) {
        handled += 1;
        const fresh = await prisma.showSeat.findUnique({
          where: { id: offer.showSeatId },
          select: { showId: true },
        });
        if (fresh) handledShows.add(fresh.showId);
      }
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034') {
        continue; // lost a serialization race; the next scheduler tick retries
      }
      throw err;
    }
  }
  for (const showId of handledShows) {
    await emitShowSeats(showId, await prisma.showSeat.findMany({
      where: { showId, status: { in: ['OFFERED', 'AVAILABLE'] } },
      select: { id: true },
    }).then((r) => r.map((x) => x.id)));
  }
  return handled;
}
export interface OfferInfo {
  token: string;
  status: string;
  expiresAt: string;
  customerId: string;
  show: {
    id: string;
    title: string;
    type: string;
    startsAt: string;
    venue: { name: string; city: string };
  };
  seat: {
    id: string;
    label: string;
    row: number;
    col: number;
    category: string;
    priceCents: number;
  };
}

export async function getOfferByToken(token: string): Promise<OfferInfo> {
  const offer = await prisma.waitlistOffer.findUnique({
    where: { token },
    include: {
      entry: true,
      showSeat: {
        include: { seat: true, show: { include: { venue: true, pricing: true } } },
      },
    },
  });
  if (!offer) throw new NotFoundError('Offer not found');
  const price = offer.showSeat.show.pricing.find(
    (p) => p.category === offer.showSeat.seat.category,
  );
  return {
    token: offer.token,
    status: offer.status,
    expiresAt: offer.expiresAt.toISOString(),
    customerId: offer.entry.userId,
    show: {
      id: offer.showSeat.showId,
      title: offer.showSeat.show.title,
      type: offer.showSeat.show.type,
      startsAt: offer.showSeat.show.startsAt.toISOString(),
      venue: { name: offer.showSeat.show.venue.name, city: offer.showSeat.show.venue.city },
    },
    seat: {
      id: offer.showSeat.id,
      label: offer.showSeat.seat.label,
      row: offer.showSeat.seat.row,
      col: offer.showSeat.seat.col,
      category: offer.showSeat.seat.category,
      priceCents: price?.priceCents ?? 0,
    },
  };
}
/**
 * Accepts a waitlist offer (time-limited link). Atomically converts the
 * OFFERED seat into a CONFIRMED booking with a QR ticket.
 */
export async function acceptOffer(userId: string, token: string) {
  const offer = await prisma.waitlistOffer.findUnique({
    where: { token },
    include: { entry: true, showSeat: true },
  });
  if (!offer) throw new NotFoundError('Offer not found');
  if (offer.entry.userId !== userId) {
    throw new SeatConflictError('This offer belongs to a different account');
  }

  let outcome: Awaited<ReturnType<typeof bookSeatsInTx>>;
  try {
    outcome = await prisma.$transaction(
      async (tx) => {
        const fresh = await tx.waitlistOffer.findUnique({
          where: { id: offer.id },
          include: { entry: true, showSeat: true },
        });
        if (!fresh || (fresh.status !== 'ACTIVE' && fresh.expiresAt.getTime() > Date.now())) {
          throw new SeatConflictError('This offer has already been resolved');
        }
        if (fresh.expiresAt.getTime() <= Date.now()) {
          // Expired offers (even ones the scheduler already flipped) are gone.
          if (fresh.status === 'ACTIVE') {
            await expireOfferAndReoffer(tx, fresh.id);
          }
          throw new HoldExpiredError('This offer has expired and was passed to the next person');
        }
        if (fresh.showSeat.status !== 'OFFERED' || fresh.showSeat.heldById !== userId) {
          throw new SeatConflictError('This seat is no longer available');
        }
        const book = await bookSeatsInTx(tx, {
          userId,
          showId: fresh.showSeat.showId,
          showSeatIds: [fresh.showSeat.id],
          reference: generateBookingReference(),
        });
        await tx.waitlistOffer.update({
          where: { id: fresh.id },
          data: { status: 'ACCEPTED', respondedAt: new Date(), acceptedBookingId: book.bookingId },
        });
        await tx.waitlistEntry.update({
          where: { id: fresh.entryId },
          data: { status: 'COMPLETED' },
        });
        return book;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034') {
      throw new SeatConflictError('Someone else accepted this offer at the same moment');
    }
    throw err;
  }

  await emitShowSeats(offer.showSeat.showId, [offer.showSeat.id]);

  // Email the accepted ticket (QR) to the customer.
  await deliverBookingEmail(userId, offer.showSeat.showId, outcome);

  return {
    reference: outcome.reference,
    bookingId: outcome.bookingId,
    totalCents: outcome.totalCents,
    qrDataUrl: outcome.qrDataUrl,
    seats: outcome.labels,
  };
}
/** Customer voluntarily declines their offer â€” the seat moves to the next in line. */
export async function declineOffer(userId: string, token: string): Promise<void> {
  const offer = await prisma.waitlistOffer.findUnique({
    where: { token },
    include: { entry: true, showSeat: true },
  });
  if (!offer) throw new NotFoundError('Offer not found');
  if (offer.entry.userId !== userId) {
    throw new SeatConflictError('This offer belongs to another account');
  }
  if (offer.status !== 'ACTIVE') throw new AppError(409, 'Offer already resolved');

  await prisma.$transaction(
    async (tx) => {
      const fresh = await tx.waitlistOffer.findUnique({ where: { id: offer.id } });
      if (!fresh || fresh.status !== 'ACTIVE') return;
      await expireOfferAndReoffer(tx, fresh.id);
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  );
  await emitShowSeats(offer.showSeat.showId, [offer.showSeat.id]);
}
