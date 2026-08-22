import { Router } from 'express';
import { z } from 'zod';
import { createVenue, deleteVenue, listVenues, getVenue } from '../services/venue.service';
import { requireAdmin, requireAuth, type AuthedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { validateBody } from '../middleware/validate';

const router = Router();

const venueSchema = z.object({
  name: z.string().min(2).max(160),
  city: z.string().min(2).max(120),
  rows: z.number().int().min(1).max(60),
  seatsPerRow: z.number().int().min(1).max(40),
  premiumRows: z.number().int().min(0).max(60).optional(),
});

router.get(
  '/',
  requireAuth,
  asyncHandler(async (_req, res) => {
    res.json({ venues: await listVenues() });
  }),
);

router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ venue: await getVenue(req.params.id) });
  }),
);

router.post(
  '/',
  requireAuth,
  requireAdmin,
  validateBody(venueSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    res.status(201).json({ venue: await createVenue(req.body) });
  }),
);

router.delete(
  '/:id',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.json(await deleteVenue(req.params.id));
  }),
);

export default router;