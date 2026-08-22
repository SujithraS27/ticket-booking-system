import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, resetDb, registerUser } from './helpers';
import { createVenueT, createShowT, fetchSeatMap, holdApi, book } from './factories';
import { getSentEmails, clearSentEmails } from '../src/lib/email';
import { prisma } from '../src/lib/prisma';

/**
 * CANCELLATION -> WAITLIST AUTO-ASSIGNMENT -> TIME-LIMITED OFFER
 * The waitlist is a real FIFO queue per seat category; released seats are
 * handed to the next eligible customer with a time-limited link.
 */
async function setupSoldOutPremium() {
  const admin = await registerUser('ADMIN');
  const org = await registerUser('ORG');
  // 1 premium row of 3 seats + 1 standard row of 3 seats
  const venue = await createVenueT(admin.token, { rows: 2, seatsPerRow: 3, premiumRows: 1 });
  const showId = await createShowT(org.token, { venueId: venue.id, premiumPriceCents: 2500, standardPriceCents: 1200 });
  const seats = await fetchSeatMap(showId);
  const premium = seats.filter((s) => s.category === 'PREMIUM');
  const standard = seats.filter((s) => s.category === 'STANDARD');

  const buyer = await registerUser('CUSTOMER');
  await holdApi(showId, buyer.token, premium.map((p) => p.id)).expect(201);
  const bookRes = await book(showId, buyer.token, premium.map((p) => p.id));
  expect(bookRes.status).toBe(201);

  return { admin, org, showId, premium, standard, buyer };
}

function joinWaitlist(showId: string, token: string, category = 'PREMIUM') {
  return request(app())
    .post(`/api/shows/${showId}/waitlist`)
    .set('Authorization', `Bearer ${token}`)
    .send({ category });
}

