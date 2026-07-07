import { z } from 'zod';
import { AttachmentEntityType } from '@prisma/client';

export const attachmentBody = z.object({
  entityType: z.nativeEnum(AttachmentEntityType),
  entityId: z.string().min(1),
  title: z.string().min(1),
  url: z.string().url(),
  notes: z.string().optional().nullable()
});

export const attachmentSchema = z.object({ body: attachmentBody });
