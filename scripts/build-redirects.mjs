// The 939 URLs the old site left behind.
//
// Every one of them returns 404 today and there is not a single redirect configured on the
// store. That is a decade of accumulated links, citations and search history pointing at
// nothing. It is the largest single SEO loss the gallery has, and it costs nothing to fix.
//
// The rule: send a dead URL somewhere genuinely relevant or leave it dead. A redirect to
// something unrelated is read as a soft 404 and is worse than the 404 it replaced, so an
// artist goes to that artist, a work goes to that work when we still have it and to its artist
// when we do not, and an exhibition goes to the exhibitions archive. Anything with no honest
// destination is left alone and reported.
//
//   SHOPIFY_ADMIN_TOKEN=... SHOPIFY_STORE=... node scripts/build-redirects.mjs [--apply]

import { readFileSync } from 'node:fs';

const SHOP = process.env.SHOPIFY_STORE || 'pix2wa-vt.myshopify.com';
const T = process.env.SHOPIFY_ADMIN_TOKEN;
const apply = process.argv.includes('--apply');
const INVENTORY = new URL('../research/chase-contemporary/legacy-site-url-inventory.md', import.meta.url);

const api = async (path, method = 'GET', body) => {
  for (let attempt = 0; attempt < 6; attempt++) {
    const r = await fetch(`https://${SHOP}/admin/api/2024-10${path}`, {
      method, headers: { 'X-Shopify-Access-Token': T, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (r.status === 429) { await new Promise(s => setTimeout(s, 1200 * (attempt + 1))); continue; }
    const text = await r.text();
    let json = null; try { json = JSON.parse(text); } catch {}
    if (!r.ok) throw new Error(`${r.status} ${text.slice(0, 160)}`);
    return json;
  }
  throw new Error('rate limited repeatedly');
};

// everything the shop can be pointed at
const pageAll = async (resource, fields) => {
  const out = [];
  let url = `/${resource}.json?limit=250&fields=${fields}`;
  while (url) {
    const r = await fetch(`https://${SHOP}/admin/api/2024-10${url}`, { headers: { 'X-Shopify-Access-Token': T } });
    const body = await r.json();
    out.push(...(body[resource] || []));
    const link = r.headers.get('link') || '';
    const next = link.split(',').find(s => s.includes('rel="next"'));
    url = next ? next.slice(next.indexOf('<') + 1, next.indexOf('>')).replace(`https://${SHOP}/admin/api/2024-10`, '') : null;
  }
  return out;
};

const [products, customCollections, smartCollections, pages] = await Promise.all([
  pageAll('products', 'id,handle,title,vendor'),
  pageAll('custom_collections', 'id,handle,title'),
  pageAll('smart_collections', 'id,handle,title'),
  pageAll('pages', 'id,handle,title'),
]);
const collections = [...customCollections, ...smartCollections];
const productByHandle = new Map(products.map(p => [p.handle, p]));
const collectionByHandle = new Map(collections.map(c => [c.handle, c]));
const pageByHandle = new Map(pages.map(p => [p.handle, p]));
console.log(`\nthe shop offers ${products.length} products, ${collections.length} collections, ${pages.length} pages`);

// a loose match, because old slugs and new handles rarely agree exactly
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const productByNorm = new Map(); products.forEach(p => { productByNorm.set(norm(p.handle), p); productByNorm.set(norm(p.title), p); });
const collectionByNorm = new Map(); collections.forEach(c => { collectionByNorm.set(norm(c.handle), c); collectionByNorm.set(norm(c.title), c); });

const paths = [...readFileSync(INVENTORY, 'utf8').matchAll(/^- `([^`]+)`/gm)].map(m => m[1]);
console.log(`${paths.length} dead paths in the inventory\n`);

const EXHIBITIONS = pageByHandle.has('exhibitions') ? '/pages/exhibitions' : null;
const PRESS = pageByHandle.has('press') ? '/pages/press' : null;
const ARTISTS = '/collections';

function target(path) {
  const seg = path.replace(/^\/+|\/+$/g, '').split('/');
  const [head, ...rest] = seg;
  const last = rest[rest.length - 1] || '';
  const cleaned = last.replace(/^sold-+/, '');       // old "sold--the-commander" slugs

  if (head === 'artistpage' || head === 'artists' || head === 'artists-new') {
    const artist = rest[0] || '';
    if (rest.length >= 2) {
      const work = productByNorm.get(norm(cleaned));
      if (work) return { to: `/products/${work.handle}`, why: 'the work itself' };
    }
    const col = collectionByNorm.get(norm(artist));
    if (col) return { to: `/collections/${col.handle}`, why: 'that artist' };
    const pg = pageByHandle.get(artist);
    if (pg) return { to: `/pages/${pg.handle}`, why: 'that artist' };
    return { to: ARTISTS, why: 'the artist list' };
  }
  if (head === 'exhibition' || head === 'exhibitions' || head === 'past-exhibitions' || head === 'art-fairs') {
    // an exhibition named after an artist we still carry is better sent to that artist
    const col = collectionByNorm.get(norm(last));
    if (col) return { to: `/collections/${col.handle}`, why: 'the artist it was about' };
    return EXHIBITIONS ? { to: EXHIBITIONS, why: 'the exhibitions archive' } : null;
  }
  if (head === 'news') {
    const col = collectionByNorm.get(norm(last));
    if (col) return { to: `/collections/${col.handle}`, why: 'the artist it was about' };
    return { to: '/blogs/news', why: 'the journal' };
  }
  return null;
}

const plan = [];
const orphans = [];
for (const p of paths) {
  const t = target(p);
  if (t) plan.push({ from: p, ...t }); else orphans.push(p);
}
const byWhy = {};
plan.forEach(r => { byWhy[r.why] = (byWhy[r.why] || 0) + 1; });
console.log('where they would go:');
Object.entries(byWhy).sort((a, b) => b[1] - a[1]).forEach(([w, n]) => console.log(`  ${String(n).padStart(4)}  ${w}`));
console.log(`  ${String(orphans.length).padStart(4)}  left as 404, no honest destination`);
console.log('\na sample:');
plan.slice(0, 6).forEach(r => console.log(`  ${r.from}\n      -> ${r.to}  (${r.why})`));

if (!apply) { console.log('\nDry run. Pass --apply to create them.\n'); process.exit(0); }

const existing = new Set((await pageAll('redirects', 'id,path')).map(r => r.path.toLowerCase()));
let made = 0, skipped = 0, failed = 0;
for (const r of plan) {
  if (existing.has(r.from.toLowerCase())) { skipped++; continue; }
  try {
    await api('/redirects.json', 'POST', { redirect: { path: r.from, target: r.to } });
    made++;
    if (made % 50 === 0) console.log(`  ${made} created`);
  } catch (e) {
    failed++;
    if (failed <= 5) console.log(`  failed ${r.from}: ${String(e.message).slice(0, 100)}`);
  }
  await new Promise(s => setTimeout(s, 220));       // stay inside the Admin API leaky bucket
}
console.log(`\n${made} redirects created, ${skipped} already existed, ${failed} failed.\n`);
