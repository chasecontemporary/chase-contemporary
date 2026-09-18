// Sold-sync, against the LIVE store and the live website. Run after touching settlement,
// lib/shopify.js or the publishing pipeline.
//
//   CRM_ACCESS_CODE=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SHOPIFY_ADMIN_TOKEN=... \
//     node scripts/test-sold-sync.mjs
//
// Sold-sync, against the live store. The thing the token was for: a work that sells must stop
// being offered on chasecontemporary.com, and an undo must put it back exactly as it was.
// Synthetic collector, real work, everything restored at the end.
const APP = 'https://chase-engine.vercel.app';
const SHOP = 'pix2wa-vt.myshopify.com';
const T = process.env.SHOPIFY_ADMIN_TOKEN;
const URL_ = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
const rest = (p, o = {}) => fetch(URL_ + '/rest/v1/' + p, { ...o, headers: { ...H, ...(o.headers || {}) } });
const get = async (p) => (await rest(p)).json();
const shop = async (p) => (await fetch(`https://${SHOP}/admin/api/2024-10${p}`, { headers: { 'X-Shopify-Access-Token': T } })).json();

let pass = 0, fail = 0;
const ok = (n, c, x = '') => { c ? pass++ : fail++; console.log((c ? '  PASS  ' : '  FAIL  ') + n + (x ? ' :: ' + x : '')); };

const login = await fetch(APP + '/api/login', { method: 'POST', redirect: 'manual',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ code: process.env.CRM_ACCESS_CODE, back: '/today' }) });
const cookie = [...(login.headers.getSetCookie?.() || []).map(c => c.split(';')[0]), 'cc_rep=Wyatt'].join('; ');
const act = async (f) => {
  const r = await fetch(APP + '/api/act', { method: 'POST', redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie, Accept: 'application/json' },
    body: new URLSearchParams({ ...f, back: 'json' }) });
  let b = {}; try { b = JSON.parse(await r.text()); } catch {}
  return { status: r.status, body: b };
};

console.log('\nSOLD SYNC, against the live store\n');

// a real work that is actually live on the website right now
const live = await get('artworks?select=id,title,artist,price_cents,shopify_product_id,available,site_status&shopify_product_id=not.is.null&available=eq.true&price_cents=gt.100000&limit=1');
const work = live[0];
ok('a real work that is on the website', !!work?.shopify_product_id, work ? `${work.artist} · ${work.title}` : 'none found');
const before = await shop(`/products/${work.shopify_product_id}.json`);
const statusBefore = before?.product?.status;
ok('it is active on Shopify before we start', statusBefore === 'active', 'status ' + statusBefore);

const stamp = Date.now();
const [collector] = await (await rest('collectors', { method: 'POST', headers: { Prefer: 'return=representation' },
  body: JSON.stringify({ email: `soldsync-${stamp}@import.chasecontemporary.com`, first_name: 'Sold', last_name: 'Sync' }) })).json();

// sell it
const inv = await act({ action: 'invoice_manual', collector_id: collector.id,
  lines: JSON.stringify([{ kind: 'work', artwork_id: work.id, title: work.title, artist: work.artist, amount: String(work.price_cents / 100) }]) });
ok('invoiced', inv.status === 200 && inv.body.ok, JSON.stringify(inv.body).slice(0, 120));
const [invRow] = await get(`invoices?select=id,sale_id&collector_id=eq.${collector.id}&order=issued_at.desc&limit=1`);
const paid = await act({ action: 'invoice_paid', id: invRow.id });
ok('marked paid in full', paid.status === 200, JSON.stringify(paid.body).slice(0, 120));

await new Promise(r => setTimeout(r, 2500));
const after = await shop(`/products/${work.shopify_product_id}.json`);
ok('THE WORK IS OFF THE WEBSITE', after?.product?.status === 'draft', 'status ' + after?.product?.status);
const [a1] = await get(`artworks?select=available,site_status&id=eq.${work.id}`);
ok('the engine agrees it is sold', a1.available === false, `available ${a1.available}, site ${a1.site_status}`);

// The public page stops resolving too, but Shopify's CDN can serve the cached copy for a
// short while after the product is drafted, so this is checked against a work that has been
// draft for a while rather than the one we just sold a second ago.
// Whether the page is already gone from the public internet is Shopify's CDN to decide, not
// the engine's, and the edge can serve a cached copy for a while after a product is drafted.
// It is reported, never asserted: a flaky test is worse than no test, and the thing the engine
// is actually responsible for, the product being draft, is asserted above.
const { products: drafted } = await shop('/products.json?status=draft&limit=10&fields=handle');
const older = (drafted || []).map(d => d.handle).filter(h => h && h !== before.product.handle)[0];
if (older) {
  const pub = await fetch(`https://www.chasecontemporary.com/products/${older}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  console.log(`  note   a work that has been draft a while serves HTTP ${pub.status} publicly${pub.status === 404 ? '' : ', which is the edge cache, not the shop'}`);
}

// undo
const undo = await act({ action: 'invoice_unsettle', id: invRow.id });
ok('payment undone', undo.status === 200, JSON.stringify(undo.body).slice(0, 120));
await new Promise(r => setTimeout(r, 2500));
const back = await shop(`/products/${work.shopify_product_id}.json`);
ok('THE WORK IS BACK ON THE WEBSITE', back?.product?.status === 'active', 'status ' + back?.product?.status);
const [a2] = await get(`artworks?select=available&id=eq.${work.id}`);
ok('the engine has it for sale again', a2.available === true);

// teardown
await rest(`documents?invoice_id=eq.${invRow.id}`, { method: 'DELETE' });
await rest(`payments?invoice_id=eq.${invRow.id}`, { method: 'DELETE' });
await rest(`invoice_lines?invoice_id=eq.${invRow.id}`, { method: 'DELETE' });
await rest(`invoices?id=eq.${invRow.id}`, { method: 'DELETE' });
if (invRow.sale_id) { await rest(`sale_items?sale_id=eq.${invRow.sale_id}`, { method: 'DELETE' }); await rest(`sales?id=eq.${invRow.sale_id}`, { method: 'DELETE' }); }
await rest(`purchases?collector_id=eq.${collector.id}`, { method: 'DELETE' });
await rest(`commissions?collector_id=eq.${collector.id}`, { method: 'DELETE' });
await rest(`activities?entity_type=eq.collector&entity_id=eq.${collector.id}`, { method: 'DELETE' });
await rest(`collectors?id=eq.${collector.id}`, { method: 'DELETE' });
await rest(`artworks?id=eq.${work.id}`, { method: 'PATCH', body: JSON.stringify({ available: true, site_status: work.site_status }) });

const final = await shop(`/products/${work.shopify_product_id}.json`);
const [leftC] = await get(`collectors?select=id&id=eq.${collector.id}`) || [];
ok('teardown clean and the work is exactly as we found it', final?.product?.status === statusBefore && !leftC);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
