import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, resetDb, registerUser } from './helpers';
import { createVenueT, createShowT, fetchSeatMap, holdApi, book } from './factories';
import { prisma } from '../src/lib/prisma';

/**
 * CONCURRENCY PROOF
 * These tests hammer the API (and services) with parallel requests for the
 * SAME seat and assert that exactly ONE operation wins.
 */
describe('Concurrency protection', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('exactly one of N concurrent holds on the same seat succeeds', async () => {
    const admin = await registerUser('ADMIN');
    const org = await registerUser('ORG');
    const venue = await createVenueT(admin.token, { rows: 1, seatsPerRow: 1 });
    const showId = await createShowT(org.token, { venueId: venue.id });
    const [a] = await fetchSeatMap(showId);

    const customers = [];
    for (let i = 0; i < 20; i++) customers.push(await registerUser('CUSTOMER'));

    const responses = await Promise.all(
      customers.map((c) => holdApi(showId, c.token, [a.id]).then((r) => r.status)),
    );

    const ok = responses.filter((s) => s === 201);
    const conflicts = responses.filter((s) => s === 409);
    expect(ok).toHaveLength(1);
    expect(conflicts).toHaveLength(19);

    // Verify the seat is held by exactly one distinct customer and nobody else.
    const row = await prisma.showSeat.findUnique({ where: { id: a.id } });
    expect(row?.status).toBe('HELD');
    const holders = await prisma.showSeat.findMany({
      where: { id: a.id, status: 'HELD', heldById: { not: null } },
    });
    expect(holders).toHaveLength(1);
  });

  it('concurrent holds on different seats all succeed (no cross-talk)', async () => {
    const admin = await registerUser('ADMIN');
    const org = await registerUser('ORG');
    const venue = await createVenueT(admin.token, { rows: 1, seatsPerRow: 4 });
    const showId = await createShowT(org.token, { venueId: venue.id });
    const seats = await fetchSeatMap(showId);

    const customers = [];
    for (let i = 0; i < 4; i++) customers.push(await registerUser('CUSTOMER'));

    const results = await Promise.all(
      seats.map((s, i) => holdApi(showId, customers[i % 4].token, [s.id]).then((r) => r.status)),
    );
    expect(results.every((s) => s === 201)).toBe(true);
    expect(await prisma.showSeat.count({ where: { showId, status: 'HELD' } })).toBe(4);
  });

  it('two customers cannot both book the same held seat', async () => {
    const admin = await registerUser('ADMIN');
    const org = await registerUser('ORG');
    const c1 = await registerUser('CUSTOMER');
    const c2 = await registerUser('CUSTOMER');
    const venue = await createVenueT(admin.token, { rows: 1, seatsPerRow: 1 });
    const showId = await createShowT(org.token, { venueId: venue.id });
    const [a] = await fetchSeatMap(showId);

    await holdApi(showId, c1.token, [a.id]).expect(201);

    const [bookC1, bookC2] = await Promise.all([
      book(showId, c1.token, [a.id]),
      book(showId, c2.token, [a.id]),
    ]);
    expect(bookC1.status).toBe(201);
    expect(bookC2.status).toBe(409); // not held by c2
    expect((await prisma.showSeat.findUnique({ where: { id: a.id } }))!.status).toBe('BOOKED');
  });

  it('concurrent holds resets nothing and holds respect their own transactions', async () => {
    const admin = await registerUser('ADMIN');
    const org = await registerUser('ORG');
    const c1 = await registerUser('CUSTOMER');
    const c2 = await registerUser('CUSTOMER');
    const venue = await createVenueT(admin.token, { rows: 1, seatsPerRow: 2 });
    const showId = await createShowT(org.token, { venueId: venue.id });
    const seats = await fetchSeatMap(showId);

    // Both try to hold [s1, s2] simultaneously — only one can win; the other
    // must not have partially held anything.
    const [r1, r2] = await Promise.all([
      holdApi(showId, c1.token, seats.map((s) => s.id)),
      holdApi(showId, c2.token, seats.map((s) => s.id)),
    ]);
    const won = r1.status === 201 ? c1 : c2;
    const lost = r1.status === 201 ? c2 : c1;
    expect(r1.status === 201 || r2.status === 201).toBe(true);
    expect(r1.status === 409 || r2.status === 409).toBe(true);

    const held = await prisma.showSeat.findMany({ where: { showId, status: 'HELD' } });
    expect(held).toHaveLength(2);
    expect(held.every((s) => s.heldById === won.user.id)).toBe(true);
    expect(held.some((s) => s.heldById === lost.user.id)).toBe(false);
  });

  it('twenty parallel hold requests over two seats never double-assign', async () => {
    const admin = await registerUser('ADMIN');
    const org = await registerUser('ORG');
    const venue = await createVenueT(admin.token, { rows: 1, seatsPerRow: 2 });
    const showId = await createShowT(org.token, { venueId: venue.id });
    const seats = await fetchSeatMap(showId);
    const seatIds = seats.map((s) => s.id);

    const customers = await Promise.all(
      Array.from({ length: 20 }, () => registerUser('CUSTOMER')),
    );
    const statuses = await Promise.all(
      customers.flatMap((c) =>
        seatIds.map((sid) => holdApi(showId, c.token, [sid]).then((r) => r.status)),
      ),
    );

    expect(statuses.filter((s) => s === 201)).toHaveLength(2);
    const winners = await prisma.showSeat.findMany({ where: { showId, status: 'HELD' } });
    expect(winners).toHaveLength(2);
    // Each seat must be held by exactly ONE account (holders may coincide
    // across the two seats, but every held row has exactly one owner).
    expect(winners.every((w) => w.heldById)).toBe(true);
    const heldPerUser = await prisma.showSeat.groupBy({
      by: ['heldById'],
      where: { showId, status: 'HELD' },
      _count: { _all: true },
    });
    expect(heldPerUser.reduce((sum, g) => sum + g._count._all, 0)).toBe(2);
  });
});