describe('Cancellation & waitlist flow', () => {
  beforeEach(async () => {
    await resetDb();
    clearSentEmails();
  });

  it('rejects joining the waitlist while the category still has free seats', async () => {
    const { showId, standard } = await setupSoldOutPremium();
    const late = await registerUser('CUSTOMER');

    const res = await joinWaitlist(showId, late.token, 'STANDARD');
    expect(res.status).toBe(400);

    // PREMIUM is sold out, so joining it is allowed
    const ok = await joinWaitlist(showId, late.token);
    expect(ok.status).toBe(201);
    expect(ok.body.entry.status).toBe('WAITING');
    expect(standard).toHaveLength(3);
  });

  it('prevents duplicate active waitlist entries per category', async () => {
    const { showId } = await setupSoldOutPremium();
    const c = await registerUser('CUSTOMER');
    await joinWaitlist(showId, c.token).expect(201);
    const dup = await joinWaitlist(showId, c.token);
    expect(dup.status).toBe(409);
  });

  it('on cancellation, seats are offered FIFO to the next customers with time-limited links', async () => {
    const { showId, buyer, premium } = await setupSoldOutPremium();
    const [c1, c2, c3] = await Promise.all([
      registerUser('CUSTOMER'),
      registerUser('CUSTOMER'),
      registerUser('CUSTOMER'),
    ]);
    for (const c of [c1, c2, c3]) await joinWaitlist(showId, c.token).expect(201);

    const mine = await request(app()).get('/api/bookings/my').set('Authorization', `Bearer ${buyer.token}`);
    const bookingId = mine.body.bookings[0].id;
    const cancel = await request(app())
      .post(`/api/bookings/${bookingId}/cancel`)
      .set('Authorization', `Bearer ${buyer.token}`);
    expect(cancel.status).toBe(200);
    expect(cancel.body.offersCreated).toHaveLength(3);

    // FIFO: c1 -> premium[0], c2 -> premium[1], c3 -> premium[2]
    const tokens = cancel.body.offersCreated as Array<{ token: string; seatLabel: string; customerId: string }>;
    expect(tokens[0].customerId).toBe(c1.user.id);
    expect(tokens[1].customerId).toBe(c2.user.id);
    expect(tokens[2].customerId).toBe(c3.user.id);

    for (const t of tokens) {
      const info = await request(app()).get(`/api/offers/${t.token}`);
      expect(info.status).toBe(200);
      expect(info.body.offer.status).toBe('ACTIVE');
      expect(info.body.offer.expiresAt).toBeTruthy();
      expect(info.body.offer.seat.priceCents).toBe(2500);
    }

    // Seat map shows the seats as OFFERED
    const map = await fetchSeatMap(showId);
    for (const p of premium) {
      expect(map.find((s) => s.id === p.id)!.status).toBe('OFFERED');
    }

    // Offer emails were queued for each waitlisted customer
    await new Promise((r) => setTimeout(r, 150));
    const mails = getSentEmails();
    for (const c of [c1, c2, c3]) {
      expect(mails.some((m) => m.subject.includes('seat just opened') && m.to === c.user.email)).toBe(true);
    }

    const dbBooking = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(dbBooking?.status).toBe('CANCELLED');
  });

  it('only the offered customer can accept; accepting creates a real booking', async () => {
    const { showId, buyer, premium } = await setupSoldOutPremium();
    const [c1, c2] = await Promise.all([registerUser('CUSTOMER'), registerUser('CUSTOMER')]);
    for (const c of [c1, c2]) await joinWaitlist(showId, c.token).expect(201);

    const mine = await request(app()).get('/api/bookings/my').set('Authorization', `Bearer ${buyer.token}`);
    await request(app())
      .post(`/api/bookings/${mine.body.bookings[0].id}/cancel`)
      .set('Authorization', `Bearer ${buyer.token}`)
      .expect(200);

    const entries = await prisma.waitlistEntry.findMany({ where: { showId, category: 'PREMIUM' }, include: { offers: true } });
    const c1Entry = entries.find((e) => e.userId === c1.user.id)!;
    const c1Token = c1Entry.offers[0].token;
    // The seat tied to c1's offer (cancel iterates seats in arbitrary order)
    const c1SeatId = c1Entry.offers[0].showSeatId;

    // c2 cannot accept c1's offer
    const stolen = await request(app())
      .post(`/api/offers/${c1Token}/accept`)
      .set('Authorization', `Bearer ${c2.token}`);
    expect(stolen.status).toBe(409);

    // c1 accepts their own offer
    const ok = await request(app())
      .post(`/api/offers/${c1Token}/accept`)
      .set('Authorization', `Bearer ${c1.token}`);
    expect(ok.status).toBe(201);
    expect(ok.body.reference).toMatch(/^TBS-/);
    expect(ok.body.seats[0].category).toBe('PREMIUM');

    // The offered seat is now BOOKED by c1; c1's waitlist entry COMPLETED
    const seat = await prisma.showSeat.findUnique({ where: { id: c1SeatId } });
    expect(seat?.status).toBe('BOOKED');
    const entry = await prisma.waitlistEntry.findUnique({ where: { id: c1Entry.id } });
    expect(entry?.status).toBe('COMPLETED');

    // Double-accept is rejected
    const again = await request(app())
      .post(`/api/offers/${c1Token}/accept`)
      .set('Authorization', `Bearer ${c1.token}`);
    expect(again.status).toBe(409);
  });

  it('declining an offer hands the SAME seat to the NEXT person in line', async () => {
    // Exactly ONE premium seat so every expiry/decline must cascade down the queue.
    const admin = await registerUser('ADMIN');
    const org = await registerUser('ORG');
    const venue = await createVenueT(admin.token, { rows: 2, seatsPerRow: 1, premiumRows: 1 });
    const showId = await createShowT(org.token, { venueId: venue.id });
    const seats = await fetchSeatMap(showId);
    const premiumSeat = seats.find((s) => s.category === 'PREMIUM')!;

    const buyer = await registerUser('CUSTOMER');
    await holdApi(showId, buyer.token, [premiumSeat.id]).expect(201);
    await book(showId, buyer.token, [premiumSeat.id]).expect(201);

    const [c1, c2, c3] = await Promise.all([
      registerUser('CUSTOMER'),
      registerUser('CUSTOMER'),
      registerUser('CUSTOMER'),
    ]);
    for (const c of [c1, c2, c3]) await joinWaitlist(showId, c.token).expect(201);

    const mine = await request(app()).get('/api/bookings/my').set('Authorization', `Bearer ${buyer.token}`);
    await request(app())
      .post(`/api/bookings/${mine.body.bookings[0].id}/cancel`)
      .set('Authorization', `Bearer ${buyer.token}`)
      .expect(200);

    // The single seat must have been offered to c1 (head of the FIFO queue).
    let entries = await prisma.waitlistEntry.findMany({ where: { showId }, include: { offers: true } });
    const c1Entry = entries.find((e) => e.userId === c1.user.id)!;
    expect(c1Entry.status).toBe('OFFERED');
    expect(c1Entry.offers[0].showSeatId).toBe(premiumSeat.id);

    // c1 declines -> seat moves to c2
    await request(app())
      .post(`/api/offers/${c1Entry.offers[0].token}/decline`)
      .set('Authorization', `Bearer ${c1.token}`)
      .expect(200);

    entries = await prisma.waitlistEntry.findMany({ where: { showId }, include: { offers: true } });
    expect(entries.find((e) => e.userId === c1.user.id)!.status).toBe('EXPIRED');
    const c2Entry = entries.find((e) => e.userId === c2.user.id)!;
    expect(c2Entry.status).toBe('OFFERED');
    expect(c2Entry.offers.find((o) => o.status === 'ACTIVE')!.showSeatId).toBe(premiumSeat.id);
    expect(entries.find((e) => e.userId === c3.user.id)!.status).toBe('WAITING');

    // Seat map reflects the OFFERED state during the whole flow
    const midMap = await fetchSeatMap(showId);
    expect(midMap.find((s) => s.id === premiumSeat.id)!.status).toBe('OFFERED');

    // c2 accepts and gets the booking for that exact seat
    const accepted = await request(app())
      .post(`/api/offers/${c2Entry.offers.find((o) => o.status === 'ACTIVE')!.token}/accept`)
      .set('Authorization', `Bearer ${c2.token}`);
    expect(accepted.status).toBe(201);

    const finalSeat = await prisma.showSeat.findUnique({ where: { id: premiumSeat.id } });
    expect(finalSeat?.status).toBe('BOOKED');
    expect((await fetchSeatMap(showId)).find((s) => s.id === premiumSeat.id)!.status).toBe('BOOKED');
  });

  it('cancelling with an empty waitlist simply returns seats to AVAILABLE', async () => {
    const { showId, buyer, premium } = await setupSoldOutPremium();
    const mine = await request(app()).get('/api/bookings/my').set('Authorization', `Bearer ${buyer.token}`);
    await request(app())
      .post(`/api/bookings/${mine.body.bookings[0].id}/cancel`)
      .set('Authorization', `Bearer ${buyer.token}`)
      .expect(200);

    const map = await fetchSeatMap(showId);
    expect(premium.every((p) => map.find((s) => s.id === p.id)!.status === 'AVAILABLE')).toBe(true);
  });

  it('a booking cannot be cancelled twice', async () => {
    const { showId, buyer } = await setupSoldOutPremium();
    const mine = await request(app()).get('/api/bookings/my').set('Authorization', `Bearer ${buyer.token}`);
    const bookingId = mine.body.bookings[0].id;
    await request(app())
      .post(`/api/bookings/${bookingId}/cancel`)
      .set('Authorization', `Bearer ${buyer.token}`)
      .expect(200);
    const second = await request(app())
      .post(`/api/bookings/${bookingId}/cancel`)
      .set('Authorization', `Bearer ${buyer.token}`);
    expect(second.status).toBe(409);
  });
});