import type { Client, Quote, QuoteItem } from '@prisma/client';
import fontkit from '@pdf-lib/fontkit';
import { drawArabicText, measureArabicText } from 'arabic-bidi-shaper/pdf-lib';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, rgb, type PDFImage, type PDFFont, type PDFPage } from 'pdf-lib';
import { pdfDate, pdfMoney } from './invoice-pdf.service.js';

type PdfQuote = Quote & { client: Client; items: QuoteItem[] };
type FlowLine = { value: string; color: ReturnType<typeof rgb> };

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const LEFT = 48;
const CONTENT_WIDTH = 500;
const BOTTOM_MARGIN = 42;
const RTL_PATTERN = /[\u0590-\u08FF\uFB1D-\uFDFD\uFE70-\uFEFC]/;

function truncate(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length - 3)}...` : value;
}

function isRtl(value: string) {
  const firstStrong = value.match(/[A-Za-z\u0590-\u08FF\uFB1D-\uFDFD\uFE70-\uFEFC]/)?.[0];
  return Boolean(firstStrong && RTL_PATTERN.test(firstStrong));
}

function drawText(page: PDFPage, font: PDFFont, value: string, x: number, y: number, size: number, width = CONTENT_WIDTH, color = rgb(0, 0, 0)) {
  const rtl = isRtl(value);
  drawArabicText(page, value, {
    font,
    size,
    x: rtl ? x + width : x,
    y,
    color,
    align: rtl ? 'right' : 'left'
  });
}

function wrapText(value: string, font: PDFFont, size: number, maxWidth: number) {
  return value.replace(/\r\n?/g, '\n').split('\n').flatMap((paragraph) => {
    if (!paragraph) return [''];
    const words = paragraph.replace(/\t/g, '    ').split(/\s+/);
    const lines: string[] = [];
    let line = '';

    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (measureArabicText(candidate, font, size) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      line = '';

      let fragment = '';
      for (const character of word) {
        if (fragment && measureArabicText(`${fragment}${character}`, font, size) > maxWidth) {
          lines.push(fragment);
          fragment = character;
        } else {
          fragment += character;
        }
      }
      line = fragment;
    }

    if (line) lines.push(line);
    return lines;
  });
}

function drawHeader(page: PDFPage, font: PDFFont, quote: PdfQuote, logo: PDFImage | null, continued = false) {
  if (logo) {
    page.drawImage(logo, { x: LEFT, y: 742, width: 124, height: 62 });
  } else {
    page.drawRectangle({ x: LEFT, y: 746, width: 44, height: 44, color: rgb(0.12, 0.38, 0.92) });
    drawText(page, font, 'S', 61, 761, 24, 20, rgb(1, 1, 1));
  }

  drawText(page, font, continued ? 'PRICE QUOTE - CONTINUED' : 'PRICE QUOTE', continued ? 326 : 396, 770, continued ? 20 : 27, continued ? 222 : 152);
  drawText(page, font, quote.quoteNumber, 430, 748, 10, 118, rgb(0.35, 0.39, 0.48));
  page.drawLine({ start: { x: LEFT, y: 724 }, end: { x: 548, y: 724 }, thickness: 1, color: rgb(0, 0, 0) });
}

function addContinuationPage(document: PDFDocument, font: PDFFont, quote: PdfQuote, logo: PDFImage | null) {
  const page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  drawHeader(page, font, quote, logo, true);
  return page;
}

export async function renderQuotePdf(quote: PdfQuote) {
  const serviceDirectory = dirname(fileURLToPath(import.meta.url));
  const bundledAssetDirectory = join(serviceDirectory, '../assets');
  const assetDirectory = existsSync(join(bundledAssetDirectory, 'DejaVuSans.ttf'))
    ? bundledAssetDirectory
    : join(serviceDirectory, '../../src/assets');
  const logoPath = join(assetDirectory, 'scalora-logo.png');

  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const font = await document.embedFont(readFileSync(join(assetDirectory, 'DejaVuSans.ttf')), { subset: true });
  const logo = existsSync(logoPath) ? await document.embedPng(readFileSync(logoPath)) : null;
  let page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  const subtotal = quote.items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitPrice), 0);
  const discount = Math.min(Number(quote.discount), subtotal);
  const tax = (subtotal - discount) * Number(quote.taxRate) / 100;
  const total = subtotal - discount + tax;
  const businessName = quote.client.company || quote.client.name;
  const visibleItems = quote.items.slice(0, 8);
  const muted = rgb(0.35, 0.39, 0.48);

  drawHeader(page, font, quote, logo);
  drawText(page, font, 'PREPARED FOR', LEFT, 690, 10, 260, muted);
  drawText(page, font, truncate(businessName, 36), LEFT, 670, 18, 260);
  if (quote.client.company && quote.client.name !== quote.client.company) {
    drawText(page, font, quote.client.name, LEFT, 652, 10, 260, muted);
  }

  drawText(page, font, 'QUOTE DETAILS', 360, 690, 10, 188, muted);
  drawText(page, font, `Issue Date: ${pdfDate(quote.issueDate)}`, 360, 670, 10, 188);
  drawText(page, font, `Valid Until: ${pdfDate(quote.validUntil)}`, 360, 654, 10, 188);
  drawText(page, font, `Status: ${quote.status}`, 360, 638, 10, 188);

  page.drawRectangle({ x: LEFT, y: 555, width: CONTENT_WIDTH, height: 36, color: rgb(0.95, 0.97, 1) });
  const heading = rgb(0.12, 0.16, 0.24);
  drawText(page, font, 'Description', 62, 569, 10, 270, heading);
  drawText(page, font, 'Qty', 350, 569, 10, 45, heading);
  drawText(page, font, 'Unit Price', 408, 569, 10, 75, heading);
  drawText(page, font, 'Total', 492, 569, 10, 56, heading);
  page.drawLine({ start: { x: LEFT, y: 555 }, end: { x: 548, y: 555 }, thickness: 1, color: rgb(0.75, 0.79, 0.86) });

  visibleItems.forEach((item, index) => {
    const y = 526 - index * 28;
    drawText(page, font, truncate(item.description, 45), 62, y, 10, 270);
    drawText(page, font, String(Number(item.quantity)), 350, y, 10, 45);
    drawText(page, font, pdfMoney(item.unitPrice, quote.currency), 408, y, 10, 75);
    drawText(page, font, pdfMoney(Number(item.quantity) * Number(item.unitPrice), quote.currency), 492, y, 10, 56);
  });

  const totalsY = 500 - visibleItems.length * 28;
  page.drawLine({ start: { x: LEFT, y: totalsY + 12 }, end: { x: 548, y: totalsY + 12 }, thickness: 1, color: rgb(0.75, 0.79, 0.86) });
  drawText(page, font, 'Subtotal', 350, totalsY - 12, 10, 100);
  drawText(page, font, pdfMoney(subtotal, quote.currency), 458, totalsY - 12, 10, 90);
  if (discount > 0) {
    drawText(page, font, 'Discount', 350, totalsY - 32, 10, 100);
    drawText(page, font, `-${pdfMoney(discount, quote.currency)}`, 458, totalsY - 32, 10, 90);
  }
  if (Number(quote.taxRate) > 0) {
    drawText(page, font, `Tax (${Number(quote.taxRate)}%)`, 350, totalsY - 52, 10, 100);
    drawText(page, font, pdfMoney(tax, quote.currency), 458, totalsY - 52, 10, 90);
  }
  const blue = rgb(0.1, 0.37, 0.92);
  drawText(page, font, 'TOTAL', 350, totalsY - 78, 14, 100, blue);
  drawText(page, font, pdfMoney(total, quote.currency), 458, totalsY - 78, 14, 90, blue);

  const noteLines: FlowLine[] = quote.notes
    ? wrapText(`Notes: ${quote.notes}`, font, 9, CONTENT_WIDTH).map((value) => ({ value, color: rgb(0.82, 0.08, 0.12) }))
    : [];
  const termLines: FlowLine[] = quote.terms
    ? wrapText(`Terms: ${quote.terms}`, font, 9, CONTENT_WIDTH).map((value) => ({ value, color: muted }))
    : [];
  const flowLines: FlowLine[] = [
    ...noteLines,
    ...(noteLines.length && termLines.length ? [{ value: '', color: rgb(0, 0, 0) }] : []),
    ...termLines
  ];
  let flowY = totalsY - 116;

  for (const line of flowLines) {
    if (flowY < BOTTOM_MARGIN) {
      page = addContinuationPage(document, font, quote, logo);
      flowY = 700;
    }
    if (line.value) drawText(page, font, line.value, LEFT, flowY, 9, CONTENT_WIDTH, line.color);
    flowY -= 14;
  }

  return Buffer.from(await document.save());
}
