import type { Response } from 'express';

export function ok(res: Response, message: string, data: unknown = null, status = 200) {
  return res.status(status).json({ success: true, message, data });
}

export function fail(res: Response, message: string, status = 400, errors: unknown[] = []) {
  return res.status(status).json({ success: false, message, errors });
}

export function pagination(page: number, limit: number, total: number) {
  return { page, limit, total, pages: Math.ceil(total / limit) || 1 };
}
