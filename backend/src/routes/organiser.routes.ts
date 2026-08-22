import { Router } from 'express';
import { getOrganiserStats, getShowBookings } from '../services/stats.service';
import { requireAuth, requireOrgOrAdmin, type AuthedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { listShows } from '../services/show.service';

const router = Router();

/** Summary + revenue per event owned by the organiser. */
router.get(
  '/stats',
  requireAuth,
  requireOrgOrAdmin,
  asyncHandler(async (req: AuthedRequest, res) => {
    if (req.user!.role === 'ADMIN') {
      const { getAdminSummary } = await import('../services/stats.service');
      const summary = await getAdminSummary();
      res.json({ role: 'ADMIN', ...summary });
      return;
    }
    res.json(await getOrganiserStats(req.user!.id));
  }),
);

/** Booking list (per show) plus current seat breakdown. */
router.get(
  '/shows',
  requireAuth,
  requireOrgOrAdmin,
  asyncHandler(async (_req: AuthedRequest, res) => {
    res.json({ shows: await listShows() });
  }),
);

router.get(
  '/shows/:showId/bookings',
  requireAuth,
  requireOrgOrAdmin,
  asyncHandler(async (req: AuthedRequest, res) => {
    const result = await getShowBookings(req.params.showId, req.user!.id, req.user!.role);
    res.json(result);
  }),
);

export default router;