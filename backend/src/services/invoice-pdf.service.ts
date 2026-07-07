import type { Client, Invoice } from '@prisma/client';

type PdfInvoice = Invoice & { client: Client };

function money(value: unknown, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value ?? 0));
}

function date(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : '-';
}

function escapePdf(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function text(x: number, y: number, size: number, value: string) {
  return `BT /F1 ${size} Tf ${x} ${y} Td (${escapePdf(value)}) Tj ET`;
}

function line(x1: number, y1: number, x2: number, y2: number) {
  return `${x1} ${y1} m ${x2} ${y2} l S`;
}

export function renderInvoicePdf(invoice: PdfInvoice) {
  const outstanding = Math.max(0, Number(invoice.amount) - Number(invoice.paidAmount));
  const service = invoice.client.service.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
  const period = invoice.billingPeriodStart && invoice.billingPeriodEnd ? `${date(invoice.billingPeriodStart)} to ${date(new Date(invoice.billingPeriodEnd.getTime() - 1))}` : '-';
  const content = [
    '0.12 0.38 0.92 rg 48 746 44 44 re f',
    '1 1 1 rg',
    text(61, 761, 24, 'S'),
    '0 0 0 rg',
    text(104, 772, 24, 'Scalora'),
    text(104, 752, 10, 'Accounting Invoice'),
    text(430, 770, 26, 'INVOICE'),
    text(430, 748, 10, invoice.invoiceNumber),
    line(48, 728, 548, 728),
    text(48, 696, 11, 'Bill To'),
    text(48, 678, 16, invoice.client.name),
    text(48, 660, 10, invoice.client.company ?? ''),
    text(48, 644, 10, invoice.client.email ?? ''),
    text(48, 628, 10, invoice.client.phone ?? ''),
    text(360, 696, 11, 'Invoice Details'),
    text(360, 678, 10, `Issue Date: ${date(invoice.issueDate)}`),
    text(360, 662, 10, `Due Date: ${date(invoice.dueDate)}`),
    text(360, 646, 10, `Status: ${invoice.status}`),
    text(360, 630, 10, `Period: ${period}`),
    '0.94 0.96 1 rg 48 555 500 34 re f',
    '0 0 0 rg',
    text(62, 568, 11, 'Description'),
    text(372, 568, 11, 'Amount'),
    line(48, 555, 548, 555),
    text(62, 526, 11, invoice.description ?? service),
    text(372, 526, 11, money(invoice.amount, invoice.currency)),
    line(48, 504, 548, 504),
    text(338, 466, 11, 'Subtotal'),
    text(438, 466, 11, money(invoice.amount, invoice.currency)),
    text(338, 444, 11, 'Paid'),
    text(438, 444, 11, money(invoice.paidAmount, invoice.currency)),
    '0.12 0.38 0.92 rg',
    text(338, 414, 14, 'Balance Due'),
    text(438, 414, 14, money(outstanding, invoice.currency)),
    '0 0 0 rg',
    text(48, 360, 10, invoice.notes ?? 'Thank you for your business.'),
    text(48, 82, 9, 'Scalora - Internal accounting document')
  ].join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i += 1) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}
