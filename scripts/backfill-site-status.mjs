// The publishing pipeline was built after 186 works were already on the website, so those works
// had a Shopify product and no site_status at all. Two consequences, both wrong: the approvals
// page said nothing was on the site, and the queue would have offered Bernie works that are
// already public, asking him to approve what collectors can already see.
//
// This reads the truth from the shop and writes it down, once:
//   active on Shopify  -> live
//   draft on Shopify   -> held, with a note, because a drafted product was somebody's decision
//                         to take it down and the queue must not quietly undo that
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SHOPIFY_ADMIN_TOKEN=... SHOPIFY_STORE=... \
//     node scripts/backfill-site-status.mjs [--apply]

const SHOP = process.env.SHOPIFY_STORE || 'pix2wa-vt.myshopify.com';
const T = process.env.SHOPIFY_ADMIN_TOKEN;
const URL_ = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
const rest = (p, o = {}) => fetch(URL_ + '/rest/v1/' + p, { ...o, headers: { ...H, ...(o.headers || {}) } });
const apply = process.argv.includes('--apply');

// every product in the shop, paged
const products = {};
let url = `https://${SHOP}/admin/api/2024-10/products.json?limit=250&fields=id,status,handle`;
while (url) {
  const r = await fetch(url, { headers: { 'X-Shopify-Access-Token': T } });
  const body = await r.json();
  for (const p of body.products || []) products[String(p.id)] = p;
  const link = r.headers.get('link') || '';
  const next = link.split(',').find(s => s.includes('rel="next"'));
  url = next ? next.slice(next.indexOf('<') + 1, next.indexOf('>')) : null;
}
console.log(`\n${Object.keys(products).length} products in the shop`);

const rows = await (await rest('artworks?select=id,title,artist,shopify_product_id,site_status,available&shopify_product_id=not.is.null&limit=2000')).json();
console.log(`${rows.length} works in the engine carry a product id\n`);

const plan = { live: [], held: [], missing: [], already: [] };
for (const a of rows) {
  if (a.site_status) { plan.already.push(a); continue; }
  const p = products[String(a.shopify_product_id)];
  if (!p) { plan.missing.push(a); continue; }
  (p.status === 'active' ? plan.live : plan.held).push(a);
}
console.log(`  already had a status : ${plan.already.length}`);
console.log(`  active, so live      : ${plan.live.length}`);
console.log(`  draft, so held       : ${plan.held.length}`);
console.log(`  no longer in the shop: ${plan.missing.length}`);

if (!apply) { console.log('\nDry run. Pass --apply to write it.\n'); process.exit(0); }

const set = async (list, patch) => {
  for (let i = 0; i < list.length; i += 100) {
    const ids = list.slice(i, i + 100).map(a => a.id);
    await rest(`artworks?id=in.(${ids.join(',')})`, { method: 'PATCH', body: JSON.stringify(patch) });
  }
};
if (plan.live.length) await set(plan.live, { site_status: 'live' });
if (plan.held.length) await set(plan.held, { site_status: 'held', review_note: 'Was already off the website before the approvals queue existed. Look at it again if it should go back up.' });
if (plan.missing.length) await set(plan.missing, { shopify_product_id: null });

console.log('\nWritten. The approvals page now reflects the shop.\n');
