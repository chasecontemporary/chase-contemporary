// Agreements: purchase agreement + on-approval agreement, in the invoice brand system.
// Same fonts, margins, tracked caps and wall-label typography as collateralPdf / invoicePdf,
// plus a small text-flow engine so a long agreement paginates cleanly and the signature
// block never splits across pages.
//
// Every clause below is a plain-English starting point assembled from standard gallery
// practice. Until AGREEMENTS_REVIEWED=1 is set, every page carries a DRAFT watermark and a
// footer line saying counsel has not yet reviewed the template. docs/AGREEMENT-TEMPLATES.md
// lists the constants and questions to settle with counsel.
import { PDFDocument, rgb, degrees } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'fs';
import path from 'path';

// ---- constants to confirm with counsel ------------------------------------------------
export const GOVERNING_LAW = {                       // confirm with counsel
  law: 'the laws of the State of New York, without regard to its conflict of laws rules',
  venue: 'the state and federal courts sitting in New York County, New York',
};
export const LATE_INTEREST = '1% per month';         // confirm with counsel
export const INSPECTION_DAYS = 5;                    // confirm with counsel
export const DEFAULT_DUE_DAYS = 7;                   // matches the invoice default
export const SELLER = {
  legal: 'Zenzeba Group Inc',
  dba: 'Chase Contemporary',
  email: 'info@chasecontemporary.com',
  signer: 'Bernie Chase',
  signerTitle: 'Owner',
};
// ---------------------------------------------------------------------------------------

const INK = rgb(0, 0, 0);
const GRAY = rgb(0.42, 0.42, 0.45);
const HAIR = rgb(0.91, 0.91, 0.93);
const WHITE = rgb(1, 1, 1);
const WATERMARK = rgb(0.935, 0.935, 0.94);
const asset = (p) => fs.readFileSync(path.join(process.cwd(), 'assets', p));
const usd = (c) => (c < 0 ? '-' : '') + '$' + (Math.abs(Math.round(c || 0)) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 });
const longDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
export const reviewed = () => process.env.AGREEMENTS_REVIEWED === '1';

// DocuSign anchor strings createEnvelope() looks for (lib/docusign.js). Drawn in white at
// 1pt so they are invisible on paper but present in the text layer.
// The gallery's date anchor deliberately avoids the word DATE: DocuSign matches an anchor
// anywhere it occurs, so 'GALLERY DATE' would also catch the buyer's 'DATE' tab.
const ANCHOR = { signer: 'AUTHORIZED SIGNATURE', signerDate: 'DATE', gallery: 'GALLERY SIGNATURE', galleryDate: 'COUNTERSIGNED ON' };

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

// Word wrap that reports its lines, so the cursor can move by the real height.
function wrap(font, size, text, width) {
  const out = [];
  for (const para of String(text ?? '').split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { out.push(''); continue; }
    let line = '';
    for (const w of words) {
      const trial = line ? line + ' ' + w : w;
      if (font.widthOfTextAtSize(trial, size) <= width || !line) line = trial;
      else { out.push(line); line = w; }
    }
    if (line) out.push(line);
  }
  return out;
}

// A work's year: the column when the book has one, else the ", 2024" the titles carry.
export const yearOf = (a) => a?.year || (String(a?.title || '').match(/,\s*((?:18|19|20)\d{2})\s*$/) || [])[1] || null;
export const bareTitle = (a) => String(a?.title || 'Untitled').replace(/,\s*(?:18|19|20)\d{2}\s*$/, '');
export const inventoryNo = (a) => a?.artcloud_id && !String(a.artcloud_id).includes(':') ? String(a.artcloud_id) : null;

async function embedImage(doc, url) {
  try {
    const res = await fetch(url + (url.includes('?') ? '&' : '?') + 'width=800');
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length > 4 && bytes.readUInt32BE(0) === 0x89504e47) return await doc.embedPng(bytes);
    return await doc.embedJpg(bytes);
  } catch { return null; }
}

