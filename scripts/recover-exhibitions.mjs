// Recover the exhibition history from the archived site.
//
// The gallery's own About page claims more than fifty solo exhibitions and the site shows none
// of them. That history is the strongest thing it has: it is the evidence behind every claim
// about the programme, it is what an answer engine needs to say what this gallery has actually
// done, and 303 dead URLs currently point at one generic page for want of it.
//
// Reads the legacy inventory, pulls each exhibition's last archived snapshot from the Wayback
// Machine, and writes what it finds to a JSON file. It publishes nothing: a person reads the
// file first, because this is the gallery's public record and a scraper's guess about a date is
// not good enough to put on it.
//
//   node scripts/recover-exhibitions.mjs [--limit N]

import { readFileSync, writeFileSync } from 'node:fs';

const INVENTORY = new URL('../research/chase-contemporary/legacy-site-url-inventory.md', import.meta.url);
const OUT = new URL('../research/chase-contemporary/exhibitions-recovered.json', import.meta.url);
const limitArg = process.argv.indexOf('--limit');
const LIMIT = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity;

const lines = [...readFileSync(INVENTORY, 'utf8').matchAll(/^- `([^`]+)` — (\d+)/gm)].map(m => ({ path: m[1], ts: m[2] }));

// Only the exhibition itself, not the individual works hanging inside it: those are two
// segments deeper and are already redirected to the work or the artist.
const isExhibition = (p) => {
  const seg = p.replace(/^\/+|\/+$/g, '').split('/');
  return seg.length === 2 && ['exhibition', 'exhibitions', 'past-exhibitions'].includes(seg[0]);
};
const seen = new Set();
const targets = lines.filter(l => isExhibition(l.path)).filter(l => {
  const slug = decodeURIComponent(l.path.split('/')[2]).toLowerCase();
  if (seen.has(slug)) return false;                 // the same show archived under two sections
  seen.add(slug); return true;
}).slice(0, LIMIT);

console.log(`\n${targets.length} distinct exhibitions to recover\n`);

const clean = (h) => {
  let b = h.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
  b = b.replace(/<[^>]+>/g, ' ');
  b = b.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'")
       .replace(/&quot;|&ldquo;|&rdquo;/g, '"').replace(/&mdash;/g, ', ').replace(/&ndash;/g, ' to ');
  return b.replace(/\s+/g, ' ').trim();
};

// "June 23 – July 21, 2022" and the many ways the old site wrote it
const DATE = /((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:\s*[-–—to]+\s*(?:(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+)?\d{1,2})?,?\s+\d{4})/i;

const out = [];
let i = 0;
for (const t of targets) {
  i++;
  const url = `https://web.archive.org/web/${t.ts}/https://www.chasecontemporary.com${t.path}`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(45000) });
    if (!r.ok) { console.log(`  ${String(i).padStart(3)}. ${t.path}  HTTP ${r.status}`); continue; }
    const html = await r.text();
    // titles come back with html entities and the site name bolted on the end
    const title = clean(html.match(/<title>(.*?)<\/title>/s)?.[1] || '')
      .replace(/\s*[,|]?\s*Chase Contemporar(y|ies)\s*$/i, '')
      .replace(/\s*,\s*$/, '').trim();
    const text = clean(html);
    // the page chrome the old site put on every page, dropped so the body is the body
    const body = text.replace(/^.*?Use tab to navigate through the menu items\.\s*\d*\s*/s, '').trim();
    const dates = body.match(DATE)?.[1] || null;
    // the description is what follows the date line
    let desc = body;
    if (dates) desc = body.slice(body.indexOf(dates) + dates.length).trim();
    desc = desc.replace(/\s*(HOME|ARTISTS|EXHIBITIONS|ABOUT|More)\s*$/i, '').trim();
    out.push({ path: t.path, snapshot: t.ts, url, title, dates, description: desc.slice(0, 2200), length: desc.length });
    console.log(`  ${String(i).padStart(3)}. ${(title || t.path).slice(0, 52).padEnd(54)} ${dates || 'no date'}  ${desc.length} chars`);
  } catch (e) {
    console.log(`  ${String(i).padStart(3)}. ${t.path}  ${String(e.message).slice(0, 50)}`);
  }
  await new Promise(s => setTimeout(s, 700));       // the Wayback Machine is a charity, not a CDN
}

writeFileSync(OUT, JSON.stringify(out, null, 2));
const withDates = out.filter(o => o.dates).length;
const withText = out.filter(o => o.length > 200).length;
console.log(`\nrecovered ${out.length}: ${withDates} with a date, ${withText} with real description text`);
console.log(`written to ${OUT.pathname}\n`);
