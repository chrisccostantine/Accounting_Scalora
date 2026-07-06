import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';
import { fail } from '../utils/api.js';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse({ body: req.body, query: req.query, params: req.params });
    if (!parsed.success) return fail(res, 'Validation failed', 422, parsed.error.issues);
    req.body = parsed.data.body ?? req.body;
    return next();
  };
}
