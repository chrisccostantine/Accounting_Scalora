import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { ok, pagination } from '../utils/api.js';

function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value ?? '';
}

export async function listIncome(req: Request, res: Response) {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 10);
  const search = String(req.query.search ?? '');
  const where: Prisma.IncomeWhereInput = {
    ...(search && {
      OR: [
        { description: { contains: search, mode: 'insensitive' } },
        { referenceNumber: { contains: search, mode: 'insensitive' } },
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { client: { name: { contains: search, mode: 'insensitive' } } }
      ]
    }),
    ...(req.query.clientId ? { clientId: String(req.query.clientId) } : {}),
    ...(req.query.paymentMethod ? { paymentMethod: String(req.query.paymentMethod) as never } : {})
  };
  const [items, total] = await Promise.all([
    prisma.income.findMany({ where, include: { client: true }, orderBy: { date: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.income.count({ where })
  ]);
  return ok(res, 'Income loaded', { items, pagination: pagination(page, limit, total) });
}

export async function createIncome(req: Request, res: Response) {
  const item = await prisma.income.create({ data: req.body, include: { client: true } });
  return ok(res, 'Income created', item, 201);
}

export async function updateIncome(req: Request, res: Response) {
  const item = await prisma.income.update({ where: { id: param(req.params.id) }, data: req.body, include: { client: true } });
  return ok(res, 'Income updated', item);
}

export async function deleteIncome(req: Request, res: Response) {
  await prisma.income.delete({ where: { id: param(req.params.id) } }).catch(() => null);
  return ok(res, 'Income deleted');
}
