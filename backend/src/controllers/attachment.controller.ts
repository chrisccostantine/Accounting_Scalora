import type { Request, Response } from 'express';
import { AttachmentEntityType, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { ok, pagination } from '../utils/api.js';
import { recordActivity } from '../services/activity.service.js';

function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value ?? '';
}

export async function listAttachments(req: Request, res: Response) {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 25);
  const where: Prisma.AttachmentWhereInput = {
    ...(req.query.entityType ? { entityType: String(req.query.entityType) as AttachmentEntityType } : {}),
    ...(req.query.entityId ? { entityId: String(req.query.entityId) } : {})
  };
  const [items, total] = await Promise.all([
    prisma.attachment.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.attachment.count({ where })
  ]);
  return ok(res, 'Attachments loaded', { items, pagination: pagination(page, limit, total) });
}

export async function createAttachment(req: Request, res: Response) {
  const attachment = await prisma.attachment.create({ data: req.body });
  await recordActivity({ action: 'ATTACHED', entityType: attachment.entityType, entityId: attachment.entityId, title: `Attachment added: ${attachment.title}`, details: attachment.url });
  return ok(res, 'Attachment created', attachment, 201);
}

export async function deleteAttachment(req: Request, res: Response) {
  await prisma.attachment.delete({ where: { id: param(req.params.id) } }).catch(() => null);
  return ok(res, 'Attachment deleted');
}