// ---- the flow engine --------------------------------------------------------------------
class Flow {
  constructor(doc, fonts, logo, { kind, number, date }) {
    this.doc = doc; this.f = fonts; this.logo = logo;
    this.kind = kind; this.number = number; this.date = date;
    this.M = 64; this.W = 612 - this.M * 2;
    this.bottom = this.M + 58;             // footer zone
    this.pages = [];
    this.newPage();
  }
  newPage() {
    const page = this.doc.addPage([612, 792]);
    this.pages.push(page); this.page = page;
    const { semibold, regular } = this.f;
    if (!reviewed()) {
      // under everything else, faint, diagonal
      const wm = 'DRAFT, PENDING COUNSEL REVIEW';
      const size = 30, w = semibold.widthOfTextAtSize(wm, size), a = 32 * Math.PI / 180;
      page.drawText(wm, { x: 306 - (w * Math.cos(a)) / 2, y: 396 - (w * Math.sin(a)) / 2, size, font: semibold, color: WATERMARK, rotate: degrees(32) });
    }
    if (this.pages.length === 1) {
      const lh = 44, lw = (this.logo.width / this.logo.height) * lh;
      page.drawImage(this.logo, { x: (612 - lw) / 2, y: 792 - this.M - lh, width: lw, height: lh });
      tracked(page, this.kind, { x: (612 - trackedWidth(semibold, this.kind, 8.5, 2.6)) / 2, y: 792 - this.M - lh - 22, size: 8.5, font: semibold, spacing: 2.6, color: GRAY });
      const meta = [this.number ? 'No. ' + this.number : null, this.date].filter(Boolean).join('  ·  ');
      page.drawText(meta, { x: (612 - regular.widthOfTextAtSize(meta, 8.5)) / 2, y: 792 - this.M - lh - 36, size: 8.5, font: regular, color: GRAY });
      this.y = 792 - this.M - lh - 36 - 30;
    } else {
      const run = `${this.kind}${this.number ? ' · No. ' + this.number : ''} · continued`;
      tracked(page, run, { x: this.M, y: 792 - this.M + 10, size: 7, font: semibold, spacing: 1.8, color: GRAY });
      page.drawLine({ start: { x: this.M, y: 792 - this.M + 2 }, end: { x: 612 - this.M, y: 792 - this.M + 2 }, thickness: 0.5, color: HAIR });
      this.y = 792 - this.M - 16;
    }
  }
  ensure(h) { if (this.y - h < this.bottom) this.newPage(); }
  gap(h) { this.y -= h; }
  rule() { this.ensure(12); this.page.drawLine({ start: { x: this.M, y: this.y }, end: { x: 612 - this.M, y: this.y }, thickness: 0.5, color: HAIR }); this.y -= 14; }
  heading(text) {
    this.ensure(42);
    this.y -= 6;
    tracked(this.page, text, { x: this.M, y: this.y, size: 8, font: this.f.semibold, color: GRAY, spacing: 1.8 });
    this.y -= 16;
  }
  // Body copy. Wraps by measurement and paginates line by line.
  para(text, { size = 9.5, font = this.f.regular, color = INK, lh = 14, after = 7, x = this.M, width = this.W } = {}) {
    const lines = wrap(font, size, text, width);
    for (const line of lines) {
      this.ensure(lh);
      if (line) this.page.drawText(line, { x, y: this.y, size, font, color });
      this.y -= lh;
    }
    this.y -= after;
  }
  // Label left, value right, wrapping the value under a fixed label column.
  kv(k, v, { size = 9.5 } = {}) {
    if (!v) return;
    const { semibold, regular } = this.f;
    const col = 118, width = this.W - col;
    const lines = wrap(regular, size, v, width);
    this.ensure(14 * lines.length + 4);
    tracked(this.page, k, { x: this.M, y: this.y, size: 7, font: semibold, color: GRAY, spacing: 1.6 });
    for (const line of lines) {
      this.page.drawText(line, { x: this.M + col, y: this.y, size, font: regular });
      this.y -= 14;
    }
    this.y -= 4;
  }
  // Money line: label left, amount right.
  money(label, cents, { bold = false, size = 9.5, lh = 15 } = {}) {
    const font = bold ? this.f.semibold : this.f.regular;
    this.ensure(lh);
    const parts = wrap(font, size, label, this.W - 110);
    const lbl = (parts[0] || '') + (parts.length > 1 ? '\u2026' : '');   // a long title rides one line
    this.page.drawText(lbl, { x: this.M, y: this.y, size, font, color: bold ? INK : INK });
    const v = usd(cents);
    this.page.drawText(v, { x: 612 - this.M - font.widthOfTextAtSize(v, size), y: this.y, size, font });
    this.y -= lh;
  }
  // The work, as a wall label with a thumbnail. ARTIST caps over the oblique title.
  async work(a) {
    const { regular, medium, semibold } = this.f;
    const img = a.image_url ? await embedImage(this.doc, a.image_url) : null;
    let iw = 0, ih = 0;
    if (img) { const s = Math.min(84 / img.width, 100 / img.height); iw = img.width * s; ih = img.height * s; }
    const tx = this.M + (img ? iw + 16 : 0), tw = this.W - (img ? iw + 16 : 0);
    const meta = [
      yearOf(a), a.medium,
      a.dims_h_in ? `${a.dims_h_in} × ${a.dims_w_in} in` : null,
      a.edition ? 'Edition ' + a.edition : null,
      inventoryNo(a) ? 'Inventory No. ' + inventoryNo(a) : null,
    ].filter(Boolean);
    const titleLines = wrap(medium, 12, bareTitle(a), tw - 5);   // the oblique slant eats a little width
    const metaLines = meta.flatMap(m => wrap(regular, 9, String(m), tw));
    const th = 16 + titleLines.length * 15 + metaLines.length * 12.5;
    const h = Math.max(ih, th) + 14;
    this.ensure(h);
    const top = this.y;
    if (img) this.page.drawImage(img, { x: this.M, y: top - ih + 8, width: iw, height: ih });
    let y = top;
    tracked(this.page, a.artist || SELLER.dba, { x: tx, y, size: 9.5, font: semibold, spacing: 1.6 });
    y -= 16;
    for (const line of titleLines) { this.page.drawText(line, { x: tx, y, size: 12, font: medium, ySkew: degrees(11) }); y -= 15; }
    for (const line of metaLines) { this.page.drawText(line, { x: tx, y, size: 9, font: regular, color: GRAY }); y -= 12.5; }
    this.y = top - h;
  }
  // Two signature blocks side by side, never split across a page. Visible labels are
  // deliberately NOT the DocuSign anchor strings; those are drawn in white at 1pt.
  signatures({ buyer, sellerName = SELLER.signer, sellerTitle = SELLER.signerTitle }) {
    const { regular, semibold } = this.f;
    const H = 122;
    this.ensure(H + 18);
    this.y -= 18;
    const colW = (this.W - 36) / 2;
    const cols = [
      { x: this.M, label: 'BUYER', name: buyer, sub: null, anchorSig: ANCHOR.signer, anchorDate: ANCHOR.signerDate },
      { x: this.M + colW + 36, label: 'SELLER · ' + SELLER.dba, name: sellerName, sub: `${sellerTitle}, ${SELLER.legal}`, anchorSig: ANCHOR.gallery, anchorDate: ANCHOR.galleryDate },
    ];
    for (const c of cols) {
      let y = this.y;
      tracked(this.page, c.label, { x: c.x, y, size: 7.5, font: semibold, color: GRAY, spacing: 1.8 });
      y -= 40;
      this.page.drawLine({ start: { x: c.x, y }, end: { x: c.x + colW, y }, thickness: 0.7, color: INK });
      this.page.drawText(c.anchorSig, { x: c.x, y: y - 8, size: 1, font: regular, color: WHITE });
      tracked(this.page, 'SIGNATURE', { x: c.x, y: y - 12, size: 6.5, font: semibold, color: GRAY, spacing: 1.5 });
      y -= 30;
      this.page.drawText(c.name || '', { x: c.x, y, size: 9.5, font: regular });
      tracked(this.page, 'PRINTED NAME', { x: c.x, y: y - 12, size: 6.5, font: semibold, color: GRAY, spacing: 1.5 });
      if (c.sub) this.page.drawText(c.sub, { x: c.x + colW - regular.widthOfTextAtSize(c.sub, 7.5), y: y - 12, size: 7.5, font: regular, color: GRAY });
      y -= 34;
      this.page.drawLine({ start: { x: c.x, y }, end: { x: c.x + colW * 0.6, y }, thickness: 0.7, color: INK });
      this.page.drawText(c.anchorDate, { x: c.x, y: y - 8, size: 1, font: regular, color: WHITE });
      tracked(this.page, 'SIGNED ON', { x: c.x, y: y - 12, size: 6.5, font: semibold, color: GRAY, spacing: 1.5 });
    }
    this.y -= H;
  }
  // Footers on every page, drawn last (the footer zone holds no body text).
  finish() {
    const { regular, semibold } = this.f;
    const n = this.pages.length;
    this.pages.forEach((page, i) => {
      const fy = this.M + 6;
      page.drawLine({ start: { x: this.M, y: fy + 30 }, end: { x: 612 - this.M, y: fy + 30 }, thickness: 0.5, color: HAIR });
      const wm = SELLER.dba;
      tracked(page, wm, { x: (612 - trackedWidth(semibold, wm, 8, 2.6)) / 2, y: fy + 12, size: 8, font: semibold, spacing: 2.6 });
      const contact = `${SELLER.email} · chasecontemporary.com`;
      page.drawText(contact, { x: (612 - regular.widthOfTextAtSize(contact, 7)) / 2, y: fy, size: 7, font: regular, color: GRAY });
      const pg = `${i + 1} of ${n}`;
      page.drawText(pg, { x: 612 - this.M - regular.widthOfTextAtSize(pg, 7), y: fy + 12, size: 7, font: regular, color: GRAY });
      if (!reviewed()) {
        const d = 'This template has not yet been reviewed by counsel.';
        page.drawText(d, { x: this.M, y: fy + 12, size: 7, font: regular, color: GRAY });
      }
    });
  }
}

