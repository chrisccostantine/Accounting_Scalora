import { z } from 'zod';
import { PaymentMethod } from '@prisma/client';
import { dateString, decimal } from './common.js';

export const incomeBody = z.object({
  clientId: z.string().min(1),
  amount: decimal,
  currency: z.string().min(3).max(8).default('USD'),
  date: dateString,
  paymentMethod: z.nativeEnum(PaymentMethod),
  referenceNumber: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  invoiceNumber: z.string().optional().nullable()
});

export const incomeSchema = z.object({ body: incomeBody });
