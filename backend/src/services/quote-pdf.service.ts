import type { Client, Quote, QuoteItem } from '@prisma/client';
import { deflateSync } from 'node:zlib';
import { loadLogo, pdfColor, pdfDate, pdfLine, pdfMoney, pdfText, wrapPdfText, type PngImage } from './invoice-pdf.service.js';

type PdfQuote = Quote & { client: Client; items: QuoteItem[] };
type PdfObject = string | Buffer;

function truncate(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length - 3)}...` : value;
}

function assemble(contents: string[], logo: PngImage | null) {
  const pageCount = contents.length;
  const fontReference = 3 + pageCount;
  const firstContentReference = fontReference + 1;
  const logoReference = firstContentReference + pageCount;
  const resources = logo
    ? `<< /Font << /F1 ${fontReference} 0 R >> /XObject << /Logo ${logoReference} 0 R >> >>`
    : `<< /Font << /F1 ${fontReference} 0 R >> >>`;
  const pageReferences = contents.map((_, index) => `${index + 3} 0 R`).join(' ');
  const objects: PdfObject[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pageReferences}] /Count ${pageCount} >>`,
    ...contents.map((_, index) => `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources ${resources} /Contents ${firstContentReference + index} 0 R >>`),
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ...contents.map((content) => `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`)
  ];
  if (logo) {
    const imageData = deflateSync(logo.rgb);
    objects.push(Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode${logo.alpha ? ` /SMask ${logoReference + 1} 0 R` : ''} /Length ${imageData.length} >>\nstream\n`), imageData, Buffer.from('\nendstream')]));
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
  const mainContent = [
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
    pdfColor(0.1, 0.37, 0.92), pdfText(350, totalsY - 78, 14, 'TOTAL'), pdfText(458, totalsY - 78, 14, pdfMoney(total, quote.currency))
  ];

  const noteLines = quote.notes ? wrapPdfText(`Notes: ${quote.notes}`, 9, 500).map((value) => ({ value, color: pdfColor(0.82, 0.08, 0.12) })) : [];
  const termLines = quote.terms ? wrapPdfText(`Terms: ${quote.terms}`, 9, 500).map((value) => ({ value, color: pdfColor(0.35, 0.39, 0.48) })) : [];
  const remainingLines = [...noteLines, ...(noteLines.length && termLines.length ? [{ value: '', color: '' }] : []), ...termLines];
  const pages: string[] = [];
  let firstPage = true;

  while (firstPage || remainingLines.length) {
    const startY = firstPage ? totalsY - 116 : 720;
    const availableLines = Math.max(1, Math.floor((startY - 42) / 12) + 1);
    const pageLines = remainingLines.splice(0, availableLines);
    const pageHeader = firstPage ? mainContent : [
      logo ? 'q 124 0 0 62 48 742 cm /Logo Do Q' : '0.12 0.38 0.92 rg 48 746 44 44 re f',
      ...(logo ? [] : ['1 1 1 rg', pdfText(61, 761, 24, 'S')]),
      pdfColor(0, 0, 0), pdfText(326, 770, 20, 'PRICE QUOTE - CONTINUED'),
      pdfColor(0.35, 0.39, 0.48), pdfText(430, 748, 10, quote.quoteNumber),
      pdfColor(0, 0, 0), pdfLine(48, 736, 548, 736)
    ];
    const renderedLines = pageLines.flatMap((line, index) => line.value
      ? [line.color, pdfText(48, startY - index * 12, 9, line.value)]
      : []);
    pages.push([...pageHeader, ...renderedLines].join('\n'));
    firstPage = false;
  }

  return assemble(pages, logo);
}
