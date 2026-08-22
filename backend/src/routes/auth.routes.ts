import { Router } from 'express';
import { z } from 'zod';
import { register, login, getMe } from '../services/auth.service';
import { asyncHandler } from '../middleware/asyncHandler';
import { validateBody } from '../middleware/validate';
import { requireAuth, type AuthedRequest } from '../middleware/auth';
import { Role } from '@prisma/client';

const router = Router();

const registerSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().transform((s) => s.toLowerCase()),
  password: z.string().min(8).max(100),
  role: z.nativeEnum(Role).optional(),
});

const loginSchema = z.object({
  email: z.string().email().transform((s) => s.toLowerCase()),
  password: z.string().min(1),
});

router.post(
  '/register',
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const result = await register(req.body);
    res.status(201).json(result);
  }),
);

router.post(
  '/login',
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const result = await login(req.body.email, req.body.password);
    res.json(result);
  }),
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    res.json({ user: await getMe(req.user!.id) });
  }),
);

export default router;