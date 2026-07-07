import { InvoiceStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { recordActivity } from './activity.service.js';

const money = (value: unknown) => Number(value ?? 0);

function invoicePeriod(invoice: { issueDate: Date; billingPeriodStart?: Date | null; billingPeriodEnd?: Date | null }) {
  const start = invoice.billingPeriodStart ?? new Date(Date.UTC(invoice.issueDate.getUTCFullYear(), invoice.issueDate.getUTCMonth(), 1));
  const end = invoice.billingPeriodEnd ?? new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  return { start, end };
}

function computedStatus(invoice: { status: InvoiceStatus; amount: unknown; paidAmount: unknown; dueDate: Date }): InvoiceStatus {
  if (invoice.status === 'CANCELLED' || invoice.status === 'DRAFT') return invoice.status;
  if (money(invoice.paidAmount) >= money(invoice.amount) && money(invoice.amount) > 0) return 'PAID';
  if (money(invoice.paidAmount) > 0) return 'PARTIAL';
  if (invoice.dueDate < new Date()) return 'OVERDUE';
  return invoice.status;
}

export async function reconcileInvoiceIncome() {
  const invoices = await prisma.invoice.findMany({ include: { payments: true, income: true }, orderBy: { issueDate: 'asc' } });
  const linkedIncomeIds = new Set<string>();
  let linkedExistingIncome = 0;
  let deletedDuplicateIncome = 0;
  let updatedInvoices = 0;

  for (const invoice of invoices) {
    const { start, end } = invoicePeriod(invoice);
    const unlinkedIncome = await prisma.income.findMany({
      where: {
        clientId: invoice.clientId,
        invoiceId: null,
        currency: invoice.currency,
        date: { gte: start, lt: end }
      },
      orderBy: { date: 'asc' }
    });

    const matchingIncome = unlinkedIncome.find((item) => !linkedIncomeIds.has(item.id) && Math.abs(money(item.amount) - money(invoice.amount)) < 0.01);
    if (matchingIncome) {
      await prisma.income.update({
        where: { id: matchingIncome.id },
        data: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, description: matchingIncome.description ?? `Payment for invoice ${invoice.invoiceNumber}` }
      });
      linkedIncomeIds.add(matchingIncome.id);
      linkedExistingIncome += 1;
    }

    const linkedIncome = await prisma.income.findMany({ where: { invoiceId: invoice.id }, orderBy: { createdAt: 'asc' } });
    const duplicateGeneratedIncome = linkedIncome.filter((item) => item.description === `Payment for invoice ${invoice.invoiceNumber}`);
    const duplicatesToDelete = duplicateGeneratedIncome.filter((item, index) => {
      const sameAmountIncome = linkedIncome.filter((other) => Math.abs(money(other.amount) - money(item.amount)) < 0.01);
      const hasManualMatch = sameAmountIncome.some((other) => other.id !== item.id && other.description !== `Payment for invoice ${invoice.invoiceNumber}`);
      const earlierGeneratedMatch = duplicateGeneratedIncome.findIndex((other) => Math.abs(money(other.amount) - money(item.amount)) < 0.01) < index;
      return hasManualMatch || earlierGeneratedMatch;
    });
    for (const item of duplicatesToDelete) {
      await prisma.income.delete({ where: { id: item.id } }).catch(() => null);
      deletedDuplicateIncome += 1;
    }

    const paymentsTotal = invoice.payments.reduce((total, payment) => total + money(payment.amount), 0);
    const incomeTotal = (await prisma.income.findMany({ where: { invoiceId: invoice.id } })).reduce((total, income) => total + money(income.amount), 0);
    const paidAmount = new Prisma.Decimal(Math.max(paymentsTotal, incomeTotal));
    const status = computedStatus({ ...invoice, paidAmount });
    await prisma.invoice.update({ where: { id: invoice.id }, data: { paidAmount, status } });
    updatedInvoices += 1;
  }

  await recordActivity({ action: 'UPDATED', entityType: 'INVOICE', title: 'Invoice income reconciliation completed', details: `${linkedExistingIncome} linked, ${deletedDuplicateIncome} duplicates removed` });
  return { invoicesChecked: invoices.length, linkedExistingIncome, deletedDuplicateIncome, updatedInvoices };
}
