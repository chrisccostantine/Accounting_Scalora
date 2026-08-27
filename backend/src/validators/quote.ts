import { QuoteStatus } from '@prisma/client';
import { z } from 'zod';
import { dateString, decimal } from './common.js';

const quoteItem = z.object({
  description: z.string().trim().min(1).max(200),
  quantity: decimal.refine((value) => Number(value) > 0, 'Quantity must be positive'),
  unitPrice: decimal.refine((value) => Number(value) >= 0, 'Unit price cannot be negative')
});

export const quoteBody = z.object({
  clientId: z.string().min(1),
  quoteNumber: z.string().trim().min(1).max(50),
  issueDate: dateString,
  validUntil: dateString,
  currency: z.string().trim().min(3).max(8).default('USD'),
  status: z.nativeEnum(QuoteStatus).default(QuoteStatus.DRAFT),
  discount: decimal.refine((value) => Number(value) >= 0, 'Discount cannot be negative').default(0),
  taxRate: decimal.refine((value) => Number(value) >= 0 && Number(value) <= 100, 'Tax rate must be between 0 and 100').default(0),
  notes: z.string().max(1000).optional().nullable(),
  terms: z.string().max(1000).optional().nullable(),
  items: z.array(quoteItem).min(1).max(8)
}).refine((value) => value.validUntil >= value.issueDate, { message: 'Valid until must be on or after issue date', path: ['validUntil'] });

export const quoteSchema = z.object({ body: quoteBody });
