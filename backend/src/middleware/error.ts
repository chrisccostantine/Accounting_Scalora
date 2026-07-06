import type { NextFunction, Request, Response } from 'express';
import { logger } from '../config/logger.js';
import { fail } from '../utils/api.js';

export function errorHandler(error: Error, _req: Request, res: Response, _next: NextFunction) {
  logger.error(error.message, { stack: error.stack });
  return fail(res, 'Internal server error', 500);
}
