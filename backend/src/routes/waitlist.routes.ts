import { Router } from 'express';
import { z } from 'zod';
import { joinWaitlist, leaveWaitlist, getOfferByToken, acceptOffer, declineOffer } from '../services/waitlist.service';
import { requireAuth, type AuthedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { validateBody } from '../middleware/validate';

const joinSchema = z.object({
  category: z.enum(['PREMIUM', 'STANDARD']),
});

// ------------------------------------------------------------------
// Waitlist queue (mounted at /api/shows)
// ------------------------------------------------------------------
export const waitlistRouter = Router();

/** Join the ordered FIFO waitlist for a seat category of a show. */
waitlistRouter.post(
  '/:showId/waitlist',
  requireAuth,
  validateBody(joinSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    res.status(201).json({ entry: await joinWaitlist(req.user!.id, req.params.showId, req.body.category) });
  }),
);

waitlistRouter.delete(
  '/:showId/waitlist',
  requireAuth,
  validateBody(joinSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    res.json(await leaveWaitlist(req.user!.id, req.params.showId, req.body.category));
  }),
);

// ---------------------------------------------------------------------------
// Time-limited offer links (mounted at /api/offers)
// ---------------------------------------------------------------------------
export const offersRouter = Router();

/** Look up an offer by its time-limited link token (public metadata). */
offersRouter.get(
  '/:token',
  asyncHandler(async (req, res) => {
    const info = await getOfferByToken(req.params.token);
    res.json({ offer: info });
  }),
);

/** Accept the offer and receive the QR ticket (the offer owner only). */
offersRouter.post(
  '/:token/accept',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    res.status(201).json(await acceptOffer(req.user!.id, req.params.token));
  }),
);

/** Decline the offer; the seat moves to the next person in line. */
offersRouter.post(
  '/:token/decline',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    await declineOffer(req.user!.id, req.params.token);
    res.json({ declined: true });
  }),
);

export { joinSchema };