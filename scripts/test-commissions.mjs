// The commission pool, against production. Synthetic rows only, torn down after.
//
//   CRM_ACCESS_CODE=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/test-commissions.mjs
//
// Proves the arrangement the gallery actually has: a percentage of every payment RECEIVED
// becomes one pool, and the pool is divided on agreed shares. Run after touching commissions,
// settlement or the payout.
const APP = 'https://chase-engine.vercel.app';
const URL_ = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
const rest = (p, o = {}) => fetch(URL_ + '/rest/v1/' + p, { ...o, headers: { ...H, ...(o.headers || {}) } });
const get = async (p) => (await rest(p)).json();

let pass = 0, fail = 0;
const ok = (n, c, x = '') => { c ? pass++ : fail++; console.log((c ? '  PASS  ' : '  FAIL  ') + n + (x ? ' :: ' + x : '')); };
const usd = (c) => '$' + (Math.round(c) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 });

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

console.log('\nTHE COMMISSION POOL, production\n');

// remember the real arrangement so the test can put it back exactly
const shareBefore = await get('commission_shares?select=*&active=eq.true');
const [planNow] = await get('commission_plan?select=*&active=eq.true&order=effective_from.desc&limit=1');
ok('a pool percentage is set', !!planNow, planNow ? planNow.pool_pct + '% of every payment' : 'none');

// a temporary two person split so the maths is checkable
const A = 'ZZ Test Alpha', B = 'ZZ Test Beta';
for (const [person, pct] of [[A, 50], [B, 50]]) {
  const r = await act({ action: 'comm_share_set', person, share_pct: String(pct) });
  ok(`${person} takes ${pct}% of the pool`, r.status === 200, JSON.stringify(r.body).slice(0, 120));
}

const stamp = Date.now();
const [collector] = await (await rest('collectors', { method: 'POST', headers: { Prefer: 'return=representation' },
  body: JSON.stringify({ email: `commission-${stamp}@import.chasecontemporary.com`, first_name: 'Commission', last_name: 'Test' }) })).json();
const [work] = await get('artworks?select=id,title,artist&available=eq.true&shopify_product_id=is.null&limit=1');

// a $100,000 sale, so the arithmetic is obvious
const PRICE = 10000000;
const inv = await act({ action: 'invoice_manual', collector_id: collector.id,
  lines: JSON.stringify([{ kind: 'work', artwork_id: work.id, title: work.title, artist: work.artist, amount: String(PRICE / 100) }]) });
ok('a hundred thousand dollar sale is invoiced', inv.status === 200 && inv.body.ok);
const [invRow] = await get(`invoices?select=id,sale_id&collector_id=eq.${collector.id}&order=issued_at.desc&limit=1`);

// half now: commission must accrue on what LANDED, not on what was invoiced
const dep = await act({ action: 'invoice_payment', id: invRow.id, amount: String(PRICE / 200) });
ok('a fifty percent deposit is recorded', dep.status === 200, JSON.stringify(dep.body).slice(0, 120));

let rows = await get(`commissions?select=person,amount_cents,pool_cents,pool_pct,share_pct,period&invoice_id=eq.${invRow.id}`);
const pool = Math.round((PRICE / 2) * planNow.pool_pct / 100);
const each = Math.round(pool * 0.5);
ok('one row per person in the pool', rows.length === 2, `${rows.length} rows`);
// every() on an empty array is true, so an empty result must never be allowed to pass as correct
ok('the pool is taken from the deposit, not the invoice',
  rows.length === 2 && rows.every(r => Number(r.pool_cents) === pool),
  `pool ${usd(pool)} on a ${usd(PRICE / 2)} deposit at ${planNow.pool_pct}%`);
ok('each person gets half the pool',
  rows.length === 2 && rows.every(r => Number(r.amount_cents) === each), `${usd(each)} each`);

// the balance earns the rest
const bal = await act({ action: 'invoice_paid', id: invRow.id });
ok('the balance is paid', bal.status === 200, JSON.stringify(bal.body).slice(0, 120));
rows = await get(`commissions?select=person,amount_cents&invoice_id=eq.${invRow.id}`);
const perPerson = {};
rows.forEach(r => { perPerson[r.person] = (perPerson[r.person] || 0) + Number(r.amount_cents); });
const expectedEach = Math.round(PRICE * planNow.pool_pct / 100 * 0.5);
ok('across the whole sale each person earned half the pool',
  Object.keys(perPerson).length === 2 && Object.values(perPerson).every(v => Math.abs(v - expectedEach) <= 2),
  Object.entries(perPerson).map(([k, v]) => `${k} ${usd(v)}`).join(', ') + ` (expected ${usd(expectedEach)} each)`);
ok('the two shares together are the whole pool, nothing lost',
  Math.abs(Object.values(perPerson).reduce((a, b) => a + b, 0) - Math.round(PRICE * planNow.pool_pct / 100)) <= 2,
  usd(Object.values(perPerson).reduce((a, b) => a + b, 0)));

// the monthly statement
const stmt = await get(`commission_statement?select=*&person=eq.${encodeURIComponent(A)}`);
ok('it shows up on the monthly statement', stmt.length === 1 && Number(stmt[0].owed_cents) === expectedEach,
  stmt.length ? `${stmt[0].period} owed ${usd(stmt[0].owed_cents)}` : 'nothing');

// paying a month out
const paid = stmt[0] ? await act({ action: 'comm_period_pay', person: A, period: stmt[0].period }) : { status: 0, body: {} };
ok('a month can be marked paid', paid.status === 200, JSON.stringify(paid.body).slice(0, 120));
const stmt2 = await get(`commission_statement?select=*&person=eq.${encodeURIComponent(A)}`);
ok('and then nothing is owed for that month',
  !!stmt2[0] && Number(stmt2[0].owed_cents || 0) === 0 && Number(stmt2[0].paid_cents) === expectedEach,
  stmt2[0] ? `paid ${usd(stmt2[0].paid_cents)}, owed ${usd(stmt2[0].owed_cents || 0)}` : 'no statement');

// teardown, including putting the real arrangement back
await rest(`commissions?invoice_id=eq.${invRow.id}`, { method: 'DELETE' });
await rest(`payments?invoice_id=eq.${invRow.id}`, { method: 'DELETE' });
await rest(`invoice_lines?invoice_id=eq.${invRow.id}`, { method: 'DELETE' });
await rest(`documents?invoice_id=eq.${invRow.id}`, { method: 'DELETE' });
await rest(`invoices?id=eq.${invRow.id}`, { method: 'DELETE' });
if (invRow.sale_id) { await rest(`sale_items?sale_id=eq.${invRow.sale_id}`, { method: 'DELETE' }); await rest(`sales?id=eq.${invRow.sale_id}`, { method: 'DELETE' }); }
await rest(`purchases?collector_id=eq.${collector.id}`, { method: 'DELETE' });
await rest(`activities?entity_type=eq.collector&entity_id=eq.${collector.id}`, { method: 'DELETE' });
await rest(`collectors?id=eq.${collector.id}`, { method: 'DELETE' });
await rest(`artworks?id=eq.${work.id}`, { method: 'PATCH', body: JSON.stringify({ available: true }) });
await rest(`commission_shares?person=in.("${A}","${B}")`, { method: 'DELETE' });

const sharesAfter = await get('commission_shares?select=person&active=eq.true');
const left = await get(`commissions?select=id&invoice_id=eq.${invRow.id}`);
ok('teardown clean and the real arrangement is untouched',
  left.length === 0 && sharesAfter.length === shareBefore.length,
  `${sharesAfter.length} real share row(s)`);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
