import { PrismaClient, SeatCategory } from '@prisma/client';
import { hashPassword } from './password';

/**
 * Curated DEMO theatre listings for TICKETBOOK.
 *
 * Portfolio/demo listings (clearly-labelled demo cinema), NOT live
 * BookMyShow/PVR/Cinepolis availability. The sync is fully idempotent:
 *  - venues are created once and reused
 *  - shows are matched by title + slot marker (`[DEMO] slot=N` in description)
 *    so repeated runs update instead of duplicating
 *  - pricing is upserted on the unique [showId, category] constraint
 *  - existing bookings/seats/holds/waitlist are never touched
 */

export interface DemoVenueConfig {
  name: string;
  city: string;
  rows: number;
  seatsPerRow: number;
  premiumRows: number;
}

export interface DemoSlot {
  /** Day offset from today (0 = today). Auto-bumped +1 day if the time already passed. */
  dayOffset: number;
  hour: number;
  minute: number;
}

export interface DemoMovieShowConfig {
  title: string;
  venueName: string;
  venueCity: string;
  premiumCents: number;
  standardCents: number;
  slots: DemoSlot[];
}

export const DEMO_VENUES: DemoVenueConfig[] = [
  { name: 'TICKETBOOK Demo Cinema', city: 'Chennai', rows: 8, seatsPerRow: 12, premiumRows: 3 },
  // Mirrored from the seed (Grand Rex Hall) so the demo sync is self-contained
  // and does not depend on seed data being present.
  { name: 'Grand Rex Hall', city: 'Mumbai', rows: 8, seatsPerRow: 12, premiumRows: 3 },
];

/** Movies that get curated demo listings (NOW SHOWING or PRE-BOOKING). */
export const DEMO_MOVIE_SHOWS: DemoMovieShowConfig[] = [
  {
    // Released 31 Jul 2026 → NOW SHOWING
    title: 'Spider-Man: Brand New Day',
    venueName: 'TICKETBOOK Demo Cinema',
    venueCity: 'Chennai',
    premiumCents: 34900,
    standardCents: 21900,
    slots: [
      { dayOffset: 0, hour: 10, minute: 0 },
      { dayOffset: 1, hour: 13, minute: 15 },
      { dayOffset: 1, hour: 19, minute: 45 },
      { dayOffset: 2, hour: 22, minute: 30 },
    ],
  },
  {
    // Releases 26 Aug 2026 → PRE-BOOKING OPEN
    title: 'Toxic',
    venueName: 'TICKETBOOK Demo Cinema',
    venueCity: 'Chennai',
    premiumCents: 32900,
    standardCents: 19900,
    slots: [
      { dayOffset: 3, hour: 18, minute: 30 },
      { dayOffset: 4, hour: 21, minute: 30 },
    ],
  },
  {
    // Releases 28 Aug 2026 → PRE-BOOKING OPEN
    title: 'Khosla Ka Ghosla 2',
    venueName: 'Grand Rex Hall',
    venueCity: 'Mumbai',
    premiumCents: 24900,
    standardCents: 16900,
    slots: [
      { dayOffset: 5, hour: 17, minute: 0 },
      { dayOffset: 6, hour: 20, minute: 15 },
    ],
  },
  {
    // Released Mar 1, 2024 — past theatrical run, now in REVIVAL SCREENING.
    // Demonstrates rule #5: a past-released movie becomes bookable again
    // when an explicitly configured revival show exists.
    title: 'Dune: Part Two',
    venueName: 'TICKETBOOK Demo Cinema',
    venueCity: 'Chennai',
    premiumCents: 29900,
    standardCents: 19900,
    slots: [
      { dayOffset: 0, hour: 15, minute: 30 },
      { dayOffset: 1, hour: 18, minute: 0 },
    ],
  },
];

/** Legacy seed shows whose dates are kept current/upcoming by the sync. */
export const KEEP_FRESH_TITLES = [
  'Dune: Part Two',
  'Oppenheimer IMAX',
  'Sunburn Unplugged',
  'The Jazz Collective Live',
  'Everything Everywhere: All At Once',
];

const SLOT_MARKER = '[DEMO] slot=';

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Resolves a slot's absolute date; bumps to tomorrow if the time already passed. */
export function slotDate(slot: DemoSlot): Date {
  let target = new Date(startOfToday().getTime() + slot.dayOffset * 86_400_000);
  target.setHours(slot.hour, slot.minute, 0, 0);
  if (target.getTime() < Date.now() + 60 * 60 * 1000) {
    target = new Date(target.getTime() + 86_400_000);
  }
  return target;
}

async function ensureVenue(prisma: PrismaClient, cfg: DemoVenueConfig) {
  const existing = await prisma.venue.findFirst({ where: { name: cfg.name, city: cfg.city } });
  if (existing) return existing;

  const venue = await prisma.venue.create({
    data: { name: cfg.name, city: cfg.city, rows: cfg.rows, seatsPerRow: cfg.seatsPerRow, premiumRows: cfg.premiumRows },
  });
  const seats: Array<{ venueId: string; row: number; col: number; label: string; category: SeatCategory }> = [];
  for (let r = 1; r <= cfg.rows; r++) {
    for (let c = 1; c <= cfg.seatsPerRow; c++) {
      seats.push({
        venueId: venue.id,
        row: r,
        col: c,
        label: `${String.fromCharCode(64 + r)}${c}`,
        category: r <= cfg.premiumRows ? SeatCategory.PREMIUM : SeatCategory.STANDARD,
      });
    }
  }
  await prisma.seat.createMany({ data: seats });
  console.log(`[demo] created venue "${cfg.name}" (${cfg.city}) with ${seats.length} seats`);
  return venue;
}

