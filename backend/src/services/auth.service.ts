import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { hashPassword, verifyPassword } from '../lib/password';
import { signToken } from '../lib/jwt';
import { AppError, NotFoundError } from '../lib/errors';

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  role?: Role;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
}

function toPublic(user: { id: string; name: string; email: string; role: Role; createdAt: Date }): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (existing) throw new AppError(409, 'An account with this email already exists', 'EMAIL_TAKEN');

  const role = input.role ?? Role.CUSTOMER;
  const password = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      name: input.name.trim(),
      email: input.email.toLowerCase(),
      password,
      role,
    },
  });
  const token = signToken({ sub: user.id, role: user.role, email: user.email });
  return { token, user: toPublic(user) };
}

export async function login(email: string, passwordPlain: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  const ok = await verifyPassword(passwordPlain, user.password);
  if (!ok) throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  const token = signToken({ sub: user.id, role: user.role, email: user.email });
  return { token, user: toPublic(user) };
}

export async function getMe(userId: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError('User not found');
  return toPublic(user);
}