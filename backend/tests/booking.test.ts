import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, resetDb, registerUser } from './helpers';
import { createVenueT, createShowT, fetchSeatMap, holdApi, book } from './factories';
import { getSentEmails, clearSentEmails } from '../src/lib/email';
import { prisma } from '../src/lib/prisma';

describe('Booking (hold -> confirm -> QR ticket email)', () => {
  beforeEach(async () => {
    await resetDb();
    clearSentEmails();
  });

  it('creates a confirmed booking with QR and email for held seats', async () => {
    const admin = await registerUser('ADMIN');
    const org = await registerUser('ORG');
    const customer = await registerUser('CUSTOMER');
    const venue = await createVenueT(admin.token, { rows: 2, seatsPerRow: 3, premiumRows: 1 });
    const showId = await createShowT(org.token, { venueId: venue.id, premiumPriceCents: 2500, standardPriceCents: 1200 });
    const seats = await fetchSeatMap(showId);
    const premium = seats.find((s) => s.category === 'PREMIUM')!;
    const standard = seats.find((s) => s.category === 'STANDARD')!;

    await holdApi(showId, customer.token, [premium.id, standard.id]).expect(201);

    const res = await book(showId, customer.token, [premium.id, standard.id]);
    expect(res.status).toBe(201);
    const { booking } = res.body;
    expect(booking.reference).toMatch(/^TBS-/);
    expect(booking.status).toBe('CONFIRMED');
    expect(booking.totalCents).toBe(2500 + 1200);
    expect(booking.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(booking.qrDataUrl.length).toBeGreaterThan(1000);

    // Stored DB state
    const dbBooking = await prisma.booking.findUnique({ where: { id: booking.id }, include: { tickets: true, seats: true } });
    expect(dbBooking?.status).toBe('CONFIRMED');
    expect(dbBooking?.tickets).toHaveLength(2);
    expect(dbBooking?.seats.every((s) => s.status === 'BOOKED')).toBe(true);

    // Email with QR is queued (delivery is awaited inside the booking call,
    // and the mailer captures sends when NODE_ENV === 'test')
    const mails = getSentEmails();
    expect(
      mails.some((m) => m.subject.includes('confirmed') && m.to === customer.user.email),
    ).toBe(true);
  });

  it('rejects booking seats that are not held by the customer', async () => {
    const admin = await registerUser('ADMIN');
    const org = await registerUser('ORG');
    const c1 = await registerUser('CUSTOMER');
    const c2 = await registerUser('CUSTOMER');
    const venue = await createVenueT(admin.token, { rows: 1, seatsPerRow: 2 });
    const showId = await createShowT(org.token, { venueId: venue.id });
    const [a] = await fetchSeatMap(showId);

    const res = await book(showId, c2.token, [a.id]);
    expect(res.status).toBe(409);

    const res2 = await book(showId, c1.token, [a.id]);
    expect(res2.status).toBe(409);
  });

  it('cannot book a seat that is already booked', async () => {
    const admin = await registerUser('ADMIN');
    const org = await registerUser('ORG');
    const c1 = await registerUser('CUSTOMER');
    const c2 = await registerUser('CUSTOMER');
    const venue = await createVenueT(admin.token, { rows: 1, seatsPerRow: 1 });
    const showId = await createShowT(org.token, { venueId: venue.id });
    const [a] = await fetchSeatMap(showId);

    await holdApi(showId, c1.token, [a.id]).expect(201);
    await book(showId, c1.token, [a.id]).expect(201);

    const again = await book(showId, c1.token, [a.id]);
    expect(again.status).toBe(409);

    await holdApi(showId, c2.token, [a.id]).expect(409);
  });

  it('lists booking history per customer and rejects viewing others bookings', async () => {
    const admin = await registerUser('ADMIN');
    const org = await registerUser('ORG');
    const c1 = await registerUser('CUSTOMER');
    const c2 = await registerUser('CUSTOMER');
    const venue = await createVenueT(admin.token, { rows: 1, seatsPerRow: 1 });
    const showId = await createShowT(org.token, { venueId: venue.id });
    const [a] = await fetchSeatMap(showId);

    await holdApi(showId, c1.token, [a.id]).expect(201);
    const bookRes = await book(showId, c1.token, [a.id]);
    const bookingId = bookRes.body.booking.id;

    const mine = await request(app())
      .get('/api/bookings/my')
      .set('Authorization', `Bearer ${c1.token}`);
    expect(mine.status).toBe(200);
    expect(mine.body.bookings).toHaveLength(1);
    expect(mine.body.bookings[0].seats[0].label).toBe(a.label);

    const forbidden = await request(app())
      .get(`/api/bookings/${bookingId}`)
      .set('Authorization', `Bearer ${c2.token}`);
    expect(forbidden.status).toBe(403);
  });
});