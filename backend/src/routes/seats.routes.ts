import { Router } from 'express';
import { z } from 'zod';
import { getSeatMap } from '../services/show.service';
import { holdSeats, releaseHeldSeats } from '../services/hold.service';
import { requireAuth, optionalAuth, type AuthedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { validateBody } from '../middleware/validate';

/**
 * Seat map + hold endpoints for a show.
 * Mounted at /api/shows — every path carries :showId explicitly.
 */
const router = Router();

/** Visual seat map with real-time status + per-category prices. */
router.get(
  '/:showId/seats/map',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const seatMap = await getSeatMap(req.params.showId, (req as AuthedRequest).user?.id ?? null);
    res.json(seatMap);
  }),
);

const holdSchema = z.object({
  seatIds: z.array(z.string().uuid()).min(1).max(10),
});

/** Place a concurrency-safe hold on seats (see services/hold.service.ts). */
router.post(
  '/:showId/seats/holds',
  requireAuth,
  validateBody(holdSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const result = await holdSeats(req.params.showId, req.user!.id, req.body.seatIds);
    res.status(201).json(result);
  }),
);

/** Release a hold when the customer abandons checkout. */
router.post(
  '/:showId/seats/holds/release',
  requireAuth,
  validateBody(holdSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const seatIds = req.body.seatIds;
    const count = await releaseHeldSeats(req.params.showId, req.user!.id, seatIds);
    res.json({ released: count, seats: seatIds });
  }),
);

export default router;