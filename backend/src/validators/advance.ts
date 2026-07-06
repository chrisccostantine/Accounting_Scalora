import { PaymentMethod } from '@prisma/client';
import { z } from 'zod';
import { dateString, decimal } from './common.js';

const optionalNumber = z.preprocess((value) => value === '' ? undefined : value, z.coerce.number().positive().optional().nullable());
const optionalDate = z.preprocess((value) => value === '' ? undefined : value, dateString.optional().nullable());

export const advanceBody = z.object({
  title: z.string().min(1),
  amount: decimal,
  currency: z.string().min(3).max(8).default('USD'),
  date: dateString,
  source: z.string().optional().nullable(),
  plannedInstallments: optionalNumber,
  installmentAmount: optionalNumber,
  nextDueDate: optionalDate,
  notes: z.string().optional().nullable()
});

export const repaymentBody = z.object({
  amount: decimal,
  currency: z.string().min(3).max(8).default('USD'),
  date: dateString,
  paymentMethod: z.nativeEnum(PaymentMethod),
  notes: z.string().optional().nullable()
});

export const advanceSchema = z.object({ body: advanceBody });
export const repaymentSchema = z.object({ body: repaymentBody });
