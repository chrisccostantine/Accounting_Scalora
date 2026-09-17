import type { Client, Quote, QuoteItem } from '@prisma/client';
import { rtlText } from 'bidi-shaper/pdfkit';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import { pdfDate, pdfMoney } from './invoice-pdf.service.js';

type PdfQuote = Quote & { client: Client; items: QuoteItem[] };
type FlowLine = { value: string; color: string };
type FontName = 'NotoSans' | 'NotoSansArabic';

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const LEFT = 48;
const CONTENT_WIDTH = 500;
const BOTTOM_MARGIN = 48;
const ARABIC_PATTERN = /[\u0590-\u08FF\uFB1D-\uFDFD\uFE70-\uFEFC]/;

function truncate(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length - 3)}...` : value;
}

function isRtl(value: string) {
  const firstStrong = value.match(/[A-Za-z\u0590-\u08FF\uFB1D-\uFDFD\uFE70-\uFEFC]/)?.[0];
  return Boolean(firstStrong && ARABIC_PATTERN.test(firstStrong));
}

function splitFontRuns(value: string) {
  const runs: { value: string; font: FontName }[] = [];
  for (const character of value) {
    const font: FontName = ARABIC_PATTERN.test(character) ? 'NotoSansArabic' : 'NotoSans';
    const previous = runs.at(-1);
    if (previous?.font === font) previous.value += character;
    else runs.push({ value: character, font });
  }
  return runs;
}

function measureText(doc: PDFKit.PDFDocument, value: string, size: number) {
  const width = splitFontRuns(rtlText(value)).reduce((total, run) => {
    doc.font(run.font).fontSize(size);
    return total + doc.widthOfString(run.value, { features: [] });
  }, 0);
  doc.font('NotoSans');
  return width;
}

function wrapText(doc: PDFKit.PDFDocument, value: string, size: number, maxWidth: number) {
  doc.fontSize(size);
  return value.replace(/\r\n?/g, '\n').split('\n').flatMap((paragraph) => {
    if (!paragraph) return [''];
    const words = paragraph.replace(/\t/g, '    ').split(/\s+/);
    const lines: string[] = [];
    let line = '';

    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (measureText(doc, candidate, size) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      line = '';

      let fragment = '';
      for (const character of word) {
        if (fragment && measureText(doc, `${fragment}${character}`, size) > maxWidth) {
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

function drawText(doc: PDFKit.PDFDocument, value: string, x: number, y: number, size: number, options: PDFKit.Mixins.TextOptions = {}) {
  const width = options.width ?? CONTENT_WIDTH;
  const runs = splitFontRuns(rtlText(value));
  const textWidth = runs.reduce((total, run) => {
    doc.font(run.font).fontSize(size);
    return total + doc.widthOfString(run.value, { features: [] });
  }, 0);
  const alignment = options.align ?? (isRtl(value) ? 'right' : 'left');
  let cursorX = alignment === 'right' ? x + width - textWidth : alignment === 'center' ? x + (width - textWidth) / 2 : x;

  for (const run of runs) {
    doc.font(run.font).fontSize(size);
    doc.text(run.value, cursorX, y, { lineBreak: false, features: [] });
    cursorX += doc.widthOfString(run.value, { features: [] });
  }
  doc.font('NotoSans');
}

function drawHeader(doc: PDFKit.PDFDocument, quote: PdfQuote, logoPath: string, continued = false) {
  if (existsSync(logoPath)) {
    doc.image(logoPath, LEFT, 38, { fit: [124, 62] });
  } else {
    doc.fillColor('#1f61eb').rect(LEFT, 42, 44, 44).fill();
    doc.fillColor('#ffffff').font('NotoSans').fontSize(24).text('S', 61, 51, { lineBreak: false });
  }

  doc.fillColor('#000000').fontSize(continued ? 20 : 27);
  drawText(doc, continued ? 'PRICE QUOTE - CONTINUED' : 'PRICE QUOTE', continued ? 326 : 396, continued ? 54 : 50, continued ? 20 : 27, { width: continued ? 222 : 152 });
  doc.fillColor('#596374').fontSize(10);
  drawText(doc, quote.quoteNumber, 430, 83, 10, { width: 118 });
  doc.strokeColor('#000000').moveTo(LEFT, continued ? 106 : 118).lineTo(548, continued ? 106 : 118).stroke();
}

function addContinuationPage(doc: PDFKit.PDFDocument, quote: PdfQuote, logoPath: string) {
  doc.addPage({ size: [PAGE_WIDTH, PAGE_HEIGHT], margin: 0 });
  drawHeader(doc, quote, logoPath, true);
  return 130;
}

export async function renderQuotePdf(quote: PdfQuote) {
  const serviceDirectory = dirname(fileURLToPath(import.meta.url));
  const bundledAssetDirectory = join(serviceDirectory, '../assets');
  const assetDirectory = existsSync(join(bundledAssetDirectory, 'NotoSansArabic-Regular.ttf'))
    ? bundledAssetDirectory
    : join(serviceDirectory, '../../src/assets');
  const logoPath = join(assetDirectory, 'scalora-logo.png');
  const fontPath = join(assetDirectory, 'NotoSansArabic-Regular.ttf');
  const doc = new PDFDocument({ autoFirstPage: false, compress: true, margin: 0 });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const completed = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  doc.registerFont('NotoSans', join(assetDirectory, 'NotoSans-Regular.ttf'));
  doc.registerFont('NotoSansArabic', fontPath);
  doc.font('NotoSans');
  doc.addPage({ size: [PAGE_WIDTH, PAGE_HEIGHT], margin: 0 });

  const subtotal = quote.items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitPrice), 0);
  const discount = Math.min(Number(quote.discount), subtotal);
  const tax = (subtotal - discount) * Number(quote.taxRate) / 100;
  const total = subtotal - discount + tax;
  const businessName = quote.client.company || quote.client.name;
  const visibleItems = quote.items.slice(0, 8);

  drawHeader(doc, quote, logoPath);
  doc.fillColor('#596374').fontSize(10);
  drawText(doc, 'PREPARED FOR', LEFT, 145, 10, { width: 260 });
  doc.fillColor('#000000').fontSize(18);
  drawText(doc, truncate(businessName, 36), LEFT, 164, 18, { width: 260 });
  if (quote.client.company && quote.client.name !== quote.client.company) {
    doc.fillColor('#596374').fontSize(10);
    drawText(doc, quote.client.name, LEFT, 190, 10, { width: 260 });
  }

  doc.fillColor('#596374').fontSize(10);
  drawText(doc, 'QUOTE DETAILS', 360, 145, 10, { width: 188 });
  doc.fillColor('#000000');
  drawText(doc, `Issue Date: ${pdfDate(quote.issueDate)}`, 360, 165, 10, { width: 188 });
  drawText(doc, `Valid Until: ${pdfDate(quote.validUntil)}`, 360, 181, 10, { width: 188 });
  drawText(doc, `Status: ${quote.status}`, 360, 197, 10, { width: 188 });

  doc.fillColor('#f2f7ff').rect(LEFT, 251, CONTENT_WIDTH, 36).fill();
  doc.fillColor('#1f293d').fontSize(10);
  drawText(doc, 'Description', 62, 264, 10, { width: 270 });
  drawText(doc, 'Qty', 350, 264, 10, { width: 45 });
  drawText(doc, 'Unit Price', 408, 264, 10, { width: 75 });
  drawText(doc, 'Total', 492, 264, 10, { width: 56 });
  doc.strokeColor('#bec9db').moveTo(LEFT, 287).lineTo(548, 287).stroke();

  visibleItems.forEach((item, index) => {
    const y = 305 + index * 28;
    doc.fillColor('#000000').fontSize(10);
    drawText(doc, truncate(item.description, 45), 62, y, 10, { width: 270 });
    drawText(doc, String(Number(item.quantity)), 350, y, 10, { width: 45 });
    drawText(doc, pdfMoney(item.unitPrice, quote.currency), 408, y, 10, { width: 75 });
    drawText(doc, pdfMoney(Number(item.quantity) * Number(item.unitPrice), quote.currency), 492, y, 10, { width: 56 });
  });

  const totalsTop = 330 + visibleItems.length * 28;
  doc.strokeColor('#bec9db').moveTo(LEFT, totalsTop).lineTo(548, totalsTop).stroke();
  doc.fillColor('#000000').fontSize(10);
  drawText(doc, 'Subtotal', 350, totalsTop + 18, 10, { width: 100 });
  drawText(doc, pdfMoney(subtotal, quote.currency), 458, totalsTop + 18, 10, { width: 90 });
  if (discount > 0) {
    drawText(doc, 'Discount', 350, totalsTop + 38, 10, { width: 100 });
    drawText(doc, `-${pdfMoney(discount, quote.currency)}`, 458, totalsTop + 38, 10, { width: 90 });
  }
  if (Number(quote.taxRate) > 0) {
    drawText(doc, `Tax (${Number(quote.taxRate)}%)`, 350, totalsTop + 58, 10, { width: 100 });
    drawText(doc, pdfMoney(tax, quote.currency), 458, totalsTop + 58, 10, { width: 90 });
  }
  doc.fillColor('#1a5fe8').fontSize(14);
  drawText(doc, 'TOTAL', 350, totalsTop + 84, 14, { width: 100 });
  drawText(doc, pdfMoney(total, quote.currency), 458, totalsTop + 84, 14, { width: 90 });

  doc.fontSize(9);
  const noteLines: FlowLine[] = quote.notes
    ? wrapText(doc, `Notes: ${quote.notes}`, 9, CONTENT_WIDTH).map((value) => ({ value, color: '#d1141e' }))
    : [];
  const termLines: FlowLine[] = quote.terms
    ? wrapText(doc, `Terms: ${quote.terms}`, 9, CONTENT_WIDTH).map((value) => ({ value, color: '#596374' }))
    : [];
  const flowLines: FlowLine[] = [
    ...noteLines,
    ...(noteLines.length && termLines.length ? [{ value: '', color: '#000000' }] : []),
    ...termLines
  ];
  let flowY = totalsTop + 122;

  for (const line of flowLines) {
    if (flowY > PAGE_HEIGHT - BOTTOM_MARGIN) flowY = addContinuationPage(doc, quote, logoPath);
    if (line.value) {
      doc.fillColor(line.color).fontSize(9);
      drawText(doc, line.value, LEFT, flowY, 9, { width: CONTENT_WIDTH });
    }
    flowY += 14;
  }

  doc.end();
  return completed;
}
