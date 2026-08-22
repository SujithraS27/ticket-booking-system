import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { emitShowSeats } from '../lib/seatEvents';
import { notifyWaitlistOffer } from '../lib/email';
import { ForbiddenError, NotFoundError, AppError } from '../lib/errors';
import { lockShowSeats } from './hold.service';
import { offerSeatToNext } from './waitlist.service';

/**
 * CANCELLATION + AUTOMATIC WAITLIST REALLOCATION
 * ----------------------------------------------
 * Cancelling a booking follows the PDF requirement exactly:
 * 1. The booking is marked CANCELLED inside a transaction.
 * 2. Each released seat is looked up against the FIFO waitlist for its
 *    category and atomically handed to the NEXT eligible customer as a
 *    time-limited OFFER (never left silently available while people wait).
 * 3. If the queue is empty the seat simply returns to AVAILABLE.
 * 4. Emails with the time-limited links are queued after the commit.
 */

export interface CancelOutcome {
  bookingId: string;
  reference: string;
  seatsReleased: number;
  offersCreated: Array<{
    token: string;
    seatLabel: string;
    category: string;
    customerId: string;
    expiresAt: string;
  }>;
}

export async function cancelBooking(
  callerId: string,
  callerRole: 'ADMIN' | 'ORG' | 'CUSTOMER',
  bookingId: string,
): Promise<CancelOutcome> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { show: true, seats: { include: { seat: true } } },
  });
  if (!booking) throw new NotFoundError('Booking not found');

  const isOrganizer = callerRole === 'ORG' && booking.show.organizerId === callerId;
  if (booking.userId !== callerId && callerRole !== 'ADMIN' && !isOrganizer) {
    throw new ForbiddenError('You cannot cancel this booking');
  }
  if (booking.status === 'CANCELLED') {
    throw new AppError(409, 'Booking is already cancelled', 'ALREADY_CANCELLED');
  }

  const offersCreated: CancelOutcome['offersCreated'] = [];

  await prisma.$transaction(
    async (tx) => {
      // Re-lock every seat of the booking to serialize concurrent cancellations.
      await lockShowSeats(tx, booking.showId, booking.seats.map((s) => s.id));

      await tx.booking.update({
        where: { id: booking.id },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });

      for (const row of booking.seats) {
        const offer = await offerSeatToNext(tx, {
          showId: booking.showId,
          showSeatId: row.id,
          category: row.seat.category,
        });
        if (offer) {
          offersCreated.push({
            token: offer.token,
            seatLabel: row.seat.label,
            category: row.seat.category,
            customerId: offer.entryUserId,
            expiresAt: offer.expiresAt.toISOString(),
          });
        }
      }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  );

    await emitShowSeats(booking.showId, booking.seats.map((s) => s.id));

  // Email each waitlisted customer their time-limited offer link.
  await deliverOfferEmails(booking.showId, offersCreated);

  return {
    bookingId: booking.id,
    reference: booking.reference,
    seatsReleased: booking.seats.length,
    offersCreated,
  };
}

async function deliverOfferEmails(
  showId: string,
  offers: CancelOutcome['offersCreated'],
): Promise<void> {
  try {
    const [show, users] = await Promise.all([
      prisma.show.findUnique({ where: { id: showId }, include: { pricing: true } }),
      prisma.user.findMany({ where: { id: { in: offers.map((o) => o.customerId) } } }),
    ]);
    const byId = new Map(users.map((u) => [u.id, u]));
    for (const offer of offers) {
      const customer = byId.get(offer.customerId);
      if (!customer || !show) continue;
      const price = show.pricing.find((p) => p.category === offer.category);
      notifyWaitlistOffer({
        to: customer.email,
        customerName: customer.name,
        eventTitle: show.title,
        seatLabel: offer.seatLabel,
        priceCents: price?.priceCents ?? 0,
        expiresAt: new Date(offer.expiresAt),
        token: offer.token,
      });
    }
  } catch (err) {
    console.error('[email] waitlist offer delivery failed:', err);
  }
}
