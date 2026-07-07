import { z } from 'zod';
import { InvoiceStatus, PaymentMethod } from '@prisma/client';
import { dateString, decimal } from './common.js';

export const invoiceBody = z.object({
  clientId: z.string().min(1),
  invoiceNumber: z.string().min(1),
  amount: decimal,
  currency: z.string().min(3).max(8).default('USD'),
  issueDate: dateString,
  dueDate: dateString,
  status: z.nativeEnum(InvoiceStatus).default(InvoiceStatus.SENT),
  description: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
});

export const invoicePaymentBody = z.object({
  amount: decimal,
  currency: z.string().min(3).max(8).default('USD'),
  date: dateString,
  paymentMethod: z.nativeEnum(PaymentMethod),
  referenceNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
});

export const invoiceSchema = z.object({ body: invoiceBody });
export const invoicePaymentSchema = z.object({ body: invoicePaymentBody });
