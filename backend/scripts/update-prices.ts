/**
 * Manual (or CI) one-off: apply realistic 2026 ticket pricing to an
 * ALREADY-SEEDED database. Idempotent — safe to run any number of times.
 *
 * The same logic also runs automatically on every server start via
 * src/server.ts bootstrap().
 *
 * Use:  npx tsx scripts/update-prices.ts
 * (DATABASE_URL is read from backend/.env or the environment)
 */
import { PrismaClient } from '@prisma/client';
import { applyRealisticPrices } from '../src/lib/updatePrices';

const prisma = new PrismaClient();

async function main() {
  const touched = await applyRealisticPrices(prisma);
  console.log(`[prices] sync complete (${touched} rows touched)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());