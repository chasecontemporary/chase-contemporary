import { db } from '../../../lib/db';

const CORS = {
  'Access-Control-Allow-Origin': 'https://www.chasecontemporary.com',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(req) {
  let p;
  try { p = await req.json(); } catch { return json({ error: 'bad json' }, 400); }

  const email = (p.email || '').trim().toLowerCase();
  if (!email) return json({ error: 'email required' }, 400);

  // upsert collector keyed by email — repeat collectors match automatically
  const { data: collector, error: cErr } = await db
    .from('collectors')
    .upsert({
      email,
      first_name: p.first_name || null,
      last_name: p.last_name || null,
      phone: p.phone || null,
      city: p.city || null,
      timezone: p.timezone || null,
      locale: p.locale || null,
      source: p.source || null,
      trade: p.trade === 'yes' || p.trade === true,
      newsletter: p.newsletter_opt_in === 'yes' || p.newsletter_opt_in === true,
      budget_range: p.budget_range || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'email' })
    .select()
    .single();
  if (cErr) return json({ error: cErr.message }, 500);

  const { data: inquiry, error: iErr } = await db
    .from('inquiries')
    .insert({
      collector_id: collector.id,
      artwork_handle: p.artwork_handle || null,
      artwork_title: p.artwork_title || p.artwork || null,
      artist: p.artist || p.artist_interest || null,
      price_band: p.price_band || null,
      purpose: p.purpose || 'acquire',
      outlet: p.outlet || null,
      budget_range: p.budget_range || null,
      timeframe: p.timeframe || null,
      message: p.body || p.message || null,
      source: p.source || null,
      page_journey: p.page_journey || null,
      referrer: p.referrer || null,
      utm: p.utm || null,
      seconds_on_page: parseInt(p.seconds_on_page) || null,
      device: p.device || null,
      owner: 'Sara',
    })
    .select()
    .single();
  if (iErr) return json({ error: iErr.message }, 500);

  await db.from('activities').insert({
    entity_type: 'inquiry', entity_id: inquiry.id,
    kind: 'inquiry_received',
    body: `${p.first_name || ''} ${p.last_name || ''} · ${inquiry.artwork_title || inquiry.purpose}`,
  });

  // sales-floor ping (Slack incoming webhook)
  if (process.env.SLACK_WEBHOOK_URL) {
    const prior = await db.from('inquiries')
      .select('id', { count: 'exact', head: true })
      .eq('collector_id', collector.id);
    const repeat = (prior.count || 1) > 1 ? ` · REPEAT COLLECTOR (${prior.count} inquiries)` : '';
    const lines = [
      `*NEW INQUIRY* — ${inquiry.artwork_title || inquiry.purpose || 'general'}${repeat}`,
      `${p.first_name || ''} ${p.last_name || ''} · ${email}${p.phone ? ' · ' + p.phone : ''}${p.city ? ' · ' + p.city : ''}`,
      [p.budget_range, p.timeframe, p.source].filter(Boolean).join(' · '),
      p.page_journey ? `path: ${p.page_journey}` : '',
    ].filter(Boolean).join('\n');
    fetch(process.env.SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: lines }),
    }).catch(() => {});
  }

  return json({ ok: true, inquiry_id: inquiry.id });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
