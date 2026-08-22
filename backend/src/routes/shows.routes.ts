import { Router } from 'express';
import { z } from 'zod';
import { ShowType, SeatCategory } from '@prisma/client';
import { listShows, getShowDetail, createShow, cancelShowForOrganizer } from '../services/show.service';
import { requireAuth, requireOrgOrAdmin, type AuthedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { validateBody } from '../middleware/validate';

const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filters = {
      type: z.enum(['MOVIE', 'CONCERT']).safeParse(req.query.type).success
        ? (req.query.type as string)
        : undefined,
      city: typeof req.query.city === 'string' ? req.query.city : undefined,
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
    };
    res.json({ shows: await listShows(filters) });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const show = await getShowDetail(req.params.id);
    res.json({ show });
  }),
);

const createShowSchema = z.object({
  title: z.string().min(2).max(200),
  type: z.enum([ShowType.MOVIE, ShowType.CONCERT]),
  description: z.string().max(2000).optional(),
  venueId: z.string().uuid(),
  startsAt: z.string().datetime({ offset: true }),
  premiumPriceCents: z.number().int().positive().optional(),
  standardPriceCents: z.number().int().positive().optional(),
  prices: z
    .array(z.object({ category: z.enum([SeatCategory.PREMIUM, SeatCategory.STANDARD]), priceCents: z.number().int().positive() }))
    .optional(),
});

router.post(
  '/',
  requireAuth,
  requireOrgOrAdmin,
  validateBody(createShowSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const show = await createShow(req.user!.id, req.body);
    res.status(201).json({ show });
  }),
);

router.post(
  '/:id/cancel',
  requireAuth,
  requireOrgOrAdmin,
  asyncHandler(async (req: AuthedRequest, res) => {
    const role = req.user!.role === 'CUSTOMER' ? 'ORG' : req.user!.role;
    res.json(await cancelShowForOrganizer(req.user!.id, role, req.params.id));
  }),
);

export default router;