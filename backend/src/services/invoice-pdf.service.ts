import type { Client, Invoice } from '@prisma/client';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync, deflateSync } from 'node:zlib';

type PdfInvoice = Invoice & { client: Client };
type PdfObject = string | Buffer;
type PngImage = { width: number; height: number; rgb: Buffer; alpha?: Buffer };

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

function readUInt32(buffer: Buffer, offset: number) {
  return buffer.readUInt32BE(offset);
}

function paeth(left: number, up: number, upperLeft: number) {
  const p = left + up - upperLeft;
  const pa = Math.abs(p - left);
  const pb = Math.abs(p - up);
  const pc = Math.abs(p - upperLeft);
  if (pa <= pb && pa <= pc) return left;
  return pb <= pc ? up : upperLeft;
}

function unfilterPng(data: Buffer, width: number, height: number, bytesPerPixel: number) {
  const stride = width * bytesPerPixel;
  const output = Buffer.alloc(stride * height);
  let inputOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = data[inputOffset];
    inputOffset += 1;
    const rowStart = y * stride;
    const priorStart = rowStart - stride;
    for (let x = 0; x < stride; x += 1) {
      const raw = data[inputOffset + x];
      const left = x >= bytesPerPixel ? output[rowStart + x - bytesPerPixel] : 0;
      const up = y > 0 ? output[priorStart + x] : 0;
      const upperLeft = y > 0 && x >= bytesPerPixel ? output[priorStart + x - bytesPerPixel] : 0;
      const value = filter === 0 ? raw : filter === 1 ? raw + left : filter === 2 ? raw + up : filter === 3 ? raw + Math.floor((left + up) / 2) : raw + paeth(left, up, upperLeft);
      output[rowStart + x] = value & 255;
    }
    inputOffset += stride;
  }
  return output;
}

function parsePng(buffer: Buffer): PngImage | null {
  const signature = buffer.subarray(0, 8).toString('hex');
  if (signature !== '89504e470d0a1a0a') return null;
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const chunks: Buffer[] = [];
  while (offset < buffer.length) {
    const length = readUInt32(buffer, offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = readUInt32(data, 0);
      height = readUInt32(data, 4);
      bitDepth = data[8];
      colorType = data[9];
    }
    if (type === 'IDAT') chunks.push(data);
    if (type === 'IEND') break;
    offset += length + 12;
  }
  if (!width || !height || bitDepth !== 8 || ![2, 6].includes(colorType)) return null;
  const channels = colorType === 6 ? 4 : 3;
  const raw = unfilterPng(inflateSync(Buffer.concat(chunks)), width, height, channels);
  const maxWidth = 900;
  const scale = width > maxWidth ? maxWidth / width : 1;
  const outWidth = Math.max(1, Math.round(width * scale));
  const outHeight = Math.max(1, Math.round(height * scale));
  const rgb = Buffer.alloc(outWidth * outHeight * 3);
  const alpha = colorType === 6 ? Buffer.alloc(outWidth * outHeight) : undefined;
  for (let y = 0; y < outHeight; y += 1) {
    const sourceY = Math.min(height - 1, Math.floor(y / scale));
    for (let x = 0; x < outWidth; x += 1) {
      const sourceX = Math.min(width - 1, Math.floor(x / scale));
      const source = (sourceY * width + sourceX) * channels;
      const pixel = y * outWidth + x;
      rgb[pixel * 3] = raw[source];
      rgb[pixel * 3 + 1] = raw[source + 1];
      rgb[pixel * 3 + 2] = raw[source + 2];
      if (alpha) alpha[pixel] = raw[source + 3];
    }
  }
  return { width: outWidth, height: outHeight, rgb, alpha };
}

function loadLogo() {
  const assetPath = join(dirname(fileURLToPath(import.meta.url)), '../assets/scalora-logo.png');
  if (!existsSync(assetPath)) return null;
  return parsePng(readFileSync(assetPath));
}

export function renderInvoicePdf(invoice: PdfInvoice) {
  const logo = loadLogo();
  const outstanding = Math.max(0, Number(invoice.amount) - Number(invoice.paidAmount));
  const service = invoice.client.service.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
  const period = invoice.billingPeriodStart && invoice.billingPeriodEnd ? `${date(invoice.billingPeriodStart)} to ${date(new Date(invoice.billingPeriodEnd.getTime() - 1))}` : '-';
  const content = [
    logo ? 'q 92 0 0 46 48 746 cm /Logo Do Q' : '0.12 0.38 0.92 rg 48 746 44 44 re f',
    logo ? '' : '1 1 1 rg',
    logo ? '' : text(61, 761, 24, 'S'),
    '0 0 0 rg',
    logo ? text(154, 772, 24, 'Scalora') : text(104, 772, 24, 'Scalora'),
    logo ? text(154, 752, 10, 'Accounting Invoice') : text(104, 752, 10, 'Accounting Invoice'),
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
    const smaskRef = logo.alpha ? ' /SMask 7 0 R' : '';
    objects.push(Buffer.concat([
      Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode${smaskRef} /Length ${imageData.length} >>\nstream\n`),
      imageData,
      Buffer.from('\nendstream')
    ]));
    if (logo.alpha) {
      const alphaData = deflateSync(logo.alpha);
      objects.push(Buffer.concat([
        Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length ${alphaData.length} >>\nstream\n`),
        alphaData,
        Buffer.from('\nendstream')
      ]));
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
