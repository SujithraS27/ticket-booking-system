import { Router } from 'express';
import { runSchedulerOnce } from '../services/scheduler.service';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

/**
 * On-demand enforcement of seat-hold TTL and waitlist offer expiry.
 * Useful for debugging and for tests; the scheduler does the same
 * automatically every SCHEDULER_INTERVAL_MS.
 */
router.post(
  '/scheduler/run',
  requireAuth,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const result = await runSchedulerOnce();
    res.json(result);
  }),
);

router.get(
  '/health',
  asyncHandler(async (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  }),
);

export default router;