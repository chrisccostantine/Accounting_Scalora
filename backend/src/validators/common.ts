import { z } from 'zod';

export const idParam = z.object({ params: z.object({ id: z.string().min(1) }) });
export const listQuery = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    search: z.string().optional()
  }).passthrough()
});

export const decimal = z.coerce.number().nonnegative();
export const dateString = z.coerce.date();
