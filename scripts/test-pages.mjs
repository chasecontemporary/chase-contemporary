// Every page, loaded the way a rep loads it. This exists because /finance returned a 500
// in production for ten days and nobody knew: the page read three variables above the line
// that declared them, which no build step and no unit test can catch. A page that throws is
// invisible until someone opens it, so something has to open all of them.
//
//   CRM_ACCESS_CODE=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/test-pages.mjs
//   APP=http://localhost:3000 node scripts/test-pages.mjs      (against a local dev server)
//
// Read-only: it signs in with the shared code, fetches, and asserts. It writes nothing.

const APP = process.env.APP || 'https://chase-engine.vercel.app';
const URL_ = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };
const get = async (p) => (await fetch(URL_ + '/rest/v1/' + p, { headers: H })).json();

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log((cond ? '  PASS  ' : '  FAIL  ') + name + (extra ? ' :: ' + extra : '')); };

// sign in the legacy way so this runs without a browser
const login = await fetch(APP + '/api/login', { method: 'POST', redirect: 'manual',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ code: process.env.CRM_ACCESS_CODE, back: '/today' }) });
const cookie = [...(login.headers.getSetCookie?.() || []).map(c => c.split(';')[0]), 'cc_rep=Wyatt'].join('; ');

// real ids, so the detail pages render real shapes rather than empty states
const [aw] = await get('artworks?select=id&limit=1');
const [col] = await get('collectors?select=id&order=created_at.desc&limit=1');
const [camp] = await get('campaigns?select=id&limit=1');

const pages = [
  ['/today', 'Today'], ['/pipeline', 'Sales pipeline'], ['/finance', 'Finance'], ['/signing', 'Signing'],
  ['/collectors', 'Collectors'], ['/inventory', 'Inventory'], ['/approvals', 'Approvals'], ['/artists', 'Artists'],
  ['/artists/portfolio', 'Portfolio'], ['/commissions', 'Commissions'], ['/team', 'Team'],
  ['/audiences', 'Audiences'], ['/campaigns', 'Campaigns'], ['/p/thanks', 'Thanks'],
  ['/finance?view=paid', 'Finance, paid'], ['/finance?view=payments', 'Finance, payments'],
  ['/finance?view=all', 'Finance, all'], ['/team?days=90', 'Team, 90 days'],
  ['/inventory?gap=location', 'Inventory, missing location'],
  ['/collectors?dupes=1', 'Collectors, duplicates'],
  ['/approvals?view=none', 'Approvals, not chosen'], ['/approvals?view=live', 'Approvals, on the site'],
  aw && [`/inventory/${aw.id}`, 'A work'],
  col && [`/collectors/${col.id}`, 'A collector'],
  camp && [`/campaigns/${camp.id}`, 'A campaign'],
].filter(Boolean);

console.log(`\nEVERY PAGE LOADS  ${APP}\n`);
for (const [path, label] of pages) {
  let status = 0, body = '';
  try {
    const r = await fetch(APP + path, { headers: { Cookie: cookie } });
    status = r.status; body = await r.text();
  } catch (e) { body = String(e.message); }
  const threw = /Application error|server-side exception|Internal Server Error/i.test(body);
  ok(`${label}  ${path}`, status === 200 && !threw, status === 200 ? (threw ? 'rendered an error' : '') : 'HTTP ' + status);
}

// the public surfaces a collector reaches, which must never need a login
for (const [path, label, want] of [['/api/health', 'Health endpoint', 'database'], ['/sign-in', 'Sign in', 'Chase']]) {
  const r = await fetch(APP + path);
  const b = await r.text();
  ok(`${label}  ${path}`, r.status === 200 && b.includes(want), 'HTTP ' + r.status);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
