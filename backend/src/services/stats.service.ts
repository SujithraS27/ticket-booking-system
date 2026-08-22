import { prisma } from '../lib/prisma';
import { NotFoundError, ForbiddenError } from '../lib/errors';

/**
 * ORGANISER & ADMIN ANALYTICS
 * Booking summary and revenue per event, plus per-show seat breakdowns.
 */

export interface ShowStatsRow {
  showId: string;
  title: string;
  type: string;
  startsAt: Date;
  venueName: string;
  capacity: number;
  bookedSeats: number;
  heldSeats: number;
  availableSeats: number;
  offeredSeats: number;
  bookingsCount: number;
  revenueCents: number;
  ticketsSold: number;
  waitlistCount: number;
}

export async function getOrganiserStats(organizerId: string) {
  const shows = await prisma.show.findMany({
    where: { organizerId },
    orderBy: { startsAt: 'desc' },
    include: {
      venue: true,
      bookings: { where: { status: 'CONFIRMED' }, include: { tickets: true } },
      showSeats: true,
      waitlist: { where: { status: { in: ['WAITING', 'OFFERED'] } } },
    },
  });

  const rows: ShowStatsRow[] = shows.map((show) => {
    const confirmed = show.bookings;
    return {
      showId: show.id,
      title: show.title,
      type: show.type,
      startsAt: show.startsAt,
      venueName: show.venue.name,
      capacity: show.showSeats.length,
      bookedSeats: show.showSeats.filter((s) => s.status === 'BOOKED').length,
      heldSeats: show.showSeats.filter((s) => s.status === 'HELD').length,
      availableSeats: show.showSeats.filter((s) => s.status === 'AVAILABLE').length,
      offeredSeats: show.showSeats.filter((s) => s.status === 'OFFERED').length,
      bookingsCount: confirmed.length,
      revenueCents: confirmed.reduce((sum, b) => sum + b.totalCents, 0),
      ticketsSold: confirmed.reduce((sum, b) => sum + b.tickets.length, 0),
      waitlistCount: show.waitlist.length,
    };
  });

  return {
    rows,
    totals: {
      shows: rows.length,
      revenueCents: rows.reduce((s, r) => s + r.revenueCents, 0),
      ticketsSold: rows.reduce((s, r) => s + r.ticketsSold, 0),
      bookingsCount: rows.reduce((s, r) => s + r.bookingsCount, 0),
    },
  };
}

export async function getShowBookings(showId: string, organizerId?: string, callerRole?: string) {
  const show = await prisma.show.findUnique({
    where: { id: showId },
    include: {
      bookings: {
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
          seats: { include: { seat: true } },
        },
      },
    },
  });
  if (!show) throw new NotFoundError('Show not found');
  if (show.organizerId !== organizerId && callerRole !== 'ADMIN') {
    throw new ForbiddenError('Not your show');
  }
  return {
    showId: show.id,
    title: show.title,
    bookings: show.bookings.map((b) => ({
      id: b.id,
      reference: b.reference,
      customer: b.user,
      totalCents: b.totalCents,
      status: b.status,
      createdAt: b.createdAt,
      seats: b.seats.map((s) => s.seat.label),
    })),
  };
}

export async function getAdminSummary() {
  const [users, venues, shows, bookings] = await Promise.all([
    prisma.user.count(),
    prisma.venue.count(),
    prisma.show.count(),
    prisma.booking.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);
  const revenue = await prisma.booking.aggregate({
    where: { status: 'CONFIRMED' },
    _sum: { totalCents: true },
  });
  return {
    users,
    venues,
    shows,
    bookings,
    revenueCents: revenue._sum.totalCents ?? 0,
  };
}