import { ShowType, SeatCategory } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { emitShowSeats } from '../lib/seatEvents';
import { AppError, ForbiddenError, NotFoundError } from '../lib/errors';

/**
 * EVENT / SHOW MANAGEMENT (organiser + admin)
 * Creating a show provisions one ShowSeat row per physical venue seat,
 * plus per-category pricing, in a single transaction.
 */

const SHOW_INCLUDE = {
  venue: true,
  organizer: { select: { id: true, name: true, email: true } },
  pricing: true,
} as const;

export interface CreateShowInput {
  title: string;
  type: ShowType;
  description?: string;
  venueId: string;
  startsAt: string;
  premiumPriceCents?: number;
  standardPriceCents?: number;
  prices?: Array<{ category: SeatCategory; priceCents: number }>;
}

export async function listShows(filters: { type?: string; city?: string; search?: string } = {}) {
  const where = {
    ...(filters.type ? { type: filters.type as ShowType } : {}),
    ...(filters.city ? { venue: { city: filters.city } } : {}),
    ...(filters.search
      ? { title: { contains: filters.search, mode: 'insensitive' as const } }
      : {}),
  };
  const shows = await prisma.show.findMany({
    where,
    orderBy: { startsAt: 'asc' },
    include: { ...SHOW_INCLUDE, showSeats: true },
  });
  return shows.map((s) => ({
    id: s.id,
    title: s.title,
    type: s.type,
    description: s.description,
    startsAt: s.startsAt,
    venue: { id: s.venue.id, name: s.venue.name, city: s.venue.city },
    organizer: s.organizer,
    pricing: s.pricing.map((p) => ({ category: p.category, priceCents: p.priceCents })),
    stats: {
      available: s.showSeats.filter((x) => x.status === 'AVAILABLE').length,
      held: s.showSeats.filter((x) => x.status === 'HELD').length,
      booked: s.showSeats.filter((x) => x.status === 'BOOKED').length,
      offered: s.showSeats.filter((x) => x.status === 'OFFERED').length,
    },
  }));
}

export async function getShowDetail(showId: string) {
  const show = await prisma.show.findUnique({
    where: { id: showId },
    include: SHOW_INCLUDE,
  });
  if (!show) throw new NotFoundError('Show not found');
  return show;
}
export async function createShow(organizerId: string, input: CreateShowInput) {
  const venue = await prisma.venue.findUnique({ where: { id: input.venueId } });
  if (!venue) throw new NotFoundError('Venue not found');
  if (input.premiumPriceCents !== undefined && input.premiumPriceCents <= 0) {
    throw new AppError(400, 'premiumPriceCents must be positive');
  }
  if (input.standardPriceCents !== undefined && input.standardPriceCents <= 0) {
    throw new AppError(400, 'standardPriceCents must be positive');
  }
  const startsAt = new Date(input.startsAt);
  if (Number.isNaN(startsAt.getTime())) {
    throw new AppError(400, 'invalid startsAt date', 'VALIDATION_ERROR');
  }

  const prices = new Map<SeatCategory, number>();
  for (const p of input.prices ?? []) prices.set(p.category, p.priceCents);
  if (prices.has('PREMIUM') === false && input.premiumPriceCents !== undefined) {
    prices.set('PREMIUM', input.premiumPriceCents);
  }
  if (prices.has('STANDARD') === false && input.standardPriceCents !== undefined) {
    prices.set('STANDARD', input.standardPriceCents);
  }
  if (prices.size === 0) {
    throw new AppError(400, 'Provide pricing for at least one category', 'VALIDATION_ERROR');
  }

  const show = await prisma.$transaction(async (tx) => {
    const created = await tx.show.create({
      data: {
        title: input.title,
        type: input.type,
        description: input.description,
        venueId: input.venueId,
        organizerId,
        startsAt,
      },
    });
    await tx.pricing.createMany({
      data: [...prices.entries()].map(([category, priceCents]) => ({
        showId: created.id,
        category,
        priceCents,
      })),
    });
    const seats = await tx.seat.findMany({ where: { venueId: input.venueId } });
    await tx.showSeat.createMany({
      data: seats.map((seat) => ({ showId: created.id, seatId: seat.id, status: 'AVAILABLE' })),
    });
    return created;
  });

  return show;
}

/** Organisers (and admins) can void a show; all its seats return to AVAILABLE. */
export async function cancelShowForOrganizer(
  callerId: string,
  callerRole: 'ORG' | 'ADMIN',
  showId: string,
) {
  const show = await prisma.show.findUnique({ where: { id: showId } });
  if (!show) throw new NotFoundError('Show not found');
  if (callerRole === 'ORG' && show.organizerId !== callerId) {
    throw new ForbiddenError('Not your show');
  }
  await prisma.$transaction([
    prisma.showSeat.updateMany({
      where: { showId },
      data: { status: 'AVAILABLE', heldById: null, holdExpiresAt: null, bookingId: null, holdStartedAt: null },
    }),
    prisma.booking.updateMany({
      where: { showId },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    }),
  ]);
  await emitShowSeats(showId, []);
  return { id: showId, status: 'cancelled' };
}

/**
 * Aggregated seat statuses for the visual seat map. Returns one DTO per
 * show-seat with prices merged from the show's per-category pricing.
 */
export async function getSeatMap(showId: string, userId?: string | null) {
  const show = await prisma.show.findUnique({
    where: { id: showId },
    include: { pricing: true },
  });
  if (!show) throw new NotFoundError('Show not found');

  const priceByCategory = new Map(show.pricing.map((p) => [p.category, p.priceCents]));
  const rows = await prisma.showSeat.findMany({
    where: { showId },
    include: {
      seat: { select: { id: true, label: true, row: true, col: true, category: true } },
    },
    orderBy: [{ seat: { row: 'asc' } }, { seat: { col: 'asc' } }],
  });

  return {
    showId,
    seats: rows.map((s) => ({
      id: s.id,
      seatId: s.seatId,
      label: s.seat.label,
      row: s.seat.row,
      col: s.seat.col,
      category: s.seat.category,
      status: s.status,
      priceCents: priceByCategory.get(s.seat.category) ?? 0,
      holdExpiresAt: s.holdExpiresAt ? s.holdExpiresAt.toISOString() : null,
      heldByMe: s.heldById ? (userId ? s.heldById === userId : false) : null,
    })),
  };
}