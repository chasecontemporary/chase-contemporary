// Put the exhibition history back on the site.
//
// 65 shows were recovered from the archive with their dates and their original press text. They
// go up as one page each plus an index, because that history is the evidence behind everything
// the gallery says about itself, and because 303 dead URLs currently point at one generic page
// for want of somewhere specific to go.
//
// Nothing here invents anything. Where the archive had no date, the page carries no date.
//
//   SHOPIFY_ADMIN_TOKEN=... SHOPIFY_STORE=... node scripts/publish-exhibitions.mjs [--apply]

import { readFileSync } from 'node:fs';

const SHOP = process.env.SHOPIFY_STORE || 'pix2wa-vt.myshopify.com';
const T = process.env.SHOPIFY_ADMIN_TOKEN;
const apply = process.argv.includes('--apply');
const DATA = new URL('../research/chase-contemporary/exhibitions-recovered.json', import.meta.url);

const api = async (path, method = 'GET', body) => {
  for (let a = 0; a < 6; a++) {
    const r = await fetch(`https://${SHOP}/admin/api/2024-10${path}`, {
      method, headers: { 'X-Shopify-Access-Token': T, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined });
    if (r.status === 429) { await new Promise(s => setTimeout(s, 1200 * (a + 1))); continue; }
    const text = await r.text();
    if (!r.ok) throw new Error(`${r.status} ${text.slice(0, 150)}`);
    return text ? JSON.parse(text) : null;
  }
  throw new Error('rate limited');
};

const MONTHS = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7,
  august: 8, september: 9, october: 10, november: 11, december: 12 };

// "May 18 -June 18, 2023" and "September 18 – October 10, 2021" and "November 2-November 19, 2023"
function parseRange(s) {
  if (!s) return {};
  const year = (s.match(/(\d{4})\s*$/) || [])[1];
  if (!year) return {};
  const parts = s.replace(/,?\s*\d{4}\s*$/, '').split(/\s*[-–—]|\s+to\s+/).map(x => x.trim()).filter(Boolean);
  const one = (txt, fallbackMonth) => {
    const m = txt.match(/([A-Za-z]+)?\s*(\d{1,2})/);
    if (!m) return null;
    const mon = m[1] ? MONTHS[m[1].toLowerCase()] : fallbackMonth;
    if (!mon) return null;
    return { mon, day: Number(m[2]) };
  };
  const a = one(parts[0]);
  if (!a) return {};
  const b = parts[1] ? one(parts[1], a.mon) : null;
  const iso = (d, yr) => `${yr}-${String(d.mon).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
  // a show that runs Dec into Jan crosses the year
  const endYear = b && b.mon < a.mon ? Number(year) + 1 : Number(year);
  return { start: iso(a, year), end: b ? iso(b, endYear) : null };
}

const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const slugOf = (p) => decodeURIComponent(p.split('/')[2] || '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);

const rows = JSON.parse(readFileSync(DATA, 'utf8'))
  .filter(x => x.title && x.length > 120)
  .map(x => {
    // the press text runs until the page starts repeating the artist's biography
    let body = x.description;
    // the press text runs until the page starts repeating the artist's biography, which lives
    // on the artist's own page already and reads oddly as the description of a show
    // Cut wherever the artist biography starts, however early. Some shows have no press text
    // at all in the archive, and a page padded out with the bio that already lives on the
    // artist's own page is duplicate content pretending to be a record.
    const cut = body.search(/\bAbout\s+[A-Z][A-Za-z'\u2019.\-]+(\s+[A-Z][A-Za-z'\u2019.\-]+){0,3}\b/);
    const intro = cut > 40 ? body.slice(0, cut).trim() : (cut === -1 ? body.trim() : '');
    const reception = (intro.match(/RECEPTION\s+([^A-Z]{0,60}?)(?=\s+LOCATION|\s+[A-Z]{4,})/) || [])[1]?.trim() || null;
    const location = (intro.match(/LOCATION\s+(.{5,70}?)(?=\s+Inquire|\s+[A-Z]{4,}|$)/) || [])[1]?.trim() || null;
    let text = intro
      .replace(/^RECEPTION\s+.*?(?=Chase Contemporary|[A-Z][a-z])/s, '')
      .replace(/Inquire for Available Works/gi, '')
      .replace(/\s+/g, ' ').trim();
    return { ...x, slug: slugOf(x.path), intro: text, reception, location, ...parseRange(x.dates) };
  })
  .filter(x => x.slug && x.title)
  .sort((a, b) => String(b.start || '').localeCompare(String(a.start || '')));

// The same show was sometimes archived twice, under two sections or with a typo in the slug.
// Keep the one with the fuller text so the archive lists each exhibition once.
const key = (t) => String(t).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 26);
// a typo in an old slug should not put the same show on the site twice, so near matches on the
// same dates are treated as the same show
const near = (a, b) => {
  if (Math.abs(a.length - b.length) > 3) return false;
  let d = 0, i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++d > 2) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return d + (a.length - i) + (b.length - j) <= 2;
};
const best = new Map();
for (const r of rows) {
  const k = key(r.title);
  let match = best.has(k) ? k : null;
  if (!match) for (const [ek, ev] of best) {
    if (r.start && ev.start === r.start && near(ek, k)) { match = ek; break; }
  }
  const prev = match ? best.get(match) : null;
  if (!prev) { best.set(k, r); continue; }
  // Merge rather than pick a winner. One snapshot often has the fuller press text while the
  // other has the better title and the complete date range, and one of these pairs differs only
  // by a typo in the artist's name, which must not be what goes on the site.
  best.set(match, {
    ...prev,
    intro: r.intro.length > prev.intro.length ? r.intro : prev.intro,
    title: r.title.length >= prev.title.length && r.dates && prev.dates && r.dates.length > prev.dates.length ? r.title
         : (prev.dates && r.dates && prev.dates.length >= r.dates.length ? prev.title : r.title),
    dates: (r.dates || '').length > (prev.dates || '').length ? r.dates : prev.dates,
    location: prev.location || r.location,
    reception: prev.reception || r.reception,
    slug: (prev.dates || '').length >= (r.dates || '').length ? prev.slug : r.slug,
  });
}
const deduped = [...best.values()].sort((a, b) => String(b.start || '').localeCompare(String(a.start || '')));
console.log(`  ${rows.length - deduped.length} duplicate listings folded together`);
rows.length = 0; rows.push(...deduped);

console.log(`\n${rows.length} exhibitions ready to publish`);
console.log(`  with parsed start dates: ${rows.filter(r => r.start).length}`);
console.log(`  with a location on file: ${rows.filter(r => r.location).length}\n`);
rows.slice(0, 5).forEach(r => console.log(`  ${(r.start || '????').padEnd(11)} ${r.title.slice(0, 44).padEnd(46)} ${r.intro.length} chars`));

if (!apply) { console.log('\nDry run. Pass --apply to publish.\n'); process.exit(0); }

const existing = new Map();
let url = '/pages.json?limit=250&fields=id,handle';
while (url) {
  const r = await fetch(`https://${SHOP}/admin/api/2024-10${url}`, { headers: { 'X-Shopify-Access-Token': T } });
  const b = await r.json();
  (b.pages || []).forEach(p => existing.set(p.handle, p.id));
  const link = r.headers.get('link') || '';
  const next = link.split(',').find(s => s.includes('rel="next"'));
  url = next ? next.slice(next.indexOf('<') + 1, next.indexOf('>')).replace(`https://${SHOP}/admin/api/2024-10`, '') : null;
}

