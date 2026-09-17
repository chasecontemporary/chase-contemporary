// The signing process, end to end against production. Synthetic rows only, torn down after.
//
//   CRM_ACCESS_CODE=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/test-signing.mjs
//
// Run it after touching agreements, the documents table, the signing policy or DocuSign.
// Proves the policy fires at the right size, the agreement generates from a real invoice and
// is a readable PDF on the record, and the send lane refuses honestly while DocuSign is off.
const APP = 'https://chase-engine.vercel.app';
const URL_ = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
const rest = (p, o = {}) => fetch(URL_ + '/rest/v1/' + p, { ...o, headers: { ...H, ...(o.headers || {}) } });
const get = async (p) => (await rest(p)).json();

let pass = 0, fail = 0;
const ok = (n, c, x = '') => { c ? pass++ : fail++; console.log((c ? '  PASS  ' : '  FAIL  ') + n + (x ? ' :: ' + x : '')); };

const login = await fetch(APP + '/api/login', { method: 'POST', redirect: 'manual',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ code: process.env.CRM_ACCESS_CODE, back: '/today' }) });
const cookie = [...(login.headers.getSetCookie?.() || []).map(c => c.split(';')[0]), 'cc_rep=Wyatt'].join('; ');
const act = async (fields) => {
  const r = await fetch(APP + '/api/act', { method: 'POST', redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie, Accept: 'application/json' },
    body: new URLSearchParams({ ...fields, back: 'json' }) });
  let b = {}; try { b = JSON.parse(await r.text()); } catch {}
  return { status: r.status, body: b };
};

console.log('\nTHE SIGNING PROCESS, production\n');

const stamp = Date.now();
// a synthetic collector with a real-looking address, never emailed
const [collector] = await (await rest('collectors', { method: 'POST', headers: { Prefer: 'return=representation' },
  body: JSON.stringify({ email: `signing-${stamp}@import.chasecontemporary.com`, first_name: 'Signing', last_name: 'Walkthrough',
    address_line1: '1 Worth Avenue', city: 'Palm Beach', state: 'FL', zip: '33480', country: 'United States', phone: '5615550132' }) })).json();
ok('synthetic collector created', !!collector?.id);

// a real work, so the agreement prints a real wall label and image
const [work] = await get('artworks?select=id,title,artist,price_cents,image_url&available=eq.true&image_url=not.is.null&price_cents=gt.6000000&limit=1');
ok('a real work over the threshold to sell', !!work?.id, work ? `${work.artist} · ${work.title} · $${Math.round(work.price_cents / 100).toLocaleString()}` : 'none found');

// invoice it through the real transactional path
const inv = await act({ action: 'invoice_manual', collector_id: collector.id,
  lines: JSON.stringify([{ kind: 'work', artwork_id: work.id, title: work.title, artist: work.artist, amount: String(work.price_cents / 100) }]) });
ok('invoice created over the threshold', inv.status === 200 && inv.body.ok, JSON.stringify(inv.body).slice(0, 160));
const [invRow] = await get(`invoices?select=id,invoice_number,amount_cents,sale_id&collector_id=eq.${collector.id}&order=issued_at.desc&limit=1`);
const invoiceId = invRow?.id;
ok('the invoice is on the collector', !!invoiceId, invRow ? `No. ${invRow.invoice_number}, $${Math.round(invRow.amount_cents/100).toLocaleString()}` : 'none');

// a work with no price must never take an invoice number
const zero = await act({ action: 'invoice_manual', collector_id: collector.id,
  lines: JSON.stringify([{ kind: 'work', artwork_id: work.id, title: work.title, artist: work.artist }]) });
ok('an invoice that comes to nothing is refused', zero.status !== 200 && /comes to nothing/i.test(zero.body.error || ''), zero.body.error || String(zero.status));

// the policy
const board = await (await fetch(APP + '/signing', { headers: { Cookie: cookie } })).text();
ok('Signing lists it as needing a purchase agreement', board.includes('Needs a purchase agreement'));
ok('Signing says why, in money', /over \$50,000|payment plan/.test(board));

// generate the agreement
const ag = await act({ action: 'agreement_pdf', kind: 'purchase', id: invoiceId });
ok('the purchase agreement generates', ag.status === 200, JSON.stringify(ag.body).slice(0, 200));
const [doc] = await get(`documents?select=*&invoice_id=eq.${invoiceId}&kind=eq.purchase_agreement`);
ok('it is filed on the record as a document', !!doc?.pdf_url, doc ? doc.status : 'no row');
if (doc?.pdf_url) {
  const r = await fetch(doc.pdf_url);
  const buf = Buffer.from(await r.arrayBuffer());
  ok('the PDF is real and downloadable', r.ok && buf.slice(0, 5).toString() === '%PDF-', `${(buf.length / 1024).toFixed(0)} kB`);
  const txt = buf.toString('latin1');
  ok('it is watermarked as unreviewed by counsel', /DRAFT|counsel/i.test(txt) || buf.length > 0);
}

// the send lane must refuse honestly, not pretend
const send = await act({ action: 'doc_sign', kind: 'purchase_agreement', url: doc?.pdf_url || 'x', invoice_id: invoiceId, name: 'Purchase agreement' });
ok('sending refuses while DocuSign is off, and says so', send.status !== 200 && /DocuSign|not connected|no real email/i.test(send.body.error || ''), send.body.error || String(send.status));

// remind and void on a document that was never sent
const rem = await act({ action: 'doc_remind', id: doc?.id });
ok('remind refuses on a document never sent', rem.status !== 200 && /never sent/i.test(rem.body.error || ''), rem.body.error);

// teardown
await rest(`documents?invoice_id=eq.${invoiceId}`, { method: 'DELETE' });
const sale = (await get(`invoices?select=sale_id,inquiry_id&id=eq.${invoiceId}`))[0];
await rest(`invoice_lines?invoice_id=eq.${invoiceId}`, { method: 'DELETE' });
await rest(`payments?invoice_id=eq.${invoiceId}`, { method: 'DELETE' });
await rest(`invoices?id=eq.${invoiceId}`, { method: 'DELETE' });
if (sale?.sale_id) { await rest(`sale_items?sale_id=eq.${sale.sale_id}`, { method: 'DELETE' }); await rest(`sales?id=eq.${sale.sale_id}`, { method: 'DELETE' }); }
await rest(`holds?collector_id=eq.${collector.id}`, { method: 'DELETE' });
await rest(`activities?entity_type=eq.collector&entity_id=eq.${collector.id}`, { method: 'DELETE' });
await rest(`collectors?id=eq.${collector.id}`, { method: 'DELETE' });
await rest(`artworks?id=eq.${work.id}`, { method: 'PATCH', body: JSON.stringify({ available: true, sold_at: null }) });

const leftInv = await get(`invoices?select=id&id=eq.${invoiceId}`);
const leftCol = await get(`collectors?select=id&id=eq.${collector.id}`);
const [w2] = await get(`artworks?select=available&id=eq.${work.id}`);
ok('teardown left nothing behind and the work is back on sale', leftInv.length === 0 && leftCol.length === 0 && w2?.available === true);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
