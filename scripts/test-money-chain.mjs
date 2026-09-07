// Regression test for the money chain — the highest-consequence code in the engine.
//
// Exercises the real production endpoints end to end, then removes everything it made.
// Run it after touching invoicing, payments, settlement, undo or reserves.
//
//   CRM_CODE=... node scripts/test-money-chain.mjs
//
// It creates one synthetic collector on the @import domain (excluded from every audience,
// can never be emailed) and restores any artwork it touches.

const BASE = process.env.CRM_BASE || 'https://chase-engine.vercel.app';
const CODE = process.env.CRM_CODE;
const SB   = process.env.SUPABASE_URL;
const KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!CODE || !SB || !KEY) {
  console.error('need CRM_CODE, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const COOKIE = `cc_crm=${CODE}; cc_rep=Sara`;
const EMAIL  = 'moneychain-test@import.chasecontemporary.com';

const rest = async (path, init = {}) => {
  const r = await fetch(`${SB}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`,
               'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const t = await r.text();
  return t ? JSON.parse(t) : null;
};
const act = async (fields) => {
  const r = await fetch(`${BASE}/api/act`, {
    method: 'POST', redirect: 'manual',
    headers: { Cookie: COOKIE, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...fields, back: 'json' }),
  });
  try { return { status: r.status, body: await r.json() }; }
  catch { return { status: r.status, body: null }; }
};

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else    { fail++; console.log(`  FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
};

// ---------- setup ----------
const [work] = await rest('artworks?available=eq.true&price_cents=gt.0&select=id,title&limit=1');
const collector = (await rest('collectors', {
  method: 'POST', headers: { Prefer: 'return=representation' },
  body: JSON.stringify({ email: EMAIL, first_name: 'Money', last_name: 'Chain' }),
}))[0];
console.log(`\n  work: ${work.title}\n  collector: ${collector.id}\n`);

const lines = (amount) => JSON.stringify([
  { kind: 'work', artwork_id: work.id, title: work.title, amount: String(amount) },
]);

// ---------- 1. invoice creation is transactional ----------
await act({ action: 'invoice_manual', collector_id: collector.id, lines: lines(10000) });
let [inv] = await rest(`invoices?collector_id=eq.${collector.id}&select=id,invoice_number,sale_id,status`);
check('invoice created with a sale attached', !!inv && !!inv.sale_id);

const noCollector = await act({ action: 'invoice_manual', collector_id: '', lines: lines(1000) });
check('invoice without a collector is refused', noCollector.body?.ok === false);

const negative = await act({ action: 'invoice_manual', collector_id: collector.id,
  lines: JSON.stringify([{ kind: 'service', title: 'x', amount: '-500' }]) });
check('negative line item is refused', negative.body?.ok === false);

// ---------- 2. balances ----------
const bal = async () => (await rest(`invoice_balances?invoice_id=eq.${inv.id}&select=*`))[0];
check('balance starts at the full total', (await bal()).balance_cents === 1000000);

const over = await act({ action: 'invoice_payment', id: inv.id, amount: '99999' });
check('overpayment is refused', over.body?.ok === false,
      over.body?.error ? '' : 'expected a refusal');

await act({ action: 'invoice_payment', id: inv.id, amount: '4000', method: 'Wire' });
const afterPart = await bal();
check('partial payment leaves the right balance',
      afterPart.received_cents === 400000 && afterPart.balance_cents === 600000,
      `received ${afterPart.received_cents} balance ${afterPart.balance_cents}`);

// ---------- 3. reserves block a competing sale ----------
const other = (await rest('collectors', {
  method: 'POST', headers: { Prefer: 'return=representation' },
  body: JSON.stringify({ email: 'moneychain-rival@import.chasecontemporary.com',
                         first_name: 'Rival', last_name: 'Buyer' }),
}))[0];
await act({ action: 'reserve_create', id: work.id, collector_id: collector.id, days: '3' });
const blocked = await act({ action: 'invoice_manual', collector_id: other.id, lines: lines(9000) });
check('a held work cannot be invoiced for someone else', blocked.body?.ok === false);
const dupHold = await act({ action: 'reserve_create', id: work.id, collector_id: other.id, days: '3' });
check('a second hold for another collector is refused', dupHold.body?.ok === false);

// ---------- 4. settlement ----------
await act({ action: 'invoice_paid', id: inv.id, method: 'Wire' });
const settled = await rest(`invoices?id=eq.${inv.id}&select=status`);
const artAfter = await rest(`artworks?id=eq.${work.id}&select=available`);
const purch = await rest(`purchases?collector_id=eq.${collector.id}&select=id`);
const comm  = await rest(`commissions?invoice_id=eq.${inv.id}&select=id,amount_cents`);
check('settling closes the invoice', settled[0].status === 'paid');
check('settling marks the work sold', artAfter[0].available === false);
check('settling books the purchase', purch.length === 1);
check('settling writes a commission', comm.length >= 1);

// ---------- 5. undo ----------
await act({ action: 'invoice_unsettle', id: inv.id });
const reopened = await rest(`invoices?id=eq.${inv.id}&select=status`);
const artBack  = await rest(`artworks?id=eq.${work.id}&select=available`);
const purchGone = await rest(`purchases?collector_id=eq.${collector.id}&select=id`);
const commGone  = await rest(`commissions?invoice_id=eq.${inv.id}&select=id`);
const payGone   = await rest(`payments?invoice_id=eq.${inv.id}&select=id`);
check('undo reopens the invoice', reopened[0].status === 'open');
check('undo puts the work back on sale', artBack[0].available === true);
check('undo removes the purchase', purchGone.length === 0);
check('undo removes the commission', commGone.length === 0);
check('undo removes the payments', payGone.length === 0);

// ---------- teardown ----------
const ids = [collector.id, other.id];
const invs = await rest(`invoices?collector_id=in.(${ids})&select=id`);
const sales = await rest(`sales?collector_id=in.(${ids})&select=id`);
const del = (p) => rest(p, { method: 'DELETE' });
if (invs?.length) {
  const l = invs.map(i => i.id).join(',');
  await del(`commissions?invoice_id=in.(${l})`); await del(`payments?invoice_id=in.(${l})`);
  await del(`invoice_lines?invoice_id=in.(${l})`); await del(`activities?entity_id=in.(${l})`);
  await del(`invoices?id=in.(${l})`);
}
if (sales?.length) {
  const l = sales.map(s => s.id).join(',');
  await del(`sale_items?sale_id=in.(${l})`); await del(`sales?id=in.(${l})`);
}
await del(`holds?artwork_id=eq.${work.id}&kind=eq.reserve`);
await del(`purchases?collector_id=in.(${ids})`);
await del(`activities?entity_id=in.(${ids})`);
await del(`activities?entity_id=eq.${work.id}`);
await rest(`artworks?id=eq.${work.id}`, { method: 'PATCH', body: JSON.stringify({ available: true }) });
await del(`collectors?id=in.(${ids})`);

const leftover = await rest(`collectors?email=like.moneychain-*&select=id`);
check('everything this test created is cleaned up', (leftover || []).length === 0);

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
