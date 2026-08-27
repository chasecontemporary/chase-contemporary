// Collateral: tear sheet + certificate of authenticity — the invoice brand system, per work.
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'fs';
import path from 'path';

const INK = rgb(0, 0, 0);
const GRAY = rgb(0.42, 0.42, 0.45);
const HAIR = rgb(0.91, 0.91, 0.93);
const usd = (c) => '$' + Math.round((c || 0) / 100).toLocaleString();
const asset = (p) => fs.readFileSync(path.join(process.cwd(), 'assets', p));

function tracked(page, text, { x, y, size, font, color = INK, spacing = 1.6 }) {
  let cx = x;
  for (const ch of String(text).toUpperCase()) {
    page.drawText(ch, { x: cx, y, size, font, color });
    cx += font.widthOfTextAtSize(ch, size) + spacing;
  }
  return cx - spacing;
}
const trackedWidth = (font, text, size, spacing = 1.6) =>
  [...String(text).toUpperCase()].reduce((w, ch) => w + font.widthOfTextAtSize(ch, size) + spacing, -spacing);

async function base(kind) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const regular = await doc.embedFont(asset('fonts/nimbus-sans-novus-regular.ttf'));
  const medium = await doc.embedFont(asset('fonts/nimbus-sans-novus-medium.ttf'));
  const semibold = await doc.embedFont(asset('fonts/nimbus-sans-novus-semibold.ttf'));
  const logo = await doc.embedPng(asset('img/logo-stacked.png'));
  const page = doc.addPage([612, 792]);
  const M = 64;
  // header: centered logo, document kind beneath
  const lh = 44, lw = (logo.width / logo.height) * lh;
  page.drawImage(logo, { x: (612 - lw) / 2, y: 792 - M - lh, width: lw, height: lh });
  tracked(page, kind, { x: (612 - trackedWidth(semibold, kind, 8.5, 2.6)) / 2, y: 792 - M - lh - 22,
    size: 8.5, font: semibold, spacing: 2.6, color: GRAY });
  return { doc, page, M, regular, medium, semibold };
}

async function embedImage(doc, url) {
  try {
    const res = await fetch(url + (url.includes('?') ? '&' : '?') + 'width=1600');
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length > 4 && bytes.readUInt32BE(0) === 0x89504e47) return await doc.embedPng(bytes);
    return await doc.embedJpg(bytes);
  } catch { return null; }
}

function wallLabel(page, a, { M, medium, semibold, regular }, y, opts = {}) {
  tracked(page, a.artist || 'CHASE CONTEMPORARY', { x: M, y, size: 9.5, font: semibold, spacing: 1.6 });
  y -= 16;
  page.drawText(String(a.title || 'Untitled'), { x: M, y, size: 12, font: medium });
  y -= 15;
  const lines = [a.medium, a.dims_h_in ? `${a.dims_h_in} × ${a.dims_w_in} in` : null,
    opts.price ? ((a.price_cents || 0) > 0 ? usd(a.price_cents) : 'Price on request') : null].filter(Boolean);
  for (const line of lines) {
    page.drawText(String(line), { x: M, y, size: 9.5, font: regular, color: GRAY, maxWidth: 612 - M * 2, lineHeight: 13 });
    y -= 13 * Math.max(1, Math.ceil(regular.widthOfTextAtSize(String(line), 9.5) / (612 - M * 2)));
  }
  return y;
}