async function start({ kind, number, date }) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fonts = {
    regular: await doc.embedFont(asset('fonts/nimbus-sans-novus-regular.ttf')),
    medium: await doc.embedFont(asset('fonts/nimbus-sans-novus-medium.ttf')),
    semibold: await doc.embedFont(asset('fonts/nimbus-sans-novus-semibold.ttf')),
  };
  const logo = await doc.embedPng(asset('img/logo-stacked.png'));
  return { doc, flow: new Flow(doc, fonts, logo, { kind, number, date }) };
}

const collectorName = (c) => [c?.salutation, c?.first_name, c?.last_name].filter(Boolean).join(' ') || c?.company || 'The Buyer';
const collectorAddress = (c) => [c?.company,
  c?.address_line1, c?.address_line2,
  [c?.city, c?.state, c?.zip].filter(Boolean).join(', '),
  c?.country].filter(Boolean).join(', ');
const realEmail = (c) => c?.email && !String(c.email).endsWith('import.chasecontemporary.com') ? c.email : null;
const workNames = (works, lines) => {
  const names = (works?.length ? works : (lines || []).filter(l => l.kind === 'work')).map(w => `${w.artist ? w.artist + ', ' : ''}${bareTitle(w)}`);
  return names.length ? names.join('; ') : 'the work described above';
};

