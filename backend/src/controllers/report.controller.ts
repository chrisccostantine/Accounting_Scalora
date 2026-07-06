import type { Request, Response } from 'express';
import { prisma } from '../config/prisma.js';
import { monthRange } from '../utils/date.js';
import { ok } from '../utils/api.js';

const money = (value: unknown) => Number(value ?? 0);

async function totalsBetween(start: Date, end: Date, filters: { clientId?: string; category?: string } = {}) {
  const [income, expenses] = await Promise.all([
    prisma.income.aggregate({ where: { date: { gte: start, lt: end }, ...(filters.clientId ? { clientId: filters.clientId } : {}) }, _sum: { amount: true } }),
    prisma.expense.aggregate({ where: { date: { gte: start, lt: end }, ...(filters.category ? { category: filters.category as never } : {}) }, _sum: { amount: true } })
  ]);
  return { income: money(income._sum.amount), expenses: money(expenses._sum.amount) };
}

export async function dashboard(req: Request, res: Response) {
  const { start, end } = monthRange();
  const totals = await totalsBetween(start, end);
  const [activeClients, recentIncome, recentExpenses, recentClients, expected] = await Promise.all([
    prisma.client.count({ where: { status: 'ACTIVE' } }),
    prisma.income.findMany({ include: { client: true }, orderBy: { date: 'desc' }, take: 5 }),
    prisma.expense.findMany({ orderBy: { date: 'desc' }, take: 5 }),
    prisma.client.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
    prisma.client.aggregate({ where: { status: 'ACTIVE' }, _sum: { monthlyFee: true } })
  ]);
  const collected = totals.income;
  const pending = Math.max(0, money(expected._sum.monthlyFee) - collected);
  const charts = await chartData(new Date().getFullYear());
  return ok(res, 'Dashboard loaded', {
    cards: { totalIncome: totals.income, totalExpenses: totals.expenses, netProfit: totals.income - totals.expenses, activeClients, collected, pending },
    recentIncome,
    recentExpenses,
    recentClients,
    charts
  });
}

async function chartData(year: number, filters: { clientId?: string; category?: string } = {}) {
  const rows = [];
  for (let month = 1; month <= 12; month += 1) {
    const { start, end } = monthRange(year, month);
    const totals = await totalsBetween(start, end, filters);
    rows.push({ month: start.toLocaleString('en', { month: 'short', timeZone: 'UTC' }), income: totals.income, expenses: totals.expenses, profit: totals.income - totals.expenses });
  }
  return rows;
}

export async function reports(req: Request, res: Response) {
  const year = Number(req.query.year ?? new Date().getFullYear());
  const month = req.query.month ? Number(req.query.month) : undefined;
  const filters = { clientId: req.query.clientId ? String(req.query.clientId) : undefined, category: req.query.category ? String(req.query.category) : undefined };
  const { start, end } = month ? monthRange(year, month) : { start: new Date(Date.UTC(year, 0, 1)), end: new Date(Date.UTC(year + 1, 0, 1)) };
  const whereDate = { date: { gte: start, lt: end } };
  const [totals, yearly, incomeByClient, expensesByCategory, charts] = await Promise.all([
    totalsBetween(start, end, filters),
    totalsBetween(new Date(Date.UTC(year, 0, 1)), new Date(Date.UTC(year + 1, 0, 1)), filters),
    prisma.income.groupBy({ by: ['clientId'], where: { ...whereDate, ...(req.query.clientId ? { clientId: String(req.query.clientId) } : {}) }, _sum: { amount: true }, orderBy: { _sum: { amount: 'desc' } }, take: 10 }),
    prisma.expense.groupBy({ by: ['category'], where: { ...whereDate, ...(req.query.category ? { category: String(req.query.category) as never } : {}) }, _sum: { amount: true }, orderBy: { _sum: { amount: 'desc' } } }),
    chartData(year, filters)
  ]);
  const clients = await prisma.client.findMany({ where: { id: { in: incomeByClient.map((item) => item.clientId) } } });
  const byClient = incomeByClient.map((item) => ({ client: clients.find((client) => client.id === item.clientId)?.name ?? 'Unknown', amount: money(item._sum.amount) }));
  return ok(res, 'Reports loaded', {
    summary: {
      monthlyIncome: totals.income,
      monthlyExpenses: totals.expenses,
      monthlyProfit: totals.income - totals.expenses,
      yearlyProfit: yearly.income - yearly.expenses,
      averageMonthlyIncome: yearly.income / 12,
      averageMonthlyExpenses: yearly.expenses / 12
    },
    incomeByClient: byClient,
    topPayingClients: byClient.slice(0, 5),
    expensesByCategory: expensesByCategory.map((item) => ({ category: item.category, amount: money(item._sum.amount) })),
    charts
  });
}
