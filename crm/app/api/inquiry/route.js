import { db } from '../../../lib/db';
import { spillInquiry } from '../../../lib/spill';
import { rateLimit, tooMany } from '../../../lib/ratelimit';
import { persist } from '../../../lib/capture';
import { announceInquiry } from '../../../lib/notify';

const ORIGINS = [
  'https://www.chasecontemporary.com',
  'https://chasecontemporary.com',
  'https://chasecontemporaryshop.myshopify.com',
];
const corsFor = (req) => {
  const o = req.headers.get('origin');
  return {
    'Access-Control-Allow-Origin': ORIGINS.includes(o) ? o : ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
};

export async function OPTIONS(req) {
  return new Response(null, { status: 204, headers: corsFor(req) });
}

// Capture is the top of the funnel: it must never lose an inquiry. The database write is
// attempted first; if anything at all goes wrong the raw payload is parked in Blob storage
// and replayed later from Today. The caller always gets a 200 so the site never shows an
// error and the browser never retry-storms.
export async function POST(req) {
  const CORS = corsFor(req);
  const json = (body, status = 200) => new Response(JSON.stringify(body),
    { status, headers: { 'Content-Type': 'application/json', ...CORS } });

  // A collector submits an inquiry once, maybe twice. Twenty an hour from one address is
  // already far beyond any real behaviour.
  const { ok } = await rateLimit(req, 'inquiry', 20, 3600);
  if (!ok) return tooMany(600, CORS);

  let p;
  try { p = await req.json(); } catch { return json({ error: 'bad json' }, 400); }

  const email = (p.email || '').trim().toLowerCase();
  if (!email) return json({ error: 'email required' }, 400);

  try {
    const result = await persist(p, email);
    if (result.subscribed) return json({ ok: true, subscribed: true });
    announceInquiry({ inquiry: result.inquiry, collector: result.collector, payload: p }).catch(() => {});
    return json({ ok: true, inquiry_id: result.inquiry.id });
  } catch (e) {
    // The database is unreachable or rejected the write — park it, don't drop it.
    const url = await spillInquiry(p, String(e?.message || e).slice(0, 300));
    announceInquiry({ inquiry: null, collector: null, payload: p, offline: true }).catch(() => {});
    return json({ ok: true, queued: true, saved: !!url });
  }
}