// ---- purchase agreement -----------------------------------------------------------------
// invoice: invoices row (issued_at, due_at, invoice_number, deposit_cents, tax_cents, shipping_cents, amount_cents)
// lines: invoice_lines rows (kind work | service | shipping | tax | credit, title, artist, amount_cents)
// collector: collectors row. works: artworks rows for the work lines. sale: optional sales row.
export async function buildPurchaseAgreement({ invoice, lines = [], collector, works = [], sale = null, opts = {} }) {
  const num = String(invoice.invoice_number ?? '').padStart(4, '0');
  const issued = invoice.issued_at || new Date().toISOString();
  const due = invoice.due_at || new Date(new Date(issued).getTime() + DEFAULT_DUE_DAYS * 86400000).toISOString();
  const { doc, flow } = await start({ kind: 'PURCHASE AGREEMENT', number: num, date: longDate(issued) });
  const buyer = collectorName(collector);
  const plural = (works.length || lines.filter(l => l.kind === 'work').length) > 1;
  const WORK = plural ? 'the Works' : 'the Work';

  flow.para(`This Purchase Agreement (the "Agreement") is made on ${longDate(issued)} between the Seller and the Buyer named below for the sale of ${WORK.toLowerCase()} described in section 2. It accompanies and forms part of Invoice No. ${num}.`, { after: 4 });

  flow.heading('1. Parties');
  flow.kv('SELLER', `${SELLER.legal}, doing business as ${SELLER.dba} (the "Seller"), ${SELLER.email}`);
  flow.kv('BUYER', [buyer + ' (the "Buyer")', collectorAddress(collector), realEmail(collector), collector?.phone].filter(Boolean).join(', '));

  flow.heading(`2. ${WORK}`);
  const workRows = works.length ? works : lines.filter(l => l.kind === 'work').map(l => ({ artist: l.artist, title: l.title }));
  for (const w of workRows) await flow.work(w);
  if (!workRows.length) flow.para('As described on the invoice.');

  flow.heading('3. Price and payment');
  const rows = lines.length ? lines : [{ kind: 'work', title: invoice.title, artist: invoice.artist, amount_cents: invoice.amount_cents },
    invoice.tax_cents ? { kind: 'tax', title: 'Sales tax', amount_cents: invoice.tax_cents } : null,
    invoice.shipping_cents ? { kind: 'shipping', title: 'Shipping', amount_cents: invoice.shipping_cents } : null].filter(Boolean);
  const label = (l) => l.kind === 'work' ? `${l.artist ? l.artist + ', ' : ''}${bareTitle(l)}`
    : l.kind === 'tax' ? (l.title || 'Sales tax') : l.kind === 'shipping' ? (l.title || 'Shipping and crating')
    : l.kind === 'credit' ? (l.title || 'Credit') : (l.title || 'Service');
  for (const l of rows) flow.money(label(l), Number(l.amount_cents || 0));
  const total = rows.reduce((s, l) => s + Number(l.amount_cents || 0), 0);
  flow.gap(2);
  flow.ensure(16); flow.page.drawLine({ start: { x: 612 - flow.M - 190, y: flow.y + 10 }, end: { x: 612 - flow.M, y: flow.y + 10 }, thickness: 0.7, color: INK });
  flow.money('Total purchase price', total, { bold: true, size: 10.5, lh: 18 });
  const deposit = Number(invoice.deposit_cents || 0);
  if (deposit > 0 && deposit < total) {
    flow.ensure(34);                                   // deposit and balance stay together
    flow.money('Deposit, due on signing', deposit);
    flow.money('Balance, due ' + longDate(due), total - deposit);
  }
  flow.gap(6);
  const wire = process.env.WIRE_INSTRUCTIONS ? 'Payment is by wire transfer to: ' + process.env.WIRE_INSTRUCTIONS.replace(/\s*\n\s*/g, ', ') : 'Payment is by wire transfer as stated on the invoice.';
  flow.para(`${deposit > 0 && deposit < total
    ? `The Buyer pays the deposit on signing and the balance no later than ${longDate(due)}.`
    : `The full purchase price is due no later than ${longDate(due)}.`} ${wire} Please reference Invoice No. ${num} with each payment. Bank charges are for the Buyer's account.`);

  flow.heading('4. Title and risk');
  flow.para(`Title to ${WORK} stays with the Seller and passes to the Buyer only when the Seller has received the full purchase price in cleared funds. Until then the Buyer holds ${WORK} in trust for the Seller and may not sell, pledge or part with possession of it. Risk of loss or damage passes to the Buyer when ${WORK} is delivered to the Buyer or to the Buyer's carrier. The Seller keeps ${WORK} insured until that moment.`);

  flow.heading('5. Delivery and inspection');
  flow.para(`Unless the invoice states otherwise, the Seller arranges packing, crating and shipping at the Buyer's cost and does not release ${WORK} until the purchase price is paid in full. The Buyer inspects ${WORK} on delivery and reports any damage or discrepancy to the Seller in writing within ${INSPECTION_DAYS} days of delivery; after that ${WORK} is deemed accepted in the condition delivered.`);

  flow.heading('6. Sales tax');
  flow.para(`Sales tax, where the Seller is required to collect it, is stated on the invoice. Where the Seller does not collect tax on this sale, the Buyer is responsible for any use tax or similar tax due in the jurisdiction where ${WORK} is delivered or kept.`);

  flow.heading('7. Authenticity and title');
  flow.para(`The Seller warrants that ${WORK} is an authentic work by the artist named, that the Seller owns ${WORK} outright and has the right to sell it, and that it passes to the Buyer free of any lien or claim. A certificate of authenticity issued by the Seller is delivered with ${WORK}. Apart from this warranty, ${WORK} is sold as described and as inspected, and no other warranty is given.`);

  flow.heading('8. Returns');
  flow.para('All sales are final. The Buyer has no right to return or exchange except as required by law or as the Seller agrees in writing.');

  flow.heading('9. Default');
  flow.para(`If any part of the purchase price is not paid by its due date, the Seller may, at its choice and after written notice, cancel this Agreement and keep any deposit paid as liquidated damages, or hold the Buyer to the purchase and charge interest on the overdue balance at ${LATE_INTEREST}, or resell ${WORK} and recover any shortfall and costs from the Buyer. The Seller may also suspend delivery until paid in full.`);

  flow.heading('10. Governing law');
  flow.para(`This Agreement is governed by ${GOVERNING_LAW.law}. The parties submit to the exclusive jurisdiction of ${GOVERNING_LAW.venue}.`);

  flow.heading('11. General');
  flow.para('This Agreement together with the invoice is the entire agreement between the parties about this sale and replaces any earlier discussion. Changes are valid only in writing signed by both parties. It may be signed in counterparts and by electronic signature, each of which counts as an original. If any clause is found unenforceable the rest stands.');

  flow.signatures({ buyer });
  flow.finish();
  void opts; void sale;
  return await doc.save();
}