async function ensurePricing(prisma: PrismaClient, showId: string, cfg: DemoMovieShowConfig) {
  await prisma.pricing.upsert({
    where: { showId_category: { showId, category: SeatCategory.PREMIUM } },
    update: { priceCents: cfg.premiumCents },
    create: { showId, category: SeatCategory.PREMIUM, priceCents: cfg.premiumCents },
  });
  await prisma.pricing.upsert({
    where: { showId_category: { showId, category: SeatCategory.STANDARD } },
    update: { priceCents: cfg.standardCents },
    create: { showId, category: SeatCategory.STANDARD, priceCents: cfg.standardCents },
  });
}

let cachedOrganizerId: string | null = null;

async function ensureOrganizer(prisma: PrismaClient): Promise<string> {
  if (cachedOrganizerId) return cachedOrganizerId;
  const email = 'demo-bookings@tbs.dev';
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    cachedOrganizerId = existing.id;
    return existing.id;
  }
  const user = await prisma.user.create({
    data: {
      email,
      name: 'TICKETBOOK Demo Listings',
      password: await hashPassword(`demo-${Math.random().toString(36).slice(2)}`),
      role: 'ORG',
    },
  });
  cachedOrganizerId = user.id;
  console.log('[demo] created organiser account demo-bookings@tbs.dev');
  return user.id;
}

/**
 * Idempotently ensures every configured demo movie has its curated shows.
 * Shows are matched by title + slot marker, so repeated runs update dates
 * instead of creating duplicates. Returns shows created or updated.
 */
export async function syncDemoMovieShows(prisma: PrismaClient): Promise<number> {
  let touched = 0;

  for (const cfg of DEMO_MOVIE_SHOWS) {
    const venue = await prisma.venue.findFirst({
      where: { name: cfg.venueName, city: cfg.venueCity },
      include: { seats: true },
    });
    if (!venue || venue.seats.length === 0) {
      console.warn(`[demo] skip "${cfg.title}" — venue "${cfg.venueName}" unavailable`);
      continue;
    }
    const organizerId = await ensureOrganizer(prisma);
    const titleShows = await prisma.show.findMany({ where: { title: cfg.title } });

    for (let i = 0; i < cfg.slots.length; i++) {
      const marker = `${SLOT_MARKER}${i}`;
      const startsAt = slotDate(cfg.slots[i]);
      const existing = titleShows.find((s) => s.description?.includes(marker));

      if (existing) {
        if (existing.startsAt.getTime() !== startsAt.getTime()) {
          await prisma.show.update({ where: { id: existing.id }, data: { startsAt } });
          touched++;
        }
      } else {
        const created = await prisma.show.create({
          data: {
            title: cfg.title,
            type: 'MOVIE',
            description: `[DEMO] ${marker} — curated demo listing.`,
            venueId: venue.id,
            organizerId,
            startsAt,
          },
        });
        // Provision the full seat map for the new show (like seed.ts does).
        await prisma.showSeat.createMany({
          data: venue.seats.map((seat) => ({
            showId: created.id,
            seatId: seat.id,
            status: 'AVAILABLE',
          })),
        });
        touched++;
        console.log(`[demo] created show "${cfg.title}" slot ${i} (${venue.seats.length} seats)`);
      }
      await ensurePricingForTitleSlot(prisma, titleShows, cfg.title, i, cfg);
    }
  }
  return touched;
}

async function ensurePricingForTitleSlot(
  prisma: PrismaClient,
  titleShows: Array<{ id: string; description: string | null }>,
  title: string,
  slotIndex: number,
  cfg: DemoMovieShowConfig,
) {
  // Prefer the in-memory list; fall back to a query for freshly created rows.
  let show: { id: string; description: string | null } | null = titleShows.find(
    (s) => s.description?.includes(`${SLOT_MARKER}${slotIndex}`),
  ) ?? null;
  if (!show) {
    show = await prisma.show.findFirst({
      where: { title, description: { contains: `${SLOT_MARKER}${slotIndex}` } },
      select: { id: true, description: true },
    });
  }
  if (!show) return;
  await ensurePricing(prisma, show.id, cfg);
}

/**
 * Keeps legacy seed shows scheduled within the coming days so their booking
 * lifecycle stays demonstrable. Past-dated managed shows are shifted forward
 * a day at a time, preserving time-of-day. Returns count refreshed.
 */
export async function refreshLegacyShowDates(prisma: PrismaClient): Promise<number> {
  let refreshed = 0;
  for (const title of KEEP_FRESH_TITLES) {
    const shows = await prisma.show.findMany({ where: { title } });
    for (const show of shows) {
      if (show.startsAt.getTime() > Date.now()) continue;
      const shifted = new Date(show.startsAt.getTime() + 86_400_000);
      while (shifted.getTime() < Date.now() + 60 * 60 * 1000) {
        shifted.setTime(shifted.getTime() + 86_400_000);
      }
      await prisma.show.update({ where: { id: show.id }, data: { startsAt: shifted } });
      refreshed++;
    }
  }
  return refreshed;
}

/** Full demo-data sync: venues + curated movie shows + legacy date refresh. */
export async function syncDemoShowData(prisma: PrismaClient): Promise<void> {
  cachedOrganizerId = null; // invalidate in case the DB was reset between runs
  for (const v of DEMO_VENUES) await ensureVenue(prisma, v);
  const touched = await syncDemoMovieShows(prisma);
  const refreshed = await refreshLegacyShowDates(prisma);
  console.log(`[demo] show sync complete (${touched} shows created/updated, ${refreshed} legacy dates refreshed)`);
}
