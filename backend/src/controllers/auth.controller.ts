import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { fail, ok } from '../utils/api.js';
import { ensureAdminUser } from '../services/admin.service.js';

export async function login(req: Request, res: Response) {
  if (req.body.email === env.ADMIN_EMAIL) {
    await ensureAdminUser();
  }

  const user = await prisma.user.findUnique({ where: { email: req.body.email } });
  if (!user) return fail(res, 'Invalid email or password', 401);

  const valid = await bcrypt.compare(req.body.password, user.passwordHash);
  if (!valid) return fail(res, 'Invalid email or password', 401);

  const token = jwt.sign({ sub: user.id }, env.JWT_SECRET, { expiresIn: '8h' });
  return ok(res, 'Login successful', { token, user: { id: user.id, email: user.email } });
}

export async function me(req: Request, res: Response) {
  return ok(res, 'Authenticated', { authenticated: true });
}
