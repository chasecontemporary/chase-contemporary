// Capture hardening, against production. Synthetic rows only, torn down at the end.
//
//   CRM_ACCESS_CODE=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/test-capture.mjs
//
// Run it after touching capture, the spam scoring or the inquiry endpoint.
// Proves: a bot submission is quarantined and never reaches the book or the board; a real
// one still lands and is announced; the same form twice is one lead; Not spam rescues.
const APP = 'https://chase-engine.vercel.app';
const SITE = 'https://www.chasecontemporary.com';
const URL_ = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
const rest = (p, o = {}) => fetch(URL_ + '/rest/v1/' + p, { ...o, headers: { ...H, ...(o.headers || {}) } });
const get = async (p) => (await rest(p)).json();
const post = (p, b) => fetch(APP + p, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: SITE }, body: JSON.stringify(b) });

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log((cond ? '  ok   ' : '  FAIL ') + name + (extra ? ' :: ' + extra : '')); };
const stamp = Date.now();
const REAL = `walkthrough-${stamp}@import.chasecontemporary.com`;
const BOT = `qz.fi.f.i.sa.qu.v${stamp % 97}.2@gmail.com`;
const HP = `honeypot-${stamp}@import.chasecontemporary.com`;

const bot = {
  first_name: 'hfvoCMSkvOTFSrBDGwgy', last_name: 'nVbKGKAyFekvzfTuA', email: BOT,
  phone: '6977095104', city: 'Uvqlvdnfv', artwork_title: 'The Ride, 2020',
  artwork_handle: 'sylve-the-ride', purpose: 'acquire', seconds_on_page: 3,
  message: 'I am interested in The Ride, 2020. Please send availability and payment options.',
};
const human = {
  first_name: 'Walkthrough', last_name: 'Collector', email: REAL, phone: '3105550147',
  city: 'Los Angeles', artwork_title: 'The Ride, 2020', artwork_handle: 'sylve-the-ride',
  purpose: 'acquire', seconds_on_page: 41, source: 'Instagram',
  message: `Please send availability and payment options. Ref ${stamp}.`,
};
const honeypot = { ...human, email: HP, first_name: 'Script', last_name: 'Filler', website: 'http://spam.example' };

console.log('\nCAPTURE HARDENING, production\n');

// 1. the bot submission
let r = await post('/api/inquiry', bot);
let body = await r.json();
ok('bot submission answers 200 and reveals nothing', r.status === 200 && body.ok === true && !body.inquiry_id, JSON.stringify(body));
ok('bot is not in the book', (await get(`collectors?select=id&email=eq.${encodeURIComponent(BOT)}`)).length === 0);
const q = await get(`spam_submissions?select=*&email=eq.${encodeURIComponent(BOT)}`);
ok('bot is quarantined with its reasons', q.length === 1 && q[0].score >= 4 && q[0].reasons.length >= 2,
  q.length ? `score ${q[0].score}: ${q[0].reasons.join('; ')}` : 'no row');

// 2. the honeypot
r = await post('/api/inquiry', honeypot);
ok('honeypot submission answers 200', r.status === 200);
const hq = await get(`spam_submissions?select=score,reasons&email=eq.${encodeURIComponent(HP)}`);
ok('hidden field alone quarantines', hq.length === 1 && hq[0].reasons.includes('hidden field filled'), JSON.stringify(hq[0] || {}));
ok('honeypot sender is not in the book', (await get(`collectors?select=id&email=eq.${encodeURIComponent(HP)}`)).length === 0);

// 3. a real collector still gets through
r = await post('/api/inquiry', human);
body = await r.json();
ok('real inquiry lands', r.status === 200 && !!body.inquiry_id, JSON.stringify(body));
const inq1 = body.inquiry_id;
const col = (await get(`collectors?select=id,first_name&email=eq.${encodeURIComponent(REAL)}`))[0];
ok('real collector is in the book', !!col);

// 4. the same form again inside the window
r = await post('/api/inquiry', human);
body = await r.json();
ok('a repeat submission is the same lead, not a new one', body.inquiry_id === inq1 && body.repeated === true, JSON.stringify(body));
const inqs = await get(`inquiries?select=id&collector_id=eq.${col.id}`);
ok('one inquiry on the board for this collector', inqs.length === 1, `${inqs.length} rows`);
const rep = await get(`activities?select=kind&entity_type=eq.inquiry&entity_id=eq.${inq1}&kind=eq.inquiry_repeated`);
ok('the repeat is noted on the record', rep.length === 1);

// 5. a rep says the quarantined one is real
const jar = [];
const login = await fetch(APP + '/api/login', { method: 'POST', redirect: 'manual',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ code: process.env.CRM_ACCESS_CODE, back: '/today' }) });
(login.headers.getSetCookie?.() || []).forEach(c => jar.push(c.split(';')[0]));
const cookie = [...jar, 'cc_rep=Wyatt'].join('; ');
const act = await fetch(APP + '/api/act', { method: 'POST', redirect: 'manual',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie, Accept: 'application/json' },
  body: new URLSearchParams({ action: 'spam_rescue', id: q[0].id, back: 'json' }) });
const actBody = await act.text();
ok('Not spam replays it as a real inquiry', act.status === 200, `${act.status} ${actBody.slice(0, 120)}`);
const rescued = (await get(`collectors?select=id&email=eq.${encodeURIComponent(BOT)}`))[0];
ok('the rescued submission is now in the book', !!rescued);
const rq = await get(`spam_submissions?select=rescued_at,rescued_by&id=eq.${q[0].id}`);
ok('the quarantine row records who rescued it', !!rq[0]?.rescued_at && rq[0].rescued_by === 'Wyatt', JSON.stringify(rq[0]));

// teardown
const ids = [col?.id, rescued?.id].filter(Boolean);
for (const id of ids) {
  const qs = await get(`inquiries?select=id&collector_id=eq.${id}`);
  for (const i of qs) await rest(`activities?entity_type=eq.inquiry&entity_id=eq.${i.id}`, { method: 'DELETE' });
  await rest(`inquiries?collector_id=eq.${id}`, { method: 'DELETE' });
  await rest(`activities?entity_type=eq.collector&entity_id=eq.${id}`, { method: 'DELETE' });
  await rest(`visitor_links?collector_id=eq.${id}`, { method: 'DELETE' });
  await rest(`collectors?id=eq.${id}`, { method: 'DELETE' });
}
await rest(`spam_submissions?email=in.("${BOT}","${HP}")`, { method: 'DELETE' });
const left = await get('spam_submissions?select=id');
const leftC = await get(`collectors?select=id&or=(email.eq.${encodeURIComponent(BOT)},email.eq.${encodeURIComponent(REAL)},email.eq.${encodeURIComponent(HP)})`);
ok('teardown left nothing behind', left.length === 0 && leftC.length === 0, `${left.length} quarantine, ${leftC.length} collectors`);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
