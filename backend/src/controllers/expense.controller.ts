import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { ok, pagination } from '../utils/api.js';

export async function listExpenses(req: Request, res: Response) {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 10);
  const search = String(req.query.search ?? '');
  const where: Prisma.ExpenseWhereInput = {
    ...(search && {
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { vendor: { contains: search, mode: 'insensitive' } },
        { receiptNumber: { contains: search, mode: 'insensitive' } }
      ]
    }),
    ...(req.query.category ? { category: String(req.query.category) as never } : {}),
    ...(req.query.paymentMethod ? { paymentMethod: String(req.query.paymentMethod) as never } : {})
  };
  const [items, total] = await Promise.all([
    prisma.expense.findMany({ where, orderBy: { date: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.expense.count({ where })
  ]);
  return ok(res, 'Expenses loaded', { items, pagination: pagination(page, limit, total) });
}

export async function createExpense(req: Request, res: Response) {
  const item = await prisma.expense.create({ data: req.body });
  return ok(res, 'Expense created', item, 201);
}

export async function updateExpense(req: Request, res: Response) {
  const item = await prisma.expense.update({ where: { id: req.params.id }, data: req.body });
  return ok(res, 'Expense updated', item);
}

export async function deleteExpense(req: Request, res: Response) {
  await prisma.expense.delete({ where: { id: req.params.id } }).catch(() => null);
  return ok(res, 'Expense deleted');
}