export async function buildTearSheet(a) {
  const ctx = await base('ARTWORK');
  const { doc, page, M, regular, semibold } = ctx;
  let y = 792 - M - 44 - 44;
  const img = a.image_url ? await embedImage(doc, a.image_url) : null;
  if (img) {
    const maxW = 612 - M * 2, maxH = 400;
    const s = Math.min(maxW / img.width, maxH / img.height);
    const w = img.width * s, h = img.height * s;
    page.drawImage(img, { x: (612 - w) / 2, y: y - h, width: w, height: h });
    y -= h + 28;
  }
  y = wallLabel(page, a, ctx, y, { price: true });
  y -= 10;
  if (a.description) {
    page.drawLine({ start: { x: M, y }, end: { x: 612 - M, y }, thickness: 0.5, color: HAIR });
    y -= 16;
    const text = String(a.description).slice(0, 900);
    page.drawText(text, { x: M, y, size: 9, font: regular, color: INK, maxWidth: 612 - M * 2, lineHeight: 13.5 });
  }
  const fy = M;
  const contact = 'info@chasecontemporary.com · chasecontemporary.com';
  page.drawText(contact, { x: (612 - regular.widthOfTextAtSize(contact, 7.5)) / 2, y: fy, size: 7.5, font: regular, color: GRAY });
  return await doc.save();
}

export async function buildCoa(a) {
  const ctx = await base('CERTIFICATE OF AUTHENTICITY');
  const { doc, page, M, regular, medium, semibold } = ctx;
  let y = 792 - M - 44 - 52;
  const img = a.image_url ? await embedImage(doc, a.image_url) : null;
  if (img) {
    const maxW = 300, maxH = 260;
    const s = Math.min(maxW / img.width, maxH / img.height);
    const w = img.width * s, h = img.height * s;
    page.drawImage(img, { x: (612 - w) / 2, y: y - h, width: w, height: h });
    y -= h + 30;
  }
  const rows = [
    ['ARTIST', a.artist], ['TITLE', a.title],
    ['MEDIUM', a.medium], ['DIMENSIONS', a.dims_h_in ? `${a.dims_h_in} × ${a.dims_w_in} in` : null],
    ['INVENTORY №', a.artcloud_id && !String(a.artcloud_id).includes(':') ? a.artcloud_id : null],
  ].filter(r => r[1]);
  for (const [k, v] of rows) {
    tracked(page, k, { x: M, y, size: 7.5, font: semibold, color: GRAY, spacing: 1.8 });
    const lines = String(v);
    page.drawText(lines, { x: M + 130, y, size: 10, font: medium, maxWidth: 612 - M - 130 - M, lineHeight: 13 });
    y -= 13 * Math.max(1, Math.ceil(medium.widthOfTextAtSize(lines, 10) / (612 - M - 130 - M))) + 9;
  }
  y -= 14;
  page.drawLine({ start: { x: M, y }, end: { x: 612 - M, y }, thickness: 0.5, color: HAIR });
  y -= 22;
  const att = 'Chase Contemporary certifies that the work described above is an authentic and original work by the artist named, and that the details stated are accurate to the best of the gallery’s knowledge and records.';
  page.drawText(att, { x: M, y, size: 9.5, font: regular, color: INK, maxWidth: 612 - M * 2, lineHeight: 15 });
  y -= 15 * Math.ceil(regular.widthOfTextAtSize(att, 9.5) / (612 - M * 2)) + 48;
  // signature + date lines
  page.drawLine({ start: { x: M, y }, end: { x: M + 200, y }, thickness: 0.7, color: INK });
  tracked(page, 'AUTHORIZED SIGNATURE', { x: M, y: y - 14, size: 7, font: semibold, color: GRAY, spacing: 1.6 });
  page.drawLine({ start: { x: 612 - M - 160, y }, end: { x: 612 - M, y }, thickness: 0.7, color: INK });
  tracked(page, 'DATE', { x: 612 - M - 160, y: y - 14, size: 7, font: semibold, color: GRAY, spacing: 1.6 });
  const fy = M;
  const wm = 'CHASE CONTEMPORARY';
  tracked(page, wm, { x: (612 - trackedWidth(semibold, wm, 8, 2.6)) / 2, y: fy + 12, size: 8, font: semibold, spacing: 2.6 });
  const contact = 'info@chasecontemporary.com · chasecontemporary.com';
  page.drawText(contact, { x: (612 - regular.widthOfTextAtSize(contact, 7)) / 2, y: fy, size: 7, font: regular, color: GRAY });
  return await doc.save();
}
