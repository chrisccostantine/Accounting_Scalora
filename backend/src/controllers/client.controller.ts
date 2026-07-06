import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { fail, ok, pagination } from '../utils/api.js';

function cleanBody(body: Record<string, unknown>) {
  return { ...body, email: body.email === '' ? null : body.email };
}

export async function listClients(req: Request, res: Response) {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 10);
  const search = String(req.query.search ?? '');
  const where: Prisma.ClientWhereInput = {
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ]
    }),
    ...(req.query.status ? { status: String(req.query.status) as never } : {}),
    ...(req.query.service ? { service: String(req.query.service) as never } : {})
  };
  const [items, total] = await Promise.all([
    prisma.client.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.client.count({ where })
  ]);
  return ok(res, 'Clients loaded', { items, pagination: pagination(page, limit, total) });
}

export async function createClient(req: Request, res: Response) {
  const client = await prisma.client.create({ data: cleanBody(req.body) as Prisma.ClientCreateInput });
  return ok(res, 'Client created', client, 201);
}

export async function updateClient(req: Request, res: Response) {
  const client = await prisma.client.update({ where: { id: req.params.id }, data: cleanBody(req.body) });
  return ok(res, 'Client updated', client);
}

export async function deleteClient(req: Request, res: Response) {
  await prisma.client.delete({ where: { id: req.params.id } }).catch(() => null);
  return ok(res, 'Client deleted');
}

export async function getClient(req: Request, res: Response) {
  const client = await prisma.client.findUnique({ where: { id: req.params.id }, include: { income: true } });
  if (!client) return fail(res, 'Client not found', 404);
  return ok(res, 'Client loaded', client);
}
