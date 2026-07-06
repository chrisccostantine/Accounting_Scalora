import { z } from 'zod';
import { ExpenseCategory, PaymentFrequency, PaymentMethod } from '@prisma/client';
import { dateString, decimal } from './common.js';

export const expenseBody = z.object({
  title: z.string().min(1),
  amount: decimal,
  currency: z.string().min(3).max(8).default('USD'),
  category: z.nativeEnum(ExpenseCategory),
  paymentMethod: z.nativeEnum(PaymentMethod),
  frequency: z.nativeEnum(PaymentFrequency).default(PaymentFrequency.ONE_TIME),
  date: dateString,
  vendor: z.string().optional().nullable(),
  receiptNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
});

export const expenseSchema = z.object({ body: expenseBody });
