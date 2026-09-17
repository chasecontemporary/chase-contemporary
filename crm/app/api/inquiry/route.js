import { db } from '../../../lib/db';
import { spillInquiry } from '../../../lib/spill';
import { rateLimit, tooMany } from '../../../lib/ratelimit';
import { persist, emailFor } from '../../../lib/capture';
import { announceInquiry } from '../../../lib/notify';
import { spamScore } from '../../../lib/spam';
import { createHash } from 'crypto';

// A submission that scores as a bot is parked, not stored as a lead: it never reaches the
// book, the board or the floor channel. Today lists it with a one-click rescue. The caller
// still gets a 200, so a script learns nothing from the response.
async function quarantine(p, verdict, req) {
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  await db.from('spam_submissions').insert({
    payload: JSON.parse(JSON.stringify(p).slice(0, 20000)),
    email: String(p.email || '').slice(0, 200) || null,
    name: [p.first_name, p.last_name].filter(Boolean).join(' ').slice(0, 160) || null,
    about: String(p.artwork_title || p.artwork || p.purpose || '').slice(0, 200) || null,
    score: verdict.score, reasons: verdict.reasons,
    ip_hash: ip ? createHash('sha256').update(ip).digest('hex').slice(0, 16) : null,
  });
}

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

  const email = emailFor(p);
  if (!email) return json({ error: 'email or phone required' }, 400);

  const verdict = spamScore(p);
  if (verdict.spam) {
    await quarantine(p, verdict, req).catch(() => {});
    return json({ ok: true });
  }

  try {
    const result = await persist(p, email);
    if (result.subscribed) return json({ ok: true, subscribed: true });
    if (result.repeated) return json({ ok: true, inquiry_id: result.inquiry.id, repeated: true });
    announceInquiry({ inquiry: result.inquiry, collector: result.collector, payload: p }).catch(() => {});
    return json({ ok: true, inquiry_id: result.inquiry.id });
  } catch (e) {
    // The database is unreachable or rejected the write — park it, don't drop it.
    const url = await spillInquiry(p, String(e?.message || e).slice(0, 300));
    announceInquiry({ inquiry: null, collector: null, payload: p, offline: true }).catch(() => {});
    return json({ ok: true, queued: true, saved: !!url });
  }
}
