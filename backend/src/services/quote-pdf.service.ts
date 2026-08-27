import type { Client, Quote, QuoteItem } from '@prisma/client';
import { deflateSync } from 'node:zlib';
import { loadLogo, pdfColor, pdfDate, pdfLine, pdfMoney, pdfText, type PngImage } from './invoice-pdf.service.js';

type PdfQuote = Quote & { client: Client; items: QuoteItem[] };
type PdfObject = string | Buffer;

function truncate(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length - 3)}...` : value;
}

function assemble(content: string, logo: PngImage | null) {
  const resources = logo ? '<< /Font << /F1 4 0 R >> /XObject << /Logo 6 0 R >> >>' : '<< /Font << /F1 4 0 R >> >>';
  const objects: PdfObject[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources ${resources} /Contents 5 0 R >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`
  ];
  if (logo) {
    const imageData = deflateSync(logo.rgb);
    objects.push(Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode${logo.alpha ? ' /SMask 7 0 R' : ''} /Length ${imageData.length} >>\nstream\n`), imageData, Buffer.from('\nendstream')]));
    if (logo.alpha) {
      const alphaData = deflateSync(logo.alpha);
      objects.push(Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length ${alphaData.length} >>\nstream\n`), alphaData, Buffer.from('\nendstream')]));
    }
  }
  let pdf = Buffer.from('%PDF-1.4\n');
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf = Buffer.concat([pdf, Buffer.from(`${index + 1} 0 obj\n`), Buffer.isBuffer(object) ? object : Buffer.from(object), Buffer.from('\nendobj\n')]);
  });
  const xref = pdf.length;
  let trailer = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i += 1) trailer += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  trailer += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.concat([pdf, Buffer.from(trailer)]);
}

export function renderQuotePdf(quote: PdfQuote) {
  const logo = loadLogo();
  const subtotal = quote.items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitPrice), 0);
  const discount = Math.min(Number(quote.discount), subtotal);
  const tax = (subtotal - discount) * Number(quote.taxRate) / 100;
  const total = subtotal - discount + tax;
  const businessName = quote.client.company || quote.client.name;
  const rows = quote.items.slice(0, 8).flatMap((item, index) => {
    const y = 526 - index * 28;
    return [
      pdfText(62, y, 10, truncate(item.description, 45)),
      pdfText(350, y, 10, String(Number(item.quantity))),
      pdfText(408, y, 10, pdfMoney(item.unitPrice, quote.currency)),
      pdfText(492, y, 10, pdfMoney(Number(item.quantity) * Number(item.unitPrice), quote.currency))
    ];
  });
  const totalsY = 500 - quote.items.slice(0, 8).length * 28;
  const content = [
    logo ? 'q 124 0 0 62 48 742 cm /Logo Do Q' : '0.12 0.38 0.92 rg 48 746 44 44 re f',
    ...(logo ? [] : ['1 1 1 rg', pdfText(61, 761, 24, 'S')]),
    pdfColor(0, 0, 0), pdfText(396, 770, 27, 'PRICE QUOTE'),
    pdfColor(0.35, 0.39, 0.48), pdfText(430, 748, 10, quote.quoteNumber),
    pdfColor(0, 0, 0), pdfLine(48, 724, 548, 724),
    pdfColor(0.35, 0.39, 0.48), pdfText(48, 690, 10, 'PREPARED FOR'),
    pdfColor(0, 0, 0), pdfText(48, 670, 18, truncate(businessName, 36)),
    ...(quote.client.company && quote.client.name !== quote.client.company ? [pdfColor(0.35, 0.39, 0.48), pdfText(48, 652, 10, quote.client.name)] : []),
    pdfColor(0.35, 0.39, 0.48), pdfText(360, 690, 10, 'QUOTE DETAILS'),
    pdfColor(0, 0, 0), pdfText(360, 670, 10, `Issue Date: ${pdfDate(quote.issueDate)}`),
    pdfText(360, 654, 10, `Valid Until: ${pdfDate(quote.validUntil)}`), pdfText(360, 638, 10, `Status: ${quote.status}`),
    '0.95 0.97 1 rg 48 555 500 36 re f', pdfColor(0.12, 0.16, 0.24),
    pdfText(62, 569, 10, 'Description'), pdfText(350, 569, 10, 'Qty'), pdfText(408, 569, 10, 'Unit Price'), pdfText(492, 569, 10, 'Total'),
    '0.75 0.79 0.86 RG', pdfLine(48, 555, 548, 555), pdfColor(0, 0, 0), ...rows,
    '0.75 0.79 0.86 RG', pdfLine(48, totalsY + 12, 548, totalsY + 12), pdfColor(0, 0, 0),
    pdfText(350, totalsY - 12, 10, 'Subtotal'), pdfText(458, totalsY - 12, 10, pdfMoney(subtotal, quote.currency)),
    ...(discount > 0 ? [pdfText(350, totalsY - 32, 10, 'Discount'), pdfText(458, totalsY - 32, 10, `-${pdfMoney(discount, quote.currency)}`)] : []),
    ...(Number(quote.taxRate) > 0 ? [pdfText(350, totalsY - 52, 10, `Tax (${Number(quote.taxRate)}%)`), pdfText(458, totalsY - 52, 10, pdfMoney(tax, quote.currency))] : []),
    pdfColor(0.1, 0.37, 0.92), pdfText(350, totalsY - 78, 14, 'TOTAL'), pdfText(458, totalsY - 78, 14, pdfMoney(total, quote.currency)),
    pdfColor(0.35, 0.39, 0.48), ...(quote.notes ? [pdfText(48, 100, 9, `Notes: ${truncate(quote.notes, 85)}`)] : []),
    ...(quote.terms ? [pdfText(48, 82, 9, `Terms: ${truncate(quote.terms, 85)}`)] : [])
  ].join('\n');
  return assemble(content, logo);
}