let made = 0, updated = 0;
for (const r of rows) {
  const handle = `exhibition-${r.slug}`.slice(0, 100);
  const when = r.dates ? `<p class="exh-dates">${esc(r.dates)}</p>` : '';
  const where = r.location ? `<p class="exh-where">${esc(r.location)}</p>` : '';
  const recep = r.reception ? `<p class="exh-recep">Opening reception ${esc(r.reception)}</p>` : '';
  const prose = r.intro.length > 80 ? `<p>${esc(r.intro)}</p>` : '';
  const body = `${when}${where}${recep}${prose}
<p><a href="/pages/exhibitions">All exhibitions</a> · <a href="/collections">Artists</a></p>`;
  const page = { title: r.title, handle, body_html: body, published: true };
  try {
    if (existing.has(handle)) { await api(`/pages/${existing.get(handle)}.json`, 'PUT', { page: { id: existing.get(handle), ...page } }); updated++; }
    else { await api('/pages.json', 'POST', { page }); made++; }
  } catch (e) { console.log(`  failed ${handle}: ${String(e.message).slice(0, 90)}`); }
  await new Promise(s => setTimeout(s, 260));
}

// the index
const items = rows.map(r => `<li><a href="/pages/exhibition-${r.slug}">${esc(r.title)}</a>${r.dates ? ` <span class="exh-when">${esc(r.dates)}</span>` : ''}</li>`).join('\n');
const index = `<p>Chase Contemporary has presented the exhibitions below since 2017, in Chelsea, at the SoHo flagship at 413 West Broadway, in East Hampton and in Palm Beach, and through art fair presentations. The gallery was founded by <a href="/pages/bernie-chase">Bernie Chase</a>.</p>
<ul class="exh-list">
${items}
</ul>`;
const exId = existing.get('exhibitions');
if (exId) await api(`/pages/${exId}.json`, 'PUT', { page: { id: exId, body_html: index } });

console.log(`\n${made} pages created, ${updated} updated, index rebuilt with ${rows.length} exhibitions.\n`);
