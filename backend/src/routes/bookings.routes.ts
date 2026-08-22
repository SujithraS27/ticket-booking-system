import { Router } from 'express';
import { z } from 'zod';
import { createBooking, listUserBookings, getBookingForUser } from '../services/booking.service';
import { cancelBooking } from '../services/cancellation.service';
import { requireAuth, type AuthedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { validateBody } from '../middleware/validate';

const router = Router();

const bookingSchema = z.object({
  showId: z.string().uuid(),
  seatIds: z.array(z.string().uuid()).min(1).max(10),
});

/**
 * Confirm a booking from seats the customer currently holds.
 * Requires the holds to be active; returns the QR ticket.
 */
router.post(
  '/',
  requireAuth,
  validateBody(bookingSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const result = await createBooking(req.user!.id, req.body.showId, req.body.seatIds);
    res.status(201).json(result);
  }),
);

/** Customer booking history. */
router.get(
  '/my',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const bookings = await listUserBookings(req.user!.id);
    res.json({
      bookings: bookings.map((b) => ({
        id: b.id,
        reference: b.reference,
        status: b.status,
        totalCents: b.totalCents,
        createdAt: b.createdAt.toISOString(),
        cancelledAt: b.cancelledAt ? b.cancelledAt.toISOString() : null,
        qrDataUrl: b.qrDataUrl,
        show: {
          id: b.show.id,
          title: b.show.title,
          type: b.show.type,
          startsAt: b.show.startsAt.toISOString(),
          venue: { name: b.show.venue.name, city: b.show.venue.city },
        },
        seats: b.seats.map((s) => ({
          id: s.id,
          label: s.seat.label,
          category: s.seat.category,
          status: s.status,
        })),
      })),
    });
  }),
);

router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const booking = await getBookingForUser(req.params.id, req.user!.id);
    res.json({
      booking: {
        id: booking.id,
        reference: booking.reference,
        status: booking.status,
        totalCents: booking.totalCents,
        qrDataUrl: booking.qrDataUrl,
        createdAt: booking.createdAt,
        show: {
          id: booking.show.id,
          title: booking.show.title,
          startsAt: booking.show.startsAt,
          venue: { name: booking.show.venue.name, city: booking.show.venue.city },
        },
        seats: booking.seats.map((s) => ({
          label: s.seat.label,
          category: s.seat.category,
          status: s.status,
        })),
      },
    });
  }),
);

/**
 * Cancel a booking. Released seats are automatically offered to the next
 * waitlist customer (time-limited) or returned to AVAILABLE.
 */
router.post(
  '/:id/cancel',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const outcome = await cancelBooking(req.user!.id, req.user!.role, req.params.id);
    res.json(outcome);
  }),
);

export default router;