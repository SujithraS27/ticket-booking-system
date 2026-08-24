import type { PrismaClient } from '@prisma/client';
import { SeatCategory } from '@prisma/client';

/**
 * Realistic present-day Indian ticket prices (in paise / Ø,), applied idempotently.
 *
 * Cinema uses multiplex-style ranges; concerts use event ranges. These are the
 * canonical values shared by the seed, the manual update script, and the
 * automatic startup sync (server.ts) so every deployment converges on the same
 * prices.
 *
 * Prices are keyed by unique [showId, category], so re-running is a safe no-op
 * upsert (never creates duplicate rows) and never touches shows, seats,
 * bookings, holds, waitlist, auth, or Socket.IO.
 */
export interface PriceTarget {
  title: string;
  premiumCents: number;
  standardCents: number;
}

export const REALISTIC_PRICES: PriceTarget[] = [
  { title: 'Dune: Part Two', premiumCents: 29900, standardCents: 19900 },
  { title: 'Oppenheimer IMAX', premiumCents: 39900, standardCents: 24900 },
  { title: 'Sunburn Unplugged', premiumCents: 149900, standardCents: 79900 },
  { title: 'The Jazz Collective Live', premiumCents: 99900, standardCents: 69900 },
  { title: 'Everything Everywhere: All At Once', premiumCents: 29900, standardCents: 19900 },
];

/**
 * Idempotently syncs the above prices for the existing shows.
 * Returns the number of pricing rows written/updated.
 */
export async function applyRealisticPrices(prisma: PrismaClient): Promise<number> {
  let touched = 0;
  for (const p of REALISTIC_PRICES) {
    const show = await prisma.show.findFirst({ where: { title: p.title } });
    if (!show) {
      console.log(`[prices] SKIP "${p.title}" — no matching show`);
      continue;
    }
    await prisma.pricing.upsert({
      where: { showId_category: { showId: show.id, category: SeatCategory.PREMIUM } },
      update: { priceCents: p.premiumCents },
      create: { showId: show.id, category: SeatCategory.PREMIUM, priceCents: p.premiumCents },
    });
    await prisma.pricing.upsert({
      where: { showId_category: { showId: show.id, category: SeatCategory.STANDARD } },
      update: { priceCents: p.standardCents },
      create: { showId: show.id, category: SeatCategory.STANDARD, priceCents: p.standardCents },
    });
    touched += 2;
    console.log(`[prices] UPDATED "${p.title}" → Premium ₹${p.premiumCents / 100}, Standard ₹${p.standardCents / 100}`);
  }
  return touched;
}