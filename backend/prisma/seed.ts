/**
 * Realistic seed data for local development.
 *   - Roles: admin, organisers, customers
 *   - 3 venues with real layouts (premium + standard rows)
 *   - 5 shows (movies & concerts) with per-category pricing
 *   - 1 sample confirmed booking so dashboards/seat-maps look alive
 *
 * Idempotent: skips work when the database already contains data.
 */
import { PrismaClient, Role, ShowType, SeatCategory } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const PASSWORD = 'password123';

function dayAfter(days: number, hour = 19): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 30, 0, 0);
  return d;
}

async function main() {
  const existingUsers = await prisma.user.count();
  if (existingUsers > 0) {
    console.log('Seeding skipped — database already contains data.');
    return;
  }

  const password = await bcrypt.hash(PASSWORD, 10);

  const admin = await prisma.user.create({ data: { email: 'admin@tbs.dev', name: 'Ada Admin', password, role: Role.ADMIN } });
  const org1 = await prisma.user.create({ data: { email: 'organiser@tbs.dev', name: 'CineWorld Events', password, role: Role.ORG } });
  const org2 = await prisma.user.create({ data: { email: 'promoter@tbs.dev', name: 'Loud Nights Promotions', password, role: Role.ORG } });
  const carlos = await prisma.user.create({ data: { email: 'carlos@example.com', name: 'Carlos Rivera', password, role: Role.CUSTOMER } });
  await prisma.user.create({ data: { email: 'mia@example.com', name: 'Mia Chen', password, role: Role.CUSTOMER } });

  const grandRex = await prisma.venue.create({ data: { name: 'Grand Rex Hall', city: 'Mumbai', rows: 8, seatsPerRow: 12, premiumRows: 3 } });
  const novaPlex = await prisma.venue.create({ data: { name: 'Nova Plex Cinema', city: 'Bengaluru', rows: 10, seatsPerRow: 14, premiumRows: 4 } });
  const skyline = await prisma.venue.create({ data: { name: 'Skyline Amphitheatre', city: 'Chennai', rows: 6, seatsPerRow: 10, premiumRows: 2 } });
// Generate the physical seat layout for each venue.
  for (const venue of [grandRex, novaPlex, skyline]) {
    const seats: Array<{ venueId: string; row: number; col: number; label: string; category: SeatCategory }> = [];
    for (let r = 1; r <= venue.rows; r++) {
      for (let c = 1; c <= venue.seatsPerRow; c++) {
        seats.push({
          venueId: venue.id,
          row: r,
          col: c,
          label: `${String.fromCharCode(64 + r)}${c}`,
          category: r <= venue.premiumRows ? SeatCategory.PREMIUM : SeatCategory.STANDARD,
        });
      }
    }
    await prisma.seat.createMany({ data: seats });
  }

  async function provisionShow(opts: {
    organizerId: string;
    venueId: string;
    title: string;
    type: ShowType;
    startsAt: Date;
    premiumCents: number;
    standardCents: number;
  }) {
    const show = await prisma.show.create({
      data: {
        title: opts.title,
        type: opts.type,
        description: `${opts.title} — an unmissable event.`,
        venueId: opts.venueId,
        organizerId: opts.organizerId,
        startsAt: opts.startsAt,
      },
    });
    await prisma.pricing.createMany({
      data: [
        { showId: show.id, category: SeatCategory.PREMIUM, priceCents: opts.premiumCents },
        { showId: show.id, category: SeatCategory.STANDARD, priceCents: opts.standardCents },
      ],
    });
    const venueSeats = await prisma.seat.findMany({ where: { venueId: opts.venueId } });
    await prisma.showSeat.createMany({
      data: venueSeats.map((s) => ({ showId: show.id, seatId: s.id, status: 'AVAILABLE' })),
    });
    return show;
  }

  const m1 = await provisionShow({ organizerId: org1.id, venueId: grandRex.id, title: 'Dune: Part Two', type: ShowType.MOVIE, startsAt: dayAfter(3, 19), premiumCents: 2500, standardCents: 1200 });
  await provisionShow({ organizerId: org1.id, venueId: novaPlex.id, title: 'Oppenheimer IMAX', type: ShowType.MOVIE, startsAt: dayAfter(5, 18), premiumCents: 3000, standardCents: 1500 });
  await provisionShow({ organizerId: org2.id, venueId: skyline.id, title: 'Sunburn Unplugged', type: ShowType.CONCERT, startsAt: dayAfter(7, 20), premiumCents: 4500, standardCents: 2200 });
  await provisionShow({ organizerId: org2.id, venueId: grandRex.id, title: 'The Jazz Collective Live', type: ShowType.CONCERT, startsAt: dayAfter(12, 21), premiumCents: 3500, standardCents: 1800 });
  await provisionShow({ organizerId: org1.id, venueId: novaPlex.id, title: 'Everything Everywhere: All At Once', type: ShowType.MOVIE, startsAt: dayAfter(15, 17), premiumCents: 2000, standardCents: 1000 });
// One sample confirmed booking so the seat map + revenue dashboards look realistic.
  const sampleSeats = await prisma.showSeat.findMany({
    where: { showId: m1.id },
    take: 4,
    orderBy: { seat: { col: 'asc' } },
    include: { seat: true },
  });
  const priceMap = new Map(
    (await prisma.pricing.findMany({ where: { showId: m1.id } })).map((p) => [p.category, p.priceCents]),
  );
  const total = sampleSeats.reduce((sum, st) => sum + (priceMap.get(st.seat.category) ?? 0), 0);
  const booking = await prisma.booking.create({
    data: {
      reference: `TBS-SEED${Math.floor(Math.random() * 90000 + 10000)}`,
      showId: m1.id,
      userId: carlos.id,
      totalCents: total,
      qrDataUrl: '',
      status: 'CONFIRMED',
    },
  });
  await prisma.showSeat.updateMany({
    where: { id: { in: sampleSeats.map((s) => s.id) } },
    data: { status: 'BOOKED', heldById: carlos.id, bookingId: booking.id, holdExpiresAt: null },
  });
  await prisma.ticket.createMany({
    data: sampleSeats.map((st) => ({
      bookingId: booking.id,
      showId: m1.id,
      seatLabel: st.seat.label,
      seatId: st.seat.id,
      category: st.seat.category,
      qrDataUrl: '',
    })),
  });

  console.log(`Seeded ${await prisma.user.count()} users, ${await prisma.venue.count()} venues, ${await prisma.show.count()} shows, 1 sample booking.`);
  console.log(`All seeded accounts use password "${PASSWORD}" (admin@tbs.dev, organiser@tbs.dev, promoter@tbs.dev, carlos@example.com, mia@example.com).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());