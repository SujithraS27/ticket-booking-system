import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, resetDb, registerUser } from './helpers';
import { createVenueT, createShowT } from './factories';

describe('Venue & show management with roles', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('only admins can create venues; venue seats are auto-generated', async () => {
    const admin = await registerUser('ADMIN');
    const customer = await registerUser('CUSTOMER');

    const denied = await request(app())
      .post('/api/venues')
      .set('Authorization', `Bearer ${customer.token}`)
      .send({ name: 'Hack', city: 'Nowhere', rows: 2, seatsPerRow: 3, premiumRows: 1 });
    expect(denied.status).toBe(403);

    const ok = await request(app())
      .post('/api/venues')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: 'Grand Hall', city: 'Mumbai', rows: 3, seatsPerRow: 4, premiumRows: 1 });
    expect(ok.status).toBe(201);
    expect(ok.body.venue.id).toBeDefined();

    const detail = await request(app())
      .get(`/api/venues/${ok.body.venue.id}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(detail.status).toBe(200);
    expect(detail.body.venue.seats).toHaveLength(12); // 3 rows x 4 cols
    expect(detail.body.venue.seats.filter((s: { category: string }) => s.category === 'PREMIUM')).toHaveLength(4);
  });

  it('only organisers/admins can create shows; showSeats provisioned per venue seat', async () => {
    const admin = await registerUser('ADMIN');
    const org = await registerUser('ORG');
    const customer = await registerUser('CUSTOMER');
    const venue = await createVenueT(admin.token, { rows: 2, seatsPerRow: 5, premiumRows: 1 });

    const denied = await request(app())
      .post('/api/shows')
      .set('Authorization', `Bearer ${customer.token}`)
      .send({
        title: 'Nope',
        type: 'MOVIE',
        venueId: venue.id,
        startsAt: new Date(Date.now() + 86400000).toISOString(),
        premiumPriceCents: 1000,
        standardPriceCents: 500,
      });
    expect(denied.status).toBe(403);

    const ok = await request(app())
      .post('/api/shows')
      .set('Authorization', `Bearer ${org.token}`)
      .send({
        title: 'Midnight in Mumbai',
        type: 'MOVIE',
        venueId: venue.id,
        startsAt: new Date(Date.now() + 86400000).toISOString(),
        premiumPriceCents: 2500,
        standardPriceCents: 1200,
      });
    expect(ok.status).toBe(201);
    const showId = ok.body.show.id;

    const map = await request(app()).get(`/api/shows/${showId}/seats/map`);
    expect(map.status).toBe(200);
    expect(map.body.seats).toHaveLength(10);
    expect(map.body.seats[0]).toHaveProperty('status', 'AVAILABLE');
  });

  it('lists shows publicly with stats', async () => {
    const admin = await registerUser('ADMIN');
    const org = await registerUser('ORG');
    const venue = await createVenueT(admin.token, { rows: 2, seatsPerRow: 3 });
    await createShowT(org.token, { venueId: venue.id });
    const res = await request(app()).get('/api/shows');
    expect(res.status).toBe(200);
    expect(res.body.shows.length).toBe(1);
    expect(res.body.shows[0].stats.available).toBe(6);
  });

  it('public seat map marks seats held by the requesting user', async () => {
    const admin = await registerUser('ADMIN');
    const org = await registerUser('ORG');
    const customerA = await registerUser('CUSTOMER');
    const venue = await createVenueT(admin.token, { rows: 1, seatsPerRow: 3 });
    const showId = await createShowT(org.token, { venueId: venue.id });

    const map = await request(app()).get(`/api/shows/${showId}/seats/map`);
    const target = map.body.seats[0];

    await request(app())
      .post(`/api/shows/${showId}/seats/holds`)
      .set('Authorization', `Bearer ${customerA.token}`)
      .send({ seatIds: [target.id] })
      .expect(201);

    const mapForA = await request(app())
      .get(`/api/shows/${showId}/seats/map`)
      .set('Authorization', `Bearer ${customerA.token}`);
    expect(mapForA.body.seats[0].status).toBe('HELD');
    expect(mapForA.body.seats[0].heldByMe).toBe(true);

    const mapForB = await request(app()).get(`/api/shows/${showId}/seats/map`);
    expect(mapForB.body.seats[0].status).toBe('HELD');
    expect(mapForB.body.seats[0].heldByMe).toBe(false);
  });

  it('organiser sees booking summary and revenue per show', async () => {
    const admin = await registerUser('ADMIN');
    const org = await registerUser('ORG');
    const customer = await registerUser('CUSTOMER');
    const venue = await createVenueT(admin.token, { rows: 1, seatsPerRow: 2, premiumRows: 1 });
    const showId = await createShowT(org.token, { venueId: venue.id, premiumPriceCents: 3000, standardPriceCents: 1000 });

    const map = await request(app()).get(`/api/shows/${showId}/seats/map`);
    const [premium] = map.body.seats;

    await request(app())
      .post(`/api/shows/${showId}/seats/holds`)
      .set('Authorization', `Bearer ${customer.token}`)
      .send({ seatIds: [premium.id] })
      .expect(201);
    await request(app())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${customer.token}`)
      .send({ showId, seatIds: [premium.id] })
      .expect(201);

    const stats = await request(app())
      .get('/api/organiser/stats')
      .set('Authorization', `Bearer ${org.token}`);
    expect(stats.status).toBe(200);
    const row = stats.body.rows.find((r: { showId: string }) => r.showId === showId);
    expect(row.revenueCents).toBe(3000);
    expect(row.bookingsCount).toBe(1);
    expect(row.ticketsSold).toBe(1);
  });
});