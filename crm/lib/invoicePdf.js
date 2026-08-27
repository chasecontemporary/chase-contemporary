// Chase Contemporary invoice PDF — the website's brand system on paper.
// Optic white, Nimbus Sans Novus, tracked caps, wall-label line items, hairline rules.
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'fs';
import path from 'path';

const INK = rgb(0, 0, 0);
const GRAY = rgb(0.42, 0.42, 0.45);
const HAIR = rgb(0.91, 0.91, 0.93);
const usd = (c) => '$' + (Math.round(c || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 });
const asset = (p) => fs.readFileSync(path.join(process.cwd(), 'assets', p));

// letter-spaced caps: pdf-lib has no tracking, so we draw char by char
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

export async function buildInvoicePdf({ invoice, collector, items }) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const regular = await doc.embedFont(asset('fonts/nimbus-sans-novus-regular.ttf'));
  const medium = await doc.embedFont(asset('fonts/nimbus-sans-novus-medium.ttf'));
  const semibold = await doc.embedFont(asset('fonts/nimbus-sans-novus-semibold.ttf'));
  const logo = await doc.embedPng(asset('img/logo-stacked.png'));

  const page = doc.addPage([612, 792]);           // US Letter
  const M = 64;
  const W = 612 - M * 2;
  let y = 792 - M;

  // header: logo left, invoice meta right
  const lh = 46;
  const lw = (logo.width / logo.height) * lh;
  page.drawImage(logo, { x: M, y: y - lh, width: lw, height: lh });
  const num = 'NO. ' + String(invoice.invoice_number).padStart(4, '0');
  tracked(page, 'INVOICE', { x: 612 - M - trackedWidth(semibold, 'INVOICE', 9, 2.2), y: y - 9, size: 9, font: semibold, spacing: 2.2 });
  page.drawText(num, { x: 612 - M - semibold.widthOfTextAtSize(num, 16), y: y - 30, size: 16, font: semibold, color: INK });
  const issued = 'Issued ' + new Date(invoice.issued_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  page.drawText(issued, { x: 612 - M - regular.widthOfTextAtSize(issued, 8.5), y: y - 44, size: 8.5, font: regular, color: GRAY });
  if (invoice.due_at) {
    const due = 'Due ' + new Date(invoice.due_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    page.drawText(due, { x: 612 - M - regular.widthOfTextAtSize(due, 8.5), y: y - 56, size: 8.5, font: regular, color: GRAY });
  }
  y -= lh + 34;
  page.drawLine({ start: { x: M, y }, end: { x: 612 - M, y }, thickness: 0.7, color: INK });
  y -= 26;

  // billed to
  const blockTop = y;
  tracked(page, 'BILLED TO', { x: M, y, size: 7.5, font: semibold, color: GRAY, spacing: 1.8 });
  y -= 15;
  const name = [collector?.salutation, collector?.first_name, collector?.last_name].filter(Boolean).join(' ') || 'Client';
  page.drawText(name, { x: M, y, size: 11, font: medium });
  y -= 14;
  const addr = [collector?.company,
    collector?.address_line1, collector?.address_line2,
    [collector?.city, collector?.state, collector?.zip].filter(Boolean).join(', '),
    collector?.country,
    collector?.email && !collector.email.endsWith('import.chasecontemporary.com') ? collector.email : null,
  ].filter(Boolean);
  let sy = blockTop;
  for (const line of addr) {
    page.drawText(String(line), { x: M, y, size: 9, font: regular, color: GRAY });
    y -= 12;
  }
  if (collector?.shipping_line1) {
    const sx = M + 230;
    tracked(page, 'SHIP TO', { x: sx, y: sy, size: 7.5, font: semibold, color: GRAY, spacing: 1.8 });
    sy -= 15 + 14;
    const ship = [collector.shipping_line1, collector.shipping_line2,
      [collector.shipping_city, collector.shipping_state, collector.shipping_zip].filter(Boolean).join(', '),
      collector.shipping_country].filter(Boolean);
    for (const line of ship) {
      page.drawText(String(line), { x: sx, y: sy, size: 9, font: regular, color: GRAY });
      sy -= 12;
    }
    y = Math.min(y, sy);
  }
  y -= 18;

  // items — wall-label style
  page.drawLine({ start: { x: M, y }, end: { x: 612 - M, y }, thickness: 0.5, color: HAIR });
  y -= 20;
  for (const it of items) {
    tracked(page, it.artist || 'CHASE CONTEMPORARY', { x: M, y, size: 8.5, font: semibold, spacing: 1.4 });
    const amt = usd(it.amount_cents);
    page.drawText(amt, { x: 612 - M - semibold.widthOfTextAtSize(amt, 10.5), y: y - 1, size: 10.5, font: semibold });
    y -= 14;
    page.drawText(String(it.title || 'Artwork'), { x: M, y, size: 10, font: medium });
    y -= 13;
    const meta = [it.medium, it.dims].filter(Boolean).join(' · ');
    if (meta) { page.drawText(meta, { x: M, y, size: 8.5, font: regular, color: GRAY }); y -= 12; }
    y -= 9;
    page.drawLine({ start: { x: M, y }, end: { x: 612 - M, y }, thickness: 0.5, color: HAIR });
    y -= 20;
  }

  // totals
  const subtotal = items.reduce((s, i) => s + (i.amount_cents || 0), 0);
  const rows = [['Subtotal', subtotal]];
  if (invoice.tax_cents) rows.push(['Sales tax', invoice.tax_cents]);
  if (invoice.shipping_cents) rows.push(['Shipping', invoice.shipping_cents]);
  const total = subtotal + (invoice.tax_cents || 0) + (invoice.shipping_cents || 0);
  const tx = 612 - M - 190;
  for (const [label, cents] of rows) {
    page.drawText(label, { x: tx, y, size: 9, font: regular, color: GRAY });
    const v = usd(cents);
    page.drawText(v, { x: 612 - M - regular.widthOfTextAtSize(v, 9), y, size: 9, font: regular });
    y -= 15;
  }
  y -= 4;
  page.drawLine({ start: { x: tx, y: y + 10 }, end: { x: 612 - M, y: y + 10 }, thickness: 0.7, color: INK });
  y -= 4;
  tracked(page, 'TOTAL DUE', { x: tx, y, size: 8.5, font: semibold, spacing: 1.8 });
  const tv = usd(total);
  page.drawText(tv, { x: 612 - M - semibold.widthOfTextAtSize(tv, 14), y: y - 2, size: 14, font: semibold });
  y -= 44;

  // payment
  tracked(page, 'PAYMENT', { x: M, y, size: 7.5, font: semibold, color: GRAY, spacing: 1.8 });
  y -= 15;
  const wire = process.env.WIRE_INSTRUCTIONS ||
    'Payment by wire to Zenzeba Group Inc. Wire instructions are provided under separate cover.';
  const payLines = [wire, `Please reference Invoice ${num.replace('NO. ', 'No. ')} with your payment.`];
  for (const line of payLines) {
    page.drawText(line, { x: M, y, size: 9, font: regular, color: INK, maxWidth: W, lineHeight: 13 });
    y -= 13 * Math.ceil(regular.widthOfTextAtSize(line, 9) / W);
    y -= 4;
  }

  // footer
  const fy = M + 10;
  page.drawLine({ start: { x: M, y: fy + 30 }, end: { x: 612 - M, y: fy + 30 }, thickness: 0.5, color: HAIR });
  const wm = 'CHASE CONTEMPORARY';
  tracked(page, wm, { x: (612 - trackedWidth(semibold, wm, 8, 2.6)) / 2, y: fy + 12, size: 8, font: semibold, spacing: 2.6 });
  const terms = 'All works remain the property of Zenzeba Group Inc until payment is received in full. Title passes upon receipt of full payment.';
  const contact = 'info@chasecontemporary.com · chasecontemporary.com';
  page.drawText(terms, { x: (612 - regular.widthOfTextAtSize(terms, 7)) / 2, y: fy, size: 7, font: regular, color: GRAY });
  page.drawText(contact, { x: (612 - regular.widthOfTextAtSize(contact, 7)) / 2, y: fy - 10, size: 7, font: regular, color: GRAY });

  return await doc.save();
}
