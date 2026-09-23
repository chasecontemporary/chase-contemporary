// Collateral: tear sheet + certificate of authenticity, the invoice brand system, per work.
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'fs';
import path from 'path';
import { yearOf, bareTitle, inventoryNo } from './agreementsPdf.js';

const INK = rgb(0, 0, 0);
const GRAY = rgb(0.42, 0.42, 0.45);
const HAIR = rgb(0.91, 0.91, 0.93);
const usd = (c) => '$' + Math.round((c || 0) / 100).toLocaleString();
const asset = (p) => fs.readFileSync(path.join(process.cwd(), 'assets', p));
const assetPath = (p) => path.join(process.cwd(), 'assets', p);
const WHITE = rgb(1, 1, 1);
const longDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
// Bernie's signature, when it has been dropped in. See docs/AGREEMENT-TEMPLATES.md.
const SIGNATURE_PNG = 'img/signature.png';
const hasSignature = () => { try { return fs.existsSync(assetPath(SIGNATURE_PNG)); } catch { return false; } };

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
  const lines = [a.medium, a.dims_h_in ? `${a.dims_h_in} × ${a.dims_w_in} in` : null, a.edition ? 'Edition ' + a.edition : null,
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

export async function buildCoa(a, opts = {}) {
  // The gallery's own certificate, rebuilt from the signed template they actually issue.
  // Layout, wording and field order are theirs, measured off the PDF: the wordmark top left,
  // the gallery line top right, a rule, "Certificate of Authenticity", the work, then Artist,
  // Title, Edition, Year and Size, then the artist's name again above the signature rule.
  //
  // The signature is theirs too, lifted from the template they sign. That is how they issue a
  // certificate today: one pre signed copy, filled in per work. It is applied here only because
  // the gallery asked for it; nothing else in the engine signs anything on anyone's behalf.
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const regular = await doc.embedFont(asset('fonts/nimbus-sans-novus-regular.ttf'));
  const medium = await doc.embedFont(asset('fonts/nimbus-sans-novus-medium.ttf'));
  const page = doc.addPage([612, 792]);
  const M = 52.3;                      // their left margin, to the point
  const top = (yFromTop) => 792 - yFromTop;

  // wordmark, top left, at the size it sits on their template
  try {
    const wm = await doc.embedPng(asset('img/wordmark.png'));
    const w = 176, h = w * (wm.height / wm.width);
    page.drawImage(wm, { x: M, y: top(52 + h), width: w, height: h });
  } catch {
    page.drawText('CHASE CONTEMPORARY', { x: M, y: top(96), size: 20, font: medium });
  }

  // the gallery, top right
  const right = 612 - M;
  const nm = 'Chase Contemporary';
  page.drawText(nm, { x: right - medium.widthOfTextAtSize(nm, 9.5), y: top(63.1), size: 9.5, font: medium });
  const site = 'www.chasecontemporary.com';
  page.drawText(site, { x: right - regular.widthOfTextAtSize(site, 7), y: top(74.1), size: 7, font: regular, color: GRAY });

  page.drawLine({ start: { x: M, y: top(110) }, end: { x: right, y: top(110) }, thickness: 0.6, color: rgb(0.6, 0.6, 0.62) });

  page.drawText('Certificate of Authenticity', { x: M, y: top(131.6), size: 9.5, font: regular });

  // the work
  const img = a.image_url ? await embedImage(doc, a.image_url) : null;
  if (img) {
    const maxW = 200, maxH = 108;
    const s = Math.min(maxW / img.width, maxH / img.height);
    page.drawImage(img, { x: M, y: top(248), width: img.width * s, height: img.height * s });
  }

  // the fields, in their order, at their positions
  const year = yearOf(a);
  const size = (a.dims_h_in && a.dims_w_in) ? `${a.dims_h_in} x ${a.dims_w_in} in` : null;
  const rows = [
    ['Artist:', a.artist],
    ['Title:', bareTitle(a) || a.title],
    ['Edition:', a.edition],
    ['Year:', year],
    ['Size:', size],
  ];
  let y = 263.7;
  for (const [label, value] of rows) {
    page.drawText(label, { x: M, y: top(y), size: 9.5, font: regular });
    if (value) page.drawText(String(value), { x: 115.3, y: top(y), size: 9.5, font: regular });
    y += 11.9;
  }

  // the artist again, above the signature, as their template has it
  if (a.artist) page.drawText(String(a.artist), { x: M, y: top(467.8), size: 9.5, font: regular });

  page.drawLine({ start: { x: M, y: top(486) }, end: { x: right, y: top(486) }, thickness: 0.6, color: rgb(0.6, 0.6, 0.62) });

  // signature and date
  page.drawText('Signature:', { x: M, y: top(505.8), size: 9.5, font: regular });
  const sigLineY = top(509);
  page.drawLine({ start: { x: 105, y: sigLineY }, end: { x: 340, y: sigLineY }, thickness: 0.8, color: INK });
  if (hasSignature()) {
    try {
      // sized and seated to sit on the rule the way it does on their signed template,
      // where the tall loop rises just short of the artist's name above it
      const sig = await doc.embedPng(asset(SIGNATURE_PNG));
      const w = 68, h = w * (sig.height / sig.width);
      page.drawImage(sig, { x: 110, y: sigLineY + 1.5, width: w, height: h });
    } catch { /* the line stands on its own if the image will not embed */ }
  }
  page.drawText('Date:', { x: 382.2, y: top(505.8), size: 9.5, font: regular });
  const dateY = top(509);
  page.drawLine({ start: { x: 412, y: dateY }, end: { x: right, y: dateY }, thickness: 0.8, color: INK });
  const issued = opts.issuedAt ? longDate(opts.issuedAt) : longDate(new Date());
  page.drawText(issued, { x: 414, y: dateY + 4, size: 9.5, font: regular });

  const foot = 'www.chasecontemporary.com';
  page.drawText(foot, { x: (612 - regular.widthOfTextAtSize(foot, 7.5)) / 2, y: top(780.6), size: 7.5, font: regular, color: GRAY });

  return await doc.save();
}
