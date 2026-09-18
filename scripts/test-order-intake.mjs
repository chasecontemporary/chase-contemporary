// Regression test for order intake: the path a stranger's card takes into the engine.
//
// Runs against production with no Shopify credentials: it calls the exported functions in
// crm/lib/orderIntake.js directly with order payloads shaped like the real thing, so the whole
// chain (collector, sale, invoice, payment, purchase, commission, work marked sold, reversal)
// is exercised without a webhook, a secret or a live store.
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/test-order-intake.mjs
//
// It creates one synthetic collector on the @import domain (excluded from every audience, can
// never be emailed), borrows two real works by lending them a Shopify product id, and puts
// every one of them back exactly as it found them.

import { register } from 'node:module';
import { fileURLToPath } from 'node:url';

const SB  = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SB || !KEY) {
  console.error('need SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// crm/lib is Next source: ES modules with extensionless relative imports. Node needs a nudge to
// resolve those outside the bundler, which is all this hook does.
register('data:text/javascript,' + encodeURIComponent(`
  export async function resolve(spec, ctx, next) {
    try { return await next(spec, ctx); }
    catch (e) { if (spec.startsWith('.')) return next(spec + '.js', ctx); throw e; }
  }
`), import.meta.url);

const LIB = fileURLToPath(new URL('../crm/lib/orderIntake.js', import.meta.url));
const { handleOrderPaid, handleRefund, handleOrderCancelled, ordersNeedingReview } = await import(LIB);

const rest = async (path, init = {}) => {
  const r = await fetch(`${SB}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`,
               'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const t = await r.text();
  return t ? JSON.parse(t) : null;
};
const del = (p) => rest(p, { method: 'DELETE' });
const patch = (p, body) => rest(p, { method: 'PATCH', body: JSON.stringify(body) });

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else    { fail++; console.log(`  FAIL  ${name}${detail ? '  · ' + detail : ''}`); }
};

const EMAIL = 'orderintake-test@import.chasecontemporary.com';
// artworks.shopify_product_id is a bigint, so the borrowed ids are numbers no real Shopify
// product would carry. They are handed back at teardown.
const PID_EDITION  = 9900000000001;
const PID_ORIGINAL = 9900000000002;

// ---------- setup ----------
const [edition] = await rest('artworks?available=is.true&is_edition=is.true&price_cents=gt.0&select=id,title,artist,price_cents,shopify_product_id,site_status&limit=1');
const [original] = await rest('artworks?available=is.true&is_edition=is.false&price_cents=gt.0&select=id,title,artist,price_cents,shopify_product_id,site_status&limit=1');
if (!edition || !original) { console.error('no suitable works to borrow'); process.exit(1); }
const restore = [
  { id: edition.id,  shopify_product_id: edition.shopify_product_id,  site_status: edition.site_status },
  { id: original.id, shopify_product_id: original.shopify_product_id, site_status: original.site_status },
];
await patch(`artworks?id=eq.${edition.id}`,  { shopify_product_id: PID_EDITION });
await patch(`artworks?id=eq.${original.id}`, { shopify_product_id: PID_ORIGINAL });
console.log(`\n  edition:  ${edition.title}\n  original: ${original.title}\n`);

// A Shopify order, in the shape the Admin API actually delivers one.
const ORDER_IDS = [];
const order = (id, { productId, price, title, artist, attrs = [], name }) => {
  ORDER_IDS.push(String(id));
  return {
    id, name: name || `#TEST${id}`, email: EMAIL, currency: 'USD',
    financial_status: 'paid', total_price: (price / 100).toFixed(2), total_tax: '0.00',
    customer: { id: 900001, email: EMAIL, first_name: 'Order', last_name: 'Intake' },
    billing_address: { first_name: 'Order', last_name: 'Intake', address1: '1 Worth Ave',
      city: 'Palm Beach', province: 'Florida', zip: '33480', country: 'United States' },
    shipping_address: { first_name: 'Order', last_name: 'Intake', address1: '1 Worth Ave',
      city: 'Palm Beach', province: 'Florida', zip: '33480', country: 'United States' },
    line_items: [{ id: id * 10, product_id: productId, variant_id: id * 100, quantity: 1,
      price: (price / 100).toFixed(2), total_discount: '0.00', title, name: title, vendor: artist }],
    shipping_lines: [], note_attributes: attrs, buyer_accepts_marketing: false,
    created_at: new Date().toISOString(),
  };
};

const collectorRow = async () => (await rest(`collectors?email=eq.${EMAIL}&select=id,first_name,city,shipping_zip`))[0];
const orderRow = async (oid) => (await rest(`shopify_orders?shopify_order_id=eq.${oid}&select=*`))[0];
const invoiceRow = async (iid) => (await rest(`invoices?id=eq.${iid}&select=id,status,amount_cents,sale_id,collector_id,method,void_reason`))[0];
const artRow = async (aid) => (await rest(`artworks?id=eq.${aid}&select=available,site_status`))[0];

// ---------- 1. a real edition, bought by a stranger ----------
const o1 = order(9900001, { productId: PID_EDITION, price: edition.price_cents,
  title: edition.title, artist: edition.artist });
const r1 = await handleOrderPaid(o1);
const c = await collectorRow();
check('the order creates the collector it has never seen', !!c && c.first_name === 'Order', c ? '' : 'no collector');
check('the collector carries the checkout address', c?.city === 'Palm Beach' && c?.shipping_zip === '33480');
const row1 = await orderRow(o1.id);
check('the order is on the ledger with its invoice', !!row1?.invoice_id && !!row1?.sale_id && row1.needs_review === false);
const inv1 = await invoiceRow(row1.invoice_id);
check('the invoice is paid for the full amount', inv1?.status === 'paid' && inv1.amount_cents === edition.price_cents,
  `status ${inv1?.status} amount ${inv1?.amount_cents}`);
const pays1 = await rest(`payments?invoice_id=eq.${row1.invoice_id}&select=amount_cents,status,method,external_ref`);
check('a settled card payment is recorded', pays1.length === 1 && pays1[0].status === 'settled'
  && pays1[0].method === 'card, shopify' && pays1[0].external_ref === `shopify:${o1.id}`,
  JSON.stringify(pays1));
const items1 = await rest(`sale_items?sale_id=eq.${row1.sale_id}&select=artwork_id,agreed_cents`);
check('the sale carries the work that was bought', items1.length === 1 && items1[0].artwork_id === edition.id);
const purch1 = await rest(`purchases?collector_id=eq.${c.id}&select=id,artwork_id`);
check('the purchase is booked on the collector', purch1.length === 1 && purch1[0].artwork_id === edition.id);
const comm1 = await rest(`commissions?invoice_id=eq.${row1.invoice_id}&select=id,person`);
check('a commission is written', comm1.length >= 1, JSON.stringify(comm1));
check('the work is marked sold', (await artRow(edition.id))?.available === false);
const acts1 = await rest(`activities?entity_id=eq.${c.id}&select=kind,actor`);
check('the collector timeline says it was bought online',
  acts1.some(a => a.kind === 'purchase_online' && a.actor === 'shopify'));
const invActs1 = await rest(`activities?entity_id=eq.${row1.invoice_id}&select=kind,actor`);
check('the invoice timeline says it was paid online',
  invActs1.some(a => a.kind === 'paid_online' && a.actor === 'shopify'));

// ---------- 2. the same webhook delivered twice ----------
const before = {
  invoices: (await rest(`invoices?collector_id=eq.${c.id}&select=id`)).length,
  sales: (await rest(`sales?collector_id=eq.${c.id}&select=id`)).length,
  payments: (await rest(`payments?invoice_id=eq.${row1.invoice_id}&select=id`)).length,
  purchases: (await rest(`purchases?collector_id=eq.${c.id}&select=id`)).length,
};
const r2 = await handleOrderPaid(o1);
const after = {
  invoices: (await rest(`invoices?collector_id=eq.${c.id}&select=id`)).length,
  sales: (await rest(`sales?collector_id=eq.${c.id}&select=id`)).length,
  payments: (await rest(`payments?invoice_id=eq.${row1.invoice_id}&select=id`)).length,
  purchases: (await rest(`purchases?collector_id=eq.${c.id}&select=id`)).length,
};
check('a second delivery of the same order is a no-op', r2?.duplicate === true
  && JSON.stringify(before) === JSON.stringify(after), `${JSON.stringify(before)} vs ${JSON.stringify(after)}`);

// ---------- 3. a refund puts it all back ----------
await handleRefund({ id: 77001, order_id: o1.id,
  transactions: [{ kind: 'refund', amount: (edition.price_cents / 100).toFixed(2), status: 'success' }] });
const inv1b = await invoiceRow(row1.invoice_id);
check('the refund voids the invoice', inv1b?.status === 'void' && !!inv1b.void_reason, `status ${inv1b?.status}`);
check('the refund puts the work back on sale', (await artRow(edition.id))?.available === true);
check('the refund removes the payments', (await rest(`payments?invoice_id=eq.${row1.invoice_id}&select=id`)).length === 0);
check('the refund removes the commission', (await rest(`commissions?invoice_id=eq.${row1.invoice_id}&select=id`)).length === 0);
check('the refund removes the purchase', (await rest(`purchases?collector_id=eq.${c.id}&select=id`)).length === 0);
check('the refund keeps the collector', !!(await collectorRow()));
const r3b = await handleRefund({ id: 77002, order_id: o1.id, transactions: [] });
check('a second refund webhook is a no-op', r3b?.duplicate === true);

// ---------- 4. an original sells itself ----------
const o2 = order(9900002, { productId: PID_ORIGINAL, price: original.price_cents,
  title: original.title, artist: original.artist });
await handleOrderPaid(o2);
const row2 = await orderRow(o2.id);
const inv2 = await invoiceRow(row2.invoice_id);
check('an original is still recorded, not dropped', inv2?.status === 'paid');
check('an original is flagged on the order', row2?.needs_review === true && /original/i.test(row2.review_reason || ''),
  row2?.review_reason || 'no reason');
const [sale2] = await rest(`sales?id=eq.${row2.sale_id}&select=needs_review,review_reason`);
check('an original is flagged on the sale', sale2?.needs_review === true);
const queue = await ordersNeedingReview();
check('the flagged order is in the review queue', queue.some(q => q.shopify_order_id === String(o2.id)));

// ---------- 5. a pay link order still settles its own invoice ----------
const payInv = await rest('rpc/create_manual_invoice', { method: 'POST', body: JSON.stringify({
  p_collector_id: c.id, p_owner: 'Sara', p_due: null, p_inquiry_id: null,
  p_lines: [{ kind: 'work', artwork_id: edition.id, title: edition.title,
              artist: edition.artist, amount_cents: edition.price_cents }] }) });
const salesBefore = (await rest(`sales?collector_id=eq.${c.id}&select=id`)).length;
const o3 = order(9900003, { productId: PID_EDITION, price: edition.price_cents,
  title: edition.title, artist: edition.artist,
  attrs: [{ name: 'engine_invoice_id', value: payInv.id }] });
const r5 = await handleOrderPaid(o3);
const payInvAfter = await invoiceRow(payInv.id);
const salesAfter = (await rest(`sales?collector_id=eq.${c.id}&select=id`)).length;
check('a pay link order settles the invoice the rep made', r5?.paylink === true && payInvAfter?.status === 'paid',
  `status ${payInvAfter?.status}`);
check('a pay link order creates no second sale', salesAfter === salesBefore, `${salesBefore} then ${salesAfter}`);
const r5b = await handleOrderPaid(o3);
check('a pay link order delivered twice is a no-op', r5b?.duplicate === true);

// ---------- 5b. a cancellation reverses the same way ----------
await handleOrderCancelled({ id: o3.id });
check('cancelling reverses the pay link sale', (await invoiceRow(payInv.id))?.status === 'void');
check('cancelling puts the work back on sale', (await artRow(edition.id))?.available === true);

// ---------- teardown ----------
const c2 = await collectorRow();
const ids = [c2.id];
const invs = await rest(`invoices?collector_id=in.(${ids})&select=id`);
const sales = await rest(`sales?collector_id=in.(${ids})&select=id`);
await del(`shipments?collector_id=in.(${ids})`);
await del(`shopify_orders?shopify_order_id=in.(${ORDER_IDS.join(',')})`);
if (invs?.length) {
  const l = invs.map(i => i.id).join(',');
  await del(`commissions?invoice_id=in.(${l})`); await del(`payments?invoice_id=in.(${l})`);
  await del(`invoice_lines?invoice_id=in.(${l})`); await del(`activities?entity_id=in.(${l})`);
  await patch(`invoices?id=in.(${l})`, { replaces_invoice_id: null });
  await del(`invoices?id=in.(${l})`);
}
if (sales?.length) {
  const l = sales.map(s => s.id).join(',');
  await del(`sale_items?sale_id=in.(${l})`); await del(`sales?id=in.(${l})`);
}
await del(`messages?collector_id=in.(${ids})`);
await del(`purchases?collector_id=in.(${ids})`);
await del(`activities?entity_id=in.(${ids})`);
for (const r of restore) {
  await del(`activities?entity_id=eq.${r.id}`);
  await patch(`artworks?id=eq.${r.id}`, { available: true,
    shopify_product_id: r.shopify_product_id, site_status: r.site_status });
}
await del(`collectors?id=in.(${ids})`);

const leftCollectors = await rest(`collectors?email=eq.${EMAIL}&select=id`);
const leftOrders = await rest(`shopify_orders?shopify_order_id=in.(${ORDER_IDS.join(',')})&select=id`);
const works = await rest(`artworks?id=in.(${restore.map(r => r.id).join(',')})&select=id,available,shopify_product_id`);
check('teardown leaves no collector behind', (leftCollectors || []).length === 0);
check('teardown leaves no order rows behind', (leftOrders || []).length === 0);
check('every work touched is back on sale with its own product id',
  works.every(w => w.available === true
    && (w.shopify_product_id || null) === (restore.find(r => r.id === w.id).shopify_product_id || null)),
  JSON.stringify(works));

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
