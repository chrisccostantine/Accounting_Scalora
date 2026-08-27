import type { Request, Response } from 'express';
import { Prisma, QuoteStatus } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { recordActivity } from '../services/activity.service.js';
import { renderQuotePdf } from '../services/quote-pdf.service.js';
import { fail, ok, pagination } from '../utils/api.js';

const param = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value ?? '';
const safeFilename = (value: string) => value.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').replace(/\s+/g, ' ').trim() || 'Quote';

function totals<T extends { items: { quantity: unknown; unitPrice: unknown }[]; discount: unknown; taxRate: unknown }>(quote: T) {
  const subtotal = quote.items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitPrice), 0);
  const discount = Math.min(Number(quote.discount), subtotal);
  const tax = (subtotal - discount) * Number(quote.taxRate) / 100;
  return { ...quote, subtotal, tax, total: subtotal - discount + tax };
}

export async function listQuotes(req: Request, res: Response) {
  const page = Number(req.query.page ?? 1);
  const limit = Math.min(100, Number(req.query.limit ?? 25));
  const search = String(req.query.search ?? '');
  const where: Prisma.QuoteWhereInput = {
    ...(search ? { OR: [{ quoteNumber: { contains: search, mode: 'insensitive' } }, { client: { name: { contains: search, mode: 'insensitive' } } }] } : {}),
    ...(req.query.status ? { status: String(req.query.status) as QuoteStatus } : {})
  };
  const [items, total] = await Promise.all([
    prisma.quote.findMany({ where, include: { client: true, items: { orderBy: { position: 'asc' } } }, orderBy: { issueDate: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.quote.count({ where })
  ]);
  return ok(res, 'Quotes loaded', { items: items.map(totals), pagination: pagination(page, limit, total) });
}

export async function createQuote(req: Request, res: Response) {
  const { items, ...data } = req.body;
  const quote = await prisma.quote.create({ data: { ...data, items: { create: items.map((item: object, position: number) => ({ ...item, position })) } }, include: { client: true, items: { orderBy: { position: 'asc' } } } });
  await recordActivity({ action: 'CREATED', entityType: 'QUOTE', entityId: quote.id, title: `Quote ${quote.quoteNumber} created`, details: quote.client.name });
  return ok(res, 'Quote created', totals(quote), 201);
}

export async function updateQuote(req: Request, res: Response) {
  const id = param(req.params.id);
  const { items, ...data } = req.body;
  const quote = await prisma.$transaction(async (tx) => {
    await tx.quoteItem.deleteMany({ where: { quoteId: id } });
    return tx.quote.update({ where: { id }, data: { ...data, items: { create: items.map((item: object, position: number) => ({ ...item, position })) } }, include: { client: true, items: { orderBy: { position: 'asc' } } } });
  });
  await recordActivity({ action: 'UPDATED', entityType: 'QUOTE', entityId: quote.id, title: `Quote ${quote.quoteNumber} updated`, details: quote.client.name });
  return ok(res, 'Quote updated', totals(quote));
}

export async function deleteQuote(req: Request, res: Response) {
  const quote = await prisma.quote.delete({ where: { id: param(req.params.id) } }).catch(() => null);
  if (!quote) return fail(res, 'Quote not found', 404);
  await recordActivity({ action: 'DELETED', entityType: 'QUOTE', entityId: quote.id, title: `Quote ${quote.quoteNumber} deleted` });
  return ok(res, 'Quote deleted');
}

export async function downloadQuotePdf(req: Request, res: Response) {
  const quote = await prisma.quote.findUnique({ where: { id: param(req.params.id) }, include: { client: true, items: { orderBy: { position: 'asc' } } } });
  if (!quote) return fail(res, 'Quote not found', 404);
  const filename = safeFilename(`${quote.quoteNumber} - ${quote.client.company || quote.client.name}.pdf`);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('X-Quote-Filename', filename);
  return res.send(renderQuotePdf(quote));
}
