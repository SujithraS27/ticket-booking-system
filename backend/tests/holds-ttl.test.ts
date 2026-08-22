import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, resetDb, registerUser } from './helpers';
import { createVenueT, createShowT, fetchSeatMap, holdApi } from './factories';
import { holdSeats, releaseExpiredHolds } from '../src/services/hold.service';
import { prisma } from '../src/lib/prisma';

describe('Seat holds, release and TTL enforcement', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('holds seats, marks them HELD for the holder, returns expiry', async () => {
    const admin = await registerUser('ADMIN');
    const org = await registerUser('ORG');
    const customer = await registerUser('CUSTOMER');
    const venue = await createVenueT(admin.token, { rows: 2, seatsPerRow: 3, premiumRows: 1 });
    const showId = await createShowT(org.token, { venueId: venue.id });
    const seats = await fetchSeatMap(showId);
    const [a, b] = seats;

    const res = await holdApi(showId, customer.token, [a.id, b.id]);
    expect(res.status).toBe(201);
    expect(res.body.expiresAt).toBeTruthy();
    expect(res.body.seats).toHaveLength(2);
    expect(res.body.seats.every((s: { status: string }) => s.status === 'HELD')).toBe(true);

    const after = await fetchSeatMap(showId, customer.token);
    expect(after.find((s) => s.id === a.id)!.status).toBe('HELD');
    expect(after.find((s) => s.id === a.id)!.heldByMe).toBe(true);
  });

  it('blocks a second customer from holding the same seat', async () => {
    const admin = await registerUser('ADMIN');
    const org = await registerUser('ORG');
    const c1 = await registerUser('CUSTOMER');
    const c2 = await registerUser('CUSTOMER');
    const venue = await createVenueT(admin.token, { rows: 1, seatsPerRow: 2 });
    const showId = await createShowT(org.token, { venueId: venue.id });
    const [a] = await fetchSeatMap(showId);

    await holdApi(showId, c1.token, [a.id]).expect(201);
    const denied = await holdApi(showId, c2.token, [a.id]);
    expect(denied.status).toBe(409);
    expect(denied.body.error.code).toBe('SEAT_CONFLICT');
  });

  it('releases a hold explicitly (abandoned checkout) and accepts partial overlap', async () => {
    const admin = await registerUser('ADMIN');
    const org = await registerUser('ORG');
    const customer = await registerUser('CUSTOMER');
    const venue = await createVenueT(admin.token, { rows: 1, seatsPerRow: 4 });
    const showId = await createShowT(org.token, { venueId: venue.id });
    const seats = await fetchSeatMap(showId);

    await holdApi(showId, customer.token, seats.map((s) => s.id)).expect(201);

    const release = await request(app())
      .post(`/api/shows/${showId}/seats/holds/release`)
      .set('Authorization', `Bearer ${customer.token}`)
      .send({ seatIds: [seats[0].id, seats[1].id] });
    expect(release.status).toBe(200);
    expect(release.body.released).toBe(2);

    const after = await fetchSeatMap(showId);
    const releasedTwo = after.filter((s) => [seats[0].id, seats[1].id].includes(s.id));
    expect(releasedTwo.every((s) => s.status === 'AVAILABLE')).toBe(true);
    expect(after.find((s) => s.id === seats[2].id)!.status).toBe('HELD');
  });

  it('releases expired holds automatically (TTL enforced by DB + scheduler service)', async () => {
    const admin = await registerUser('ADMIN');
    const org = await registerUser('ORG');
    const customer = await registerUser('CUSTOMER');
    const venue = await createVenueT(admin.token, { rows: 1, seatsPerRow: 2 });
    const showId = await createShowT(org.token, { venueId: venue.id });
    const [a] = await fetchSeatMap(showId);

    // Direct service call with a tiny TTL (20ms) — simulates a very short hold.
    await holdSeats(showId, customer.user.id, [a.id], 20);
    expect((await fetchSeatMap(showId)).find((s) => s.id === a.id)!.status).toBe('HELD');

    await new Promise((r) => setTimeout(r, 60));
    const released = await releaseExpiredHolds();
    expect(released).toBe(1);
    expect((await fetchSeatMap(showId)).find((s) => s.id === a.id)!.status).toBe('AVAILABLE');
  });

  it('TTL is enforced on booking: booking an already-expired hold fails with 410', async () => {
    const admin = await registerUser('ADMIN');
    const org = await registerUser('ORG');
    const customer = await registerUser('CUSTOMER');
    const venue = await createVenueT(admin.token, { rows: 1, seatsPerRow: 2 });
    const showId = await createShowT(org.token, { venueId: venue.id });
    const [a] = await fetchSeatMap(showId);

    await holdSeats(showId, customer.user.id, [a.id], 20);
    await new Promise((r) => setTimeout(r, 60));

    const bookRes = await request(app())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${customer.token}`)
      .send({ showId, seatIds: [a.id] });
    expect(bookRes.status).toBe(410);
    expect(bookRes.body.error.code).toBe('HOLD_EXPIRED');
  });

  it('admin can trigger the scheduler endpoint to release expired holds', async () => {
    const admin = await registerUser('ADMIN');
    const org = await registerUser('ORG');
    const customer = await registerUser('CUSTOMER');
    const venue = await createVenueT(admin.token, { rows: 1, seatsPerRow: 1 });
    const showId = await createShowT(org.token, { venueId: venue.id });
    const [a] = await fetchSeatMap(showId);

    // Force an in-the-past expiry directly in the DB.
    await prisma.showSeat.update({
      where: { id: a.id },
      data: { status: 'HELD', heldById: customer.user.id, holdExpiresAt: new Date(Date.now() - 1000), holdStartedAt: new Date(Date.now() - 120_000) },
    });

    const run = await request(app())
      .post('/api/admin/scheduler/run')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(run.status).toBe(200);
    expect(run.body.holdsReleased).toBe(1);
    expect((await fetchSeatMap(showId)).find((s) => s.id === a.id)!.status).toBe('AVAILABLE');
  });
});