// ---- on-approval agreement --------------------------------------------------------------
// hold: holds row (kind 'approval', placed_at, expires_at, out_to, deposit_cents), collector, artwork.
// opts.price_cents overrides the artwork price for the approval period.
export async function buildApprovalAgreement({ hold, collector, artwork, opts = {} }) {
  const from = hold?.placed_at || new Date().toISOString();
  const returnBy = hold?.expires_at || new Date(new Date(from).getTime() + 7 * 86400000).toISOString();
  const priceCents = Number(opts.price_cents || artwork?.price_cents || 0);
  const price = priceCents > 0 ? usd(priceCents) : null;
  const ref = inventoryNo(artwork) || String(artwork?.id || '').slice(0, 8).toUpperCase();
  const { doc, flow } = await start({ kind: 'ON APPROVAL AGREEMENT', number: ref, date: longDate(from) });
  const buyer = collectorName(collector) || hold?.out_to || 'The Buyer';

  flow.para(`This On Approval Agreement (the "Agreement") is made on ${longDate(from)} between the Seller and the Buyer named below. The Seller releases the work described in section 2 (the "Work") to the Buyer for viewing in place, on the terms below, before any decision to purchase.`, { after: 4 });

  flow.heading('1. Parties');
  flow.kv('SELLER', `${SELLER.legal}, doing business as ${SELLER.dba} (the "Seller"), ${SELLER.email}`);
  flow.kv('BUYER', [buyer + ' (the "Buyer")', collectorAddress(collector), realEmail(collector), collector?.phone].filter(Boolean).join(', '));

  flow.heading('2. The work');
  await flow.work(artwork || { title: 'Untitled' });

  flow.heading('3. Approval period');
  flow.kv('FROM', longDate(from));
  flow.kv('RETURN BY', longDate(returnBy));
  flow.para(`The approval period runs from delivery of the Work to the Buyer until ${longDate(returnBy)} (the "Return Date"). The Seller may extend it in writing.`);

  flow.heading('4. Price');
  flow.para(price
    ? `The price of the Work during the approval period is ${price}, plus any applicable sales tax and delivery costs. The price is held for the Buyer until the Return Date.`
    : 'The price of the Work during the approval period is as agreed in writing between the parties, plus any applicable sales tax and delivery costs, and is held for the Buyer until the Return Date.');

  flow.heading('5. Custody and care');
  flow.para('The Buyer holds the Work in trust for the Seller. The Buyer keeps the Work in a climate-controlled private residence, out of direct sunlight, away from heat, damp and smoke, and does not clean, conserve, frame, reframe, alter, photograph for publication, lend, exhibit or move the Work to another address without the Seller’s written consent. Only the Seller or a carrier approved by the Seller handles, packs or transports the Work.');

  flow.heading('6. Insurance');
  flow.para(`From delivery until the Work is back in the Seller’s possession, the Buyer insures the Work for its full price${price ? ` (${price})` : ''} against all risks, with the Seller named as loss payee, and provides evidence of cover on request. The Buyer is liable to the Seller for any loss or damage during that time up to the full price.`);

  flow.heading('7. Return or purchase');
  flow.para(`By the Return Date the Buyer either returns the Work to the Seller at the Buyer’s cost, in its original packing and in the condition delivered, or tells the Seller in writing that the Buyer elects to purchase, on which the Seller issues an invoice and the sale proceeds under the Seller’s purchase terms. If the Work is neither returned nor the purchase confirmed by the Return Date, the Seller may collect the Work at the Buyer’s cost or treat the Buyer as having elected to purchase.`);

  flow.heading('8. Title and risk');
  flow.para('Title to the Work stays with the Seller throughout the approval period and passes only under a separate invoice paid in full. Risk of loss or damage is with the Buyer from delivery until the Work is back in the Seller’s possession.');

  flow.heading('9. Governing law');
  flow.para(`This Agreement is governed by ${GOVERNING_LAW.law}. The parties submit to the exclusive jurisdiction of ${GOVERNING_LAW.venue}.`);

  flow.heading('10. General');
  flow.para('This Agreement is the entire agreement between the parties about the approval period. Changes are valid only in writing signed by both parties. It may be signed in counterparts and by electronic signature, each of which counts as an original. If any clause is found unenforceable the rest stands.');

  flow.signatures({ buyer });
  flow.finish();
  return await doc.save();
}
