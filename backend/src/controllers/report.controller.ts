import type { Request, Response } from 'express';
import type { Client, ExpenseCategory, Income, Expense, PaymentFrequency, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { monthRange } from '../utils/date.js';
import { ok } from '../utils/api.js';

const money = (value: unknown) => Number(value ?? 0);

async function totalsBetween(start: Date, end: Date, filters: { clientId?: string; category?: string } = {}) {
  const [income, expenses] = await Promise.all([
    prisma.income.findMany({
      where: {
        ...(filters.clientId ? { clientId: filters.clientId } : {}),
        OR: [{ frequency: { in: ['MONTHLY', 'YEARLY'] }, date: { lt: end } }, { frequency: 'ONE_TIME', date: { gte: start, lt: end } }]
      }
    }),
    prisma.expense.findMany({
      where: {
        ...(filters.category ? { category: filters.category as ExpenseCategory } : {}),
        OR: [{ frequency: { in: ['MONTHLY', 'YEARLY'] }, date: { lt: end } }, { frequency: 'ONE_TIME', date: { gte: start, lt: end } }]
      }
    })
  ]);
  return { income: sumForRange(income, start, end), expenses: sumForRange(expenses, start, end) };
}

function sumForRange(items: Array<Pick<Income | Expense, 'amount' | 'date' | 'frequency'>>, start: Date, end: Date) {
  return items.reduce((total, item) => total + money(item.amount) * occurrencesInRange(item.date, item.frequency, start, end), 0);
}

function occurrencesInRange(date: Date, frequency: PaymentFrequency, start: Date, end: Date) {
  if (frequency === 'ONE_TIME') return date >= start && date < end ? 1 : 0;

  let cursor = new Date(Date.UTC(Math.max(date.getUTCFullYear(), start.getUTCFullYear()), 0, 1));
  let count = 0;
  while (cursor < end) {
    const monthStart = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
    const isAnniversaryMonth = frequency === 'YEARLY' ? cursor.getUTCMonth() === date.getUTCMonth() : true;
    if (isAnniversaryMonth && monthEnd > start && monthStart < end && date < monthEnd) count += 1;
    cursor = monthEnd;
  }
  return count;
}

function expectedClientFees(clients: Array<Pick<Client, 'monthlyFee' | 'contractStartDate' | 'billingFrequency'>>, start: Date, end: Date) {
  return clients.reduce((total, client) => total + money(client.monthlyFee) * occurrencesInRange(client.contractStartDate, client.billingFrequency, start, end), 0);
}

export async function dashboard(req: Request, res: Response) {
  const { start, end } = monthRange();
  const totals = await totalsBetween(start, end);
  const incomeActiveInRange: Prisma.IncomeWhereInput = { OR: [{ frequency: { in: ['MONTHLY', 'YEARLY'] }, date: { lt: end } }, { frequency: 'ONE_TIME', date: { gte: start, lt: end } }] };
  const expenseActiveInRange: Prisma.ExpenseWhereInput = { OR: [{ frequency: { in: ['MONTHLY', 'YEARLY'] }, date: { lt: end } }, { frequency: 'ONE_TIME', date: { gte: start, lt: end } }] };
  const [activeClients, recentIncome, recentExpenses, recentClients, billableClients, monthIncome, monthExpenses, advances] = await Promise.all([
    prisma.client.count({ where: { status: 'ACTIVE' } }),
    prisma.income.findMany({ include: { client: true }, orderBy: { date: 'desc' }, take: 5 }),
    prisma.expense.findMany({ orderBy: { date: 'desc' }, take: 5 }),
    prisma.client.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
    prisma.client.findMany({ where: { status: 'ACTIVE', contractStartDate: { lt: end } }, select: { id: true, name: true, monthlyFee: true, contractStartDate: true, billingFrequency: true } }),
    prisma.income.findMany({ where: incomeActiveInRange, include: { client: true } }),
    prisma.expense.findMany({ where: expenseActiveInRange }),
    prisma.ownerAdvance.findMany({ where: { status: 'OPEN' }, include: { repayments: true } })
  ]);
  const collected = totals.income;
  const expectedRevenue = expectedClientFees(billableClients, start, end);
  const pending = Math.max(0, expectedRevenue - collected);
  const collectionRate = expectedRevenue > 0 ? Math.min(100, (collected / expectedRevenue) * 100) : 100;
  const profitMargin = collected > 0 ? ((collected - totals.expenses) / collected) * 100 : 0;
  const topClients = totalBy(monthIncome, (item) => item.client?.name ?? 'Unknown', start, end).sort((a, b) => b.amount - a.amount).slice(0, 5).map((item) => ({ client: item.key, amount: item.amount }));
  const topExpenseCategories = totalBy(monthExpenses, (item) => item.category, start, end).sort((a, b) => b.amount - a.amount).slice(0, 5).map((item) => ({ category: item.key, amount: item.amount }));
  const ownerAdvanceOutstanding = advances.reduce((total, advance) => {
    const repaid = advance.repayments.reduce((sum, repayment) => sum + money(repayment.amount), 0);
    return total + Math.max(0, money(advance.amount) - repaid);
  }, 0);
  const attention = [
    ...(pending > 0 ? [`${money(pending).toLocaleString('en-US')} still pending this month`] : []),
    ...(ownerAdvanceOutstanding > 0 ? [`${money(ownerAdvanceOutstanding).toLocaleString('en-US')} owed back to owner`] : []),
    ...(totals.expenses > collected ? ['Expenses are higher than collected income this month'] : []),
    ...(activeClients === 0 ? ['No active clients yet'] : [])
  ];
  const charts = await chartData(new Date().getFullYear());
  return ok(res, 'Dashboard loaded', {
    cards: { totalIncome: totals.income, totalExpenses: totals.expenses, netProfit: totals.income - totals.expenses, activeClients, collected, pending, expectedRevenue, collectionRate, profitMargin, ownerAdvanceOutstanding },
    topClients,
    topExpenseCategories,
    attention,
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
  const incomeWhere: Prisma.IncomeWhereInput = {
    ...(filters.clientId ? { clientId: filters.clientId } : {}),
    OR: [{ frequency: { in: ['MONTHLY', 'YEARLY'] }, date: { lt: end } }, { frequency: 'ONE_TIME', date: { gte: start, lt: end } }]
  };
  const expenseWhere: Prisma.ExpenseWhereInput = {
    ...(filters.category ? { category: filters.category as ExpenseCategory } : {}),
    OR: [{ frequency: { in: ['MONTHLY', 'YEARLY'] }, date: { lt: end } }, { frequency: 'ONE_TIME', date: { gte: start, lt: end } }]
  };
  const [totals, yearly, incomeRows, expenseRows, charts] = await Promise.all([
    totalsBetween(start, end, filters),
    totalsBetween(new Date(Date.UTC(year, 0, 1)), new Date(Date.UTC(year + 1, 0, 1)), filters),
    prisma.income.findMany({ where: incomeWhere }),
    prisma.expense.findMany({ where: expenseWhere }),
    chartData(year, filters)
  ]);
  const incomeByClient = totalBy(incomeRows, (item) => item.clientId, start, end).sort((a, b) => b.amount - a.amount).slice(0, 10);
  const expensesByCategory = totalBy(expenseRows, (item) => item.category, start, end).sort((a, b) => b.amount - a.amount);
  const clients = await prisma.client.findMany({ where: { id: { in: incomeByClient.map((item) => item.key) } } });
  const byClient = incomeByClient.map((item) => ({ client: clients.find((client) => client.id === item.key)?.name ?? 'Unknown', amount: item.amount }));
  return ok(res, 'Reports loaded', {
    summary: {
      monthlyIncome: totals.income,
      monthlyExpenses: totals.expenses,
      monthlyProfit: totals.income - totals.expenses,
      yearlyProfit: yearly.income - yearly.expenses,
      profitMargin: totals.income > 0 ? ((totals.income - totals.expenses) / totals.income) * 100 : 0,
      averageMonthlyIncome: yearly.income / 12,
      averageMonthlyExpenses: yearly.expenses / 12
    },
    incomeByClient: byClient,
    topPayingClients: byClient.slice(0, 5),
    expensesByCategory: expensesByCategory.map((item) => ({ category: item.key, amount: item.amount })),
    charts,
    monthlyBreakdown: charts.map((item) => ({ ...item, margin: item.income > 0 ? (item.profit / item.income) * 100 : 0 }))
  });
}

function totalBy<T extends Pick<Income | Expense, 'amount' | 'date' | 'frequency'>>(items: T[], getKey: (item: T) => string, start: Date, end: Date) {
  const totals = new Map<string, number>();
  for (const item of items) {
    const key = getKey(item);
    totals.set(key, (totals.get(key) ?? 0) + money(item.amount) * occurrencesInRange(item.date, item.frequency, start, end));
  }
  return Array.from(totals, ([key, amount]) => ({ key, amount }));
}
