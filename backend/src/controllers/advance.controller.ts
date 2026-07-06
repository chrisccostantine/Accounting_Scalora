import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { ok, pagination } from '../utils/api.js';

const money = (value: unknown) => Number(value ?? 0);

function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value ?? '';
}

function withTotals<T extends { amount: Prisma.Decimal; repayments: { amount: Prisma.Decimal }[] }>(advance: T) {
  const repaid = advance.repayments.reduce((total, item) => total + money(item.amount), 0);
  const outstanding = Math.max(0, money(advance.amount) - repaid);
  return { ...advance, repaid, outstanding, computedStatus: outstanding <= 0 ? 'PAID' : 'OPEN' };
}

export async function listAdvances(req: Request, res: Response) {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 10);
  const search = String(req.query.search ?? '');
  const where: Prisma.OwnerAdvanceWhereInput = {
    ...(search && {
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { source: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } }
      ]
    }),
    ...(req.query.status ? { status: String(req.query.status) as never } : {})
  };
  const [items, total] = await Promise.all([
    prisma.ownerAdvance.findMany({ where, include: { repayments: { orderBy: { date: 'desc' } } }, orderBy: { date: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.ownerAdvance.count({ where })
  ]);
  return ok(res, 'Owner advances loaded', { items: items.map(withTotals), pagination: pagination(page, limit, total) });
}

export async function createAdvance(req: Request, res: Response) {
  const item = await prisma.ownerAdvance.create({ data: req.body, include: { repayments: true } });
  return ok(res, 'Owner advance created', withTotals(item), 201);
}

export async function updateAdvance(req: Request, res: Response) {
  const item = await prisma.ownerAdvance.update({ where: { id: param(req.params.id) }, data: req.body, include: { repayments: true } });
  return ok(res, 'Owner advance updated', withTotals(item));
}

export async function deleteAdvance(req: Request, res: Response) {
  await prisma.ownerAdvance.delete({ where: { id: param(req.params.id) } }).catch(() => null);
  return ok(res, 'Owner advance deleted');
}

export async function createRepayment(req: Request, res: Response) {
  const advanceId = param(req.params.id);
  const repayment = await prisma.advanceRepayment.create({ data: { ...req.body, advanceId } });
  await syncAdvanceStatus(advanceId);
  return ok(res, 'Repayment recorded', repayment, 201);
}

export async function deleteRepayment(req: Request, res: Response) {
  const repayment = await prisma.advanceRepayment.delete({ where: { id: param(req.params.id) } }).catch(() => null);
  if (repayment) await syncAdvanceStatus(repayment.advanceId);
  return ok(res, 'Repayment deleted');
}

async function syncAdvanceStatus(advanceId: string) {
  const advance = await prisma.ownerAdvance.findUnique({ where: { id: advanceId }, include: { repayments: true } });
  if (!advance) return;
  const repaid = advance.repayments.reduce((total, item) => total + money(item.amount), 0);
  await prisma.ownerAdvance.update({ where: { id: advanceId }, data: { status: repaid >= money(advance.amount) ? 'PAID' : 'OPEN' } });
}
