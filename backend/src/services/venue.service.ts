import { SeatCategory } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError, NotFoundError } from '../lib/errors';

/**
 * VENUE MANAGEMENT (admin only)
 * A venue defines a physical seat layout. On creation every seat row is
 * generated (rows 1..premiumRows become PREMIUM, the rest STANDARD) so a
 * show at this venue automatically inherits the full per-seat map.
 */

export interface CreateVenueInput {
  name: string;
  city: string;
  rows: number;
  seatsPerRow: number;
  premiumRows?: number;
}

export async function listVenues() {
  return prisma.venue.findMany({
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { seats: true } } },
  });
}

export async function getVenue(id: string) {
  const venue = await prisma.venue.findUnique({
    where: { id },
    include: {
      seats: { orderBy: [{ row: 'asc' }, { col: 'asc' }] },
      _count: { select: { shows: true } },
    },
  });
  if (!venue) throw new NotFoundError('Venue not found');
  return venue;
}

function letterFor(col: number): string {
  return String.fromCharCode(64 + (col % 26 === 0 ? 26 : col % 26));
}

export async function createVenue(input: CreateVenueInput) {
  const { name, city, rows, seatsPerRow } = input;
  const premiumRows = input.premiumRows ?? 0;
  if (rows < 1 || rows > 60) throw new AppError(400, 'rows must be between 1 and 60');
  if (seatsPerRow < 1 || seatsPerRow > 40) throw new AppError(400, 'seatsPerRow must be between 1 and 40');
  if (premiumRows < 0 || premiumRows > rows) throw new AppError(400, 'premiumRows must be between 0 and rows');

  const venue = await prisma.$transaction(async (tx) => {
    const created = await tx.venue.create({
      data: { name, city, rows, seatsPerRow, premiumRows },
    });
    const seats = [];
    for (let r = 1; r <= rows; r++) {
      for (let c = 1; c <= seatsPerRow; c++) {
        seats.push({
          venueId: created.id,
          row: r,
          col: c,
          label: `${letterFor(r)}${c}`,
          category: r <= premiumRows ? SeatCategory.PREMIUM : SeatCategory.STANDARD,
        });
      }
    }
    await tx.seat.createMany({ data: seats });
    return created;
  });

  return venue;
}

export async function deleteVenue(id: string) {
  const venue = await prisma.venue.findUnique({ where: { id }, include: { _count: { select: { shows: true } } } });
  if (!venue) throw new NotFoundError('Venue not found');
  if (venue._count.shows > 0) {
    throw new AppError(409, 'Cannot delete a venue that has shows', 'VENUE_IN_USE');
  }
  await prisma.venue.delete({ where: { id } });
  return { id, deleted: true };
}