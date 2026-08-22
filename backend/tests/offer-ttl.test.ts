import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, resetDb, registerUser } from './helpers';
import { createVenueT, createShowT, fetchSeatMap, holdApi, book } from './factories';
import { prisma } from '../src/lib/prisma';
import { resolveExpiredOffers } from '../src/services/waitlist.service';

/**
 * TIME-LIMITED WAITLIST OFFERS
 * Offers expire server-side; expired offers are passed to the next person
 * in line automatically (scheduler) and can never be claimed afterwards.
 */
async function setupSinglePremium() {
  const admin = await registerUser('ADMIN');
  const org = await registerUser('ORG');
  const venue = await createVenueT(admin.token, { rows: 2, seatsPerRow: 1, premiumRows: 1 });
  const showId = await createShowT(org.token, { venueId: venue.id });
  const premiumSeat = (await fetchSeatMap(showId)).find((s) => s.category === 'PREMIUM')!;

  const buyer = await registerUser('CUSTOMER');
  await holdApi(showId, buyer.token, [premiumSeat.id]).expect(201);
  await book(showId, buyer.token, [premiumSeat.id]).expect(201);

  return { showId, premiumSeat, buyer };
}

function join(showId: string, token: string) {
  return request(app())
    .post(`/api/shows/${showId}/waitlist`)
    .set('Authorization', `Bearer ${token}`)
    .send({ category: 'PREMIUM' });
}

describe('Time-limited waitlist offers', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('creates offers with a future expiry inside the configured TTL window', async () => {
    const { showId, buyer } = await setupSinglePremium();
    const c1 = await registerUser('CUSTOMER');
    await join(showId, c1.token).expect(201);

    const mine = await request(app()).get('/api/bookings/my').set('Authorization', `Bearer ${buyer.token}`);
    const cancel = await request(app())
      .post(`/api/bookings/${mine.body.bookings[0].id}/cancel`)
      .set('Authorization', `Bearer ${buyer.token}`)
      .expect(200);

    const offer = cancel.body.offersCreated[0];
    const expiresAt = new Date(offer.expiresAt).getTime();
    expect(expiresAt).toBeGreaterThan(Date.now());
    expect(expiresAt - Date.now()).toBeLessThanOrEqual(10 * 60 * 1000 + 5000);
  });

  it('expired offers are passed to the next customer by the scheduler service', async () => {
    const { showId, premiumSeat, buyer } = await setupSinglePremium();
    const [c1, c2] = await Promise.all([registerUser('CUSTOMER'), registerUser('CUSTOMER')]);
    for (const c of [c1, c2]) await join(showId, c.token).expect(201);

    const mine = await request(app()).get('/api/bookings/my').set('Authorization', `Bearer ${buyer.token}`);
    await request(app())
      .post(`/api/bookings/${mine.body.bookings[0].id}/cancel`)
      .set('Authorization', `Bearer ${buyer.token}`)
      .expect(200);

    // Force c1's fresh offer to be expired.
    const c1Entry = await prisma.waitlistEntry.findFirst({ where: { showId, userId: c1.user.id }, include: { offers: true } });
    await prisma.waitlistOffer.update({
      where: { id: c1Entry!.offers[0].id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const handled = await resolveExpiredOffers();
    expect(handled).toBeGreaterThanOrEqual(1);

    // c1's entry is EXPIRED; c2 now holds an ACTIVE offer for the SAME seat.
    const entries = await prisma.waitlistEntry.findMany({ where: { showId }, include: { offers: true } });
    expect(entries.find((e) => e.userId === c1.user.id)!.status).toBe('EXPIRED');
    const c2Entry = entries.find((e) => e.userId === c2.user.id)!;
    expect(c2Entry.status).toBe('OFFERED');
    expect(c2Entry.offers.find((o) => o.status === 'ACTIVE')!.showSeatId).toBe(premiumSeat.id);

    // Seat stays exclusively tied to c2 meanwhile.
    const map = await fetchSeatMap(showId);
    expect(map.find((s) => s.id === premiumSeat.id)!.status).toBe('OFFERED');
  });
  it('an expired token cannot be accepted afterwards (410), even if reassigned', async () => {
    const { showId, premiumSeat, buyer } = await setupSinglePremium();
    const [c1, c2] = await Promise.all([registerUser('CUSTOMER'), registerUser('CUSTOMER')]);
    for (const c of [c1, c2]) await join(showId, c.token).expect(201);

    const mine = await request(app()).get('/api/bookings/my').set('Authorization', `Bearer ${buyer.token}`);
    await request(app())
      .post(`/api/bookings/${mine.body.bookings[0].id}/cancel`)
      .set('Authorization', `Bearer ${buyer.token}`)
      .expect(200);

    const c1Entry = await prisma.waitlistEntry.findFirst({ where: { showId, userId: c1.user.id }, include: { offers: true } });
    const staleToken = c1Entry!.offers[0].token;
    await prisma.waitlistOffer.update({
      where: { id: c1Entry!.offers[0].id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await resolveExpiredOffers();

    const late = await request(app())
      .post(`/api/offers/${staleToken}/accept`)
      .set('Authorization', `Bearer ${c1.token}`);
    expect(late.status).toBe(410);

    // The seat was never stolen: still OFFERED to c2.
    const seat = await prisma.showSeat.findUnique({ where: { id: premiumSeat.id } });
    expect(seat?.status).toBe('OFFERED');
  });

  it('when the queue empties, an expired offer releases the seat to AVAILABLE via the admin endpoint', async () => {
    const { showId, premiumSeat, buyer } = await setupSinglePremium();
    const c1 = await registerUser('CUSTOMER');
    await join(showId, c1.token).expect(201);

    const mine = await request(app()).get('/api/bookings/my').set('Authorization', `Bearer ${buyer.token}`);
    await request(app())
      .post(`/api/bookings/${mine.body.bookings[0].id}/cancel`)
      .set('Authorization', `Bearer ${buyer.token}`)
      .expect(200);

    const c1Entry = await prisma.waitlistEntry.findFirst({ where: { showId, userId: c1.user.id }, include: { offers: true } });
    await prisma.waitlistOffer.update({
      where: { id: c1Entry!.offers[0].id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const admin = await registerUser('ADMIN');
    const run = await request(app())
      .post('/api/admin/scheduler/run')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(run.status).toBe(200);
    expect(run.body.offersResolved).toBeGreaterThanOrEqual(1);

    const map = await fetchSeatMap(showId);
    expect(map.find((s) => s.id === premiumSeat.id)!.status).toBe('AVAILABLE');
    expect((await prisma.waitlistEntry.findUnique({ where: { id: c1Entry!.id } }))!.status).toBe('EXPIRED');
  });
});