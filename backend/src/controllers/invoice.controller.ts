import type { Request, Response } from 'express';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { fail, ok, pagination } from '../utils/api.js';
import { recordActivity } from '../services/activity.service.js';
import { generateInvoicesForPeriod } from '../services/invoice-generation.service.js';
import { renderInvoicePdf } from '../services/invoice-pdf.service.js';

const money = (value: unknown) => Number(value ?? 0);

function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value ?? '';
}

function computedStatus(invoice: { status: InvoiceStatus; amount: unknown; paidAmount: unknown; dueDate: Date }): InvoiceStatus {
  if (invoice.status === 'CANCELLED' || invoice.status === 'DRAFT') return invoice.status;
  const amount = money(invoice.amount);
  const paid = money(invoice.paidAmount);
  if (paid >= amount && amount > 0) return 'PAID';
  if (paid > 0) return 'PARTIAL';
  if (invoice.dueDate < new Date()) return 'OVERDUE';
  return invoice.status;
}

async function refreshInvoice(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: { payments: true } });
  if (!invoice) return null;
  const paidAmount = invoice.payments.reduce((total, payment) => total + money(payment.amount), 0);
  const status = computedStatus({ ...invoice, paidAmount });
  return prisma.invoice.update({ where: { id: invoiceId }, data: { paidAmount, status }, include: { client: true, payments: true } });
}

export async function listInvoices(req: Request, res: Response) {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 10);
  const search = String(req.query.search ?? '');
  const where: Prisma.InvoiceWhereInput = {
    ...(search && {
      OR: [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { client: { name: { contains: search, mode: 'insensitive' } } }
      ]
    }),
    ...(req.query.clientId ? { clientId: String(req.query.clientId) } : {}),
    ...(req.query.status ? { status: String(req.query.status) as InvoiceStatus } : {})
  };
  const [items, total] = await Promise.all([
    prisma.invoice.findMany({ where, include: { client: true, payments: true }, orderBy: { dueDate: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.invoice.count({ where })
  ]);
  return ok(res, 'Invoices loaded', { items: items.map((item) => ({ ...item, computedStatus: computedStatus(item), outstanding: Math.max(0, money(item.amount) - money(item.paidAmount)) })), pagination: pagination(page, limit, total) });
}

export async function createInvoice(req: Request, res: Response) {
  const invoice = await prisma.invoice.create({ data: req.body, include: { client: true, payments: true } });
  await recordActivity({ action: 'CREATED', entityType: 'INVOICE', entityId: invoice.id, title: `Invoice ${invoice.invoiceNumber} created`, details: invoice.client.name });
  return ok(res, 'Invoice created', { ...invoice, computedStatus: computedStatus(invoice), outstanding: money(invoice.amount) }, 201);
}

export async function generateInvoices(req: Request, res: Response) {
  const now = new Date();
  const year = Number(req.body.year ?? now.getUTCFullYear());
  const month = Number(req.body.month ?? now.getUTCMonth() + 1);
  if (month < 1 || month > 12) return fail(res, 'Month must be between 1 and 12', 422);
  const result = await generateInvoicesForPeriod(year, month);
  return ok(res, 'Invoices generated', {
    period: result.period,
    created: result.created.length,
    skipped: result.skipped.length,
    invoices: result.created
  });
}

export async function downloadInvoicePdf(req: Request, res: Response) {
  const invoice = await prisma.invoice.findUnique({ where: { id: param(req.params.id) }, include: { client: true } });
  if (!invoice) return fail(res, 'Invoice not found', 404);
  const pdf = renderInvoicePdf(invoice);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`);
  return res.send(pdf);
}

export async function updateInvoice(req: Request, res: Response) {
  const invoice = await prisma.invoice.update({ where: { id: param(req.params.id) }, data: req.body, include: { client: true, payments: true } });
  const refreshed = await refreshInvoice(invoice.id);
  await recordActivity({ action: 'UPDATED', entityType: 'INVOICE', entityId: invoice.id, title: `Invoice ${invoice.invoiceNumber} updated`, details: invoice.client.name });
  return ok(res, 'Invoice updated', refreshed ?? invoice);
}

export async function deleteInvoice(req: Request, res: Response) {
  const invoice = await prisma.invoice.findUnique({ where: { id: param(req.params.id) } });
  await prisma.invoice.delete({ where: { id: param(req.params.id) } }).catch(() => null);
  await recordActivity({ action: 'DELETED', entityType: 'INVOICE', entityId: invoice?.id, title: `Invoice ${invoice?.invoiceNumber ?? ''} deleted`.trim() });
  return ok(res, 'Invoice deleted');
}

export async function addInvoicePayment(req: Request, res: Response) {
  const invoiceId = param(req.params.id);
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) return fail(res, 'Invoice not found', 404);
  const payment = await prisma.invoicePayment.create({ data: { ...req.body, invoiceId } });
  await prisma.income.create({
    data: {
      clientId: invoice.clientId,
      invoiceId,
      amount: req.body.amount,
      currency: req.body.currency,
      date: req.body.date,
      paymentMethod: req.body.paymentMethod,
      frequency: 'ONE_TIME',
      referenceNumber: req.body.referenceNumber,
      invoiceNumber: invoice.invoiceNumber,
      description: `Payment for invoice ${invoice.invoiceNumber}`
    }
  });
  const updated = await refreshInvoice(invoiceId);
  await recordActivity({ action: 'PAID', entityType: 'INVOICE', entityId: invoiceId, title: `Payment recorded for ${invoice.invoiceNumber}`, details: String(req.body.amount) });
  return ok(res, 'Payment recorded', { payment, invoice: updated }, 201);
}
