import { z } from 'zod';
import { ClientService, ClientStatus } from '@prisma/client';
import { dateString, decimal } from './common.js';

export const clientBody = z.object({
  name: z.string().min(1),
  company: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  service: z.nativeEnum(ClientService),
  monthlyFee: decimal,
  currency: z.string().min(3).max(8).default('USD'),
  status: z.nativeEnum(ClientStatus).default(ClientStatus.ACTIVE),
  contractStartDate: dateString,
  notes: z.string().optional().nullable()
});

export const clientSchema = z.object({ body: clientBody });
