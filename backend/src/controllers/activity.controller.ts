import type { Request, Response } from 'express';
import { prisma } from '../config/prisma.js';
import { ok, pagination } from '../utils/api.js';

export async function listActivity(req: Request, res: Response) {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 25);
  const [items, total] = await Promise.all([
    prisma.activityLog.findMany({ orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.activityLog.count()
  ]);
  return ok(res, 'Activity loaded', { items, pagination: pagination(page, limit, total) });
}
