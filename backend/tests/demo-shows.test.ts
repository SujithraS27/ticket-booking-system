import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { syncDemoShowData, refreshLegacyShowDates, KEEP_FRESH_TITLES, DEMO_MOVIE_SHOWS, DEMO_VENUES } from '../src/lib/demoShows';
import { resetDb } from './helpers';

/**
 * The demo-show sync must be fully idempotent: running it repeatedly never
 * duplicates venues, shows, seats, or pricing — it only refreshes dates.
 */
describe('demo show data sync', () => {
  // Start every test from a clean, fully-synced database.
  beforeEach(async () => {
    await resetDb();
    await syncDemoShowData(prisma);
  });

  it('is idempotent across repeated runs', async () => {
    await syncDemoShowData(prisma);
    const snapshot = {
      venues: await prisma.venue.count(),
      shows: await prisma.show.findMany({ select: { id: true, title: true, description: true } }),
      pricing: await prisma.pricing.count(),
    };

    await syncDemoShowData(prisma);

    const after = {
      venues: await prisma.venue.count(),
      shows: await prisma.show.findMany({ select: { id: true, title: true, description: true } }),
      pricing: await prisma.pricing.count(),
    };

    expect(after.venues).toBe(snapshot.venues);
    expect(after.shows.length).toBe(snapshot.shows.length);
    expect(after.pricing).toBe(snapshot.pricing);
  });

  it('creates exactly one show per configured slot with correct pricing', async () => {
    const totalSlots = DEMO_MOVIE_SHOWS.reduce((sum, m) => sum + m.slots.length, 0);

    for (const cfg of DEMO_MOVIE_SHOWS) {
      const shows = await prisma.show.findMany({
        where: { title: cfg.title },
        include: { pricing: true },
      });
      expect(shows.length).toBe(cfg.slots.length);
      for (const show of shows) {
        expect(show.description).toContain('[DEMO] slot=');
        const premium = show.pricing.find((p) => p.category === 'PREMIUM');
        const standard = show.pricing.find((p) => p.category === 'STANDARD');
        expect(premium?.priceCents).toBe(cfg.premiumCents);
        expect(standard?.priceCents).toBe(cfg.standardCents);
      }
    }
    // sanity: total managed slots present in DB
    const managed = await prisma.show.count({ where: { description: { contains: '[DEMO] slot=' } } });
    expect(managed).toBe(totalSlots);
  });

    it('keeps all managed shows current/upcoming and seats provisioned', async () => {
    const now = Date.now();
    const demoVenue = await prisma.venue.findFirst({
      where: { name: DEMO_VENUES[0].name },
      include: { seats: true },
    });
    expect(demoVenue).not.toBeNull();

    const demoShows = await prisma.show.findMany({
      where: { description: { contains: '[DEMO]' } },
      include: { showSeats: true },
    });
    expect(demoShows.length).toBeGreaterThan(0);
    for (const show of demoShows) {
      expect(show.startsAt.getTime()).toBeGreaterThan(now);
      // every show has a full seat map provisioned
      expect(show.showSeats.length).toBe(demoVenue!.seats.length);
    }
  });

  it('past-released movie with revival shows stays bookable — rule #5', async () => {
    const cfg = DEMO_MOVIE_SHOWS.find((m) => m.title === 'Dune: Part Two');
    expect(cfg).toBeDefined();

    const shows = await prisma.show.findMany({
      where: { title: 'Dune: Part Two' },
      include: { pricing: true, showSeats: true },
    });
    expect(shows.length).toBe(cfg!.slots.length);
    for (const show of shows) {
      // Revival shows must be current/upcoming even though the movie is a 2024 release
      expect(show.startsAt.getTime()).toBeGreaterThan(Date.now());
      expect(show.showSeats.length).toBe(96);
      const premium = show.pricing.find((p) => p.category === 'PREMIUM');
      const standard = show.pricing.find((p) => p.category === 'STANDARD');
      expect(premium?.priceCents).toBe(cfg!.premiumCents);
      expect(standard?.priceCents).toBe(cfg!.standardCents);
    }
  });

  it('refreshLegacyShowDates shifts past-dated legacy shows forward', async () => {
    const title = KEEP_FRESH_TITLES[0]; // 'Dune: Part Two'
    const venue = await prisma.venue.findFirst({ where: { name: DEMO_VENUES[0].name } });
    const organizer = await prisma.user.findUnique({ where: { email: 'demo-bookings@tbs.dev' } });
    expect(venue).not.toBeNull();
    expect(organizer).not.toBeNull();

    // Insert one legacy show that's already in the past
    const pastShow = await prisma.$transaction(async (tx) => {
      const show = await tx.show.create({
        data: {
          title,
          type: 'MOVIE',
          description: `${title} — legacy seed show`,
          venueId: venue!.id,
          organizerId: organizer!.id,
          startsAt: new Date(Date.now() - 86_400_000 * 3), // 3 days ago
        },
      });
      const venueSeats = await tx.seat.findMany({ where: { venueId: venue!.id } });
      await tx.showSeat.createMany({
        data: venueSeats.map((s) => ({ showId: show.id, seatId: s.id, status: 'AVAILABLE' })),
      });
      await tx.pricing.createMany({
        data: [
          { showId: show.id, category: 'PREMIUM', priceCents: 29900 },
          { showId: show.id, category: 'STANDARD', priceCents: 19900 },
        ],
      });
      return show;
    });

    const refreshed = await refreshLegacyShowDates(prisma);
    expect(refreshed).toBe(1);

    const updated = await prisma.show.findUnique({ where: { id: pastShow.id } });
    expect(updated!.startsAt.getTime()).toBeGreaterThan(Date.now() + 60 * 60 * 1000);
  });
});