import { db } from '../../../lib/db';
import { spillInquiry } from '../../../lib/spill';
import { persist } from '../../../lib/capture';

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

  let p;
  try { p = await req.json(); } catch { return json({ error: 'bad json' }, 400); }

  const email = (p.email || '').trim().toLowerCase();
  if (!email) return json({ error: 'email required' }, 400);

  try {
    const result = await persist(p, email);
    if (result.subscribed) return json({ ok: true, subscribed: true });
    notifyFloor(p, email, result).catch(() => {});
    return json({ ok: true, inquiry_id: result.inquiry.id });
  } catch (e) {
    // The database is unreachable or rejected the write — park it, don't drop it.
    const url = await spillInquiry(p, String(e?.message || e).slice(0, 300));
    notifyFloor(p, email, null).catch(() => {});
    return json({ ok: true, queued: true, saved: !!url });
  }
}

// Sales-floor ping. Fires whether or not the database took the write — if capture is
// degraded the floor is told so explicitly, so a lead is never silently invisible.
async function notifyFloor(p, email, result) {
  if (!process.env.SLACK_WEBHOOK_URL) return;
  let repeat = '';
  if (result) {
    try {
      const prior = await db.from('inquiries')
        .select('id', { count: 'exact', head: true }).eq('collector_id', result.collector.id);
      if ((prior.count || 1) > 1) repeat = ` · REPEAT COLLECTOR (${prior.count} inquiries)`;
    } catch {}
  }
  const head = result
    ? `*NEW INQUIRY* — ${result.inquiry.artwork_title || result.inquiry.purpose || 'general'}${repeat}`
    : `*NEW INQUIRY — SAVED OFFLINE* — ${p.artwork_title || p.artwork || 'general'}\n` +
      `_The database was unreachable. This lead is safely parked and will appear in the pipeline once it is replayed from Today._`;
  const lines = [
    head,
    `${p.first_name || ''} ${p.last_name || ''} · ${email}${p.phone ? ' · ' + p.phone : ''}${p.city ? ' · ' + p.city : ''}`,
    [p.budget_range, p.timeframe, p.source].filter(Boolean).join(' · '),
    p.page_journey ? `path: ${p.page_journey}` : '',
  ].filter(Boolean).join('\n');
  await fetch(process.env.SLACK_WEBHOOK_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: lines }),
  });
}
