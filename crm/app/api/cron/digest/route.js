import { db } from '../../../../lib/db';
import { reps, alertReps, slack } from '../../../../lib/notify';

// Every morning: each rep gets their day. Due follow-ups, leads gone quiet, holds lapsing
// today, invoices to chase. Owners get the whole floor. Email (and SMS, short form).
export const dynamic = 'force-dynamic';
const APP = () => process.env.APP_URL || 'https://chase-engine.vercel.app';
const usd = (c) => '$' + Math.round((c || 0) / 100).toLocaleString();
const nameOf = (c) => [c?.first_name, c?.last_name].filter(Boolean).join(' ') || 'A collector';

export async function GET(req) {
  const s = process.env.CRON_SECRET;
  if (!s || req.headers.get('authorization') !== `Bearer ${s}`) return new Response('unauthorized', { status: 401 });

  const today = new Date().toISOString().slice(0, 10);
  const D5 = new Date(Date.now() - 5 * 86400000).toISOString();
  const D7 = new Date(Date.now() - 7 * 86400000).toISOString();
  const soon = new Date(Date.now() + 24 * 3600000).toISOString();
  const [{ data: due }, { data: quiet }, { data: unclaimed }, { data: holds }, { data: invs }, { data: bal }] = await Promise.all([
    db.from('inquiries').select('id, owner, next_action, next_action_at, artwork_title, purpose, collectors(first_name, last_name, phone)')
      .lte('next_action_at', today).in('status', ['new', 'contacted', 'in_conversation', 'hold']).eq('kind', 'buying').limit(100),
    db.from('inquiries').select('id, owner, stage_changed_at, created_at, artwork_title, purpose, collectors(first_name, last_name)')
      .in('status', ['contacted', 'in_conversation']).eq('kind', 'buying').lt('stage_changed_at', D5).is('next_action_at', null).limit(100),
    db.from('inquiries').select('id, created_at, artwork_title, purpose, collectors(first_name, last_name)')
      .eq('status', 'new').eq('kind', 'buying').is('owner', null).limit(50),
    db.from('artwork_reserves').select('*').lte('expires_at', soon),
    db.from('invoices').select('id, invoice_number, ar_status, issued_at, last_nudge_at, sale_id, inquiry_id, collectors(first_name, last_name)')
      .eq('status', 'open').limit(200),
    db.from('invoice_balances').select('invoice_id, balance_cents').gt('balance_cents', 0).limit(500),
  ]);
  const balance = {}; (bal || []).forEach(b => balance[b.invoice_id] = Number(b.balance_cents));
  const chase = (invs || []).filter(i => balance[i.id] > 0 && ((i.last_nudge_at || i.issued_at) < D7));
  // invoice owner = sale owner, else inquiry owner
  const saleIds = chase.map(i => i.sale_id).filter(Boolean);
  const ownerOf = {};
  if (saleIds.length) (await db.from('sales').select('id, owner').in('id', saleIds)).data?.forEach(s => ownerOf[s.id] = s.owner);

  const team = await reps();
  const sent = [];
  for (const r of team) {
    const mine = (x) => r.role === 'owner' || x.owner === r.name;
    const L = [];
    const d = (due || []).filter(mine); if (d.length) L.push(`DUE TODAY (${d.length})`, ...d.map(x => `  ${nameOf(x.collectors)} · ${x.artwork_title || x.purpose}${x.next_action ? ' · ' + x.next_action : ''}${x.collectors?.phone ? ' · ' + x.collectors.phone : ''}`));
    const u = (unclaimed || []); if (u.length) L.push(`UNCLAIMED (${u.length})`, ...u.map(x => `  ${nameOf(x.collectors)} · ${x.artwork_title || x.purpose}`));
    const q = (quiet || []).filter(mine); if (q.length) L.push(`GONE QUIET 5+ DAYS (${q.length})`, ...q.map(x => `  ${nameOf(x.collectors)} · ${x.artwork_title || x.purpose}`));
    const h = (holds || []).filter(x => r.role === 'owner' || x.placed_by === r.name); if (h.length) L.push(`HOLDS LAPSING (${h.length})`, ...h.map(x => `  ${[x.first_name, x.last_name].filter(Boolean).join(' ')} · ${x.artwork_title} · ${x.lapsed ? 'lapsed' : 'until ' + new Date(x.expires_at).toLocaleDateString()}`));
    const c = chase.filter(i => r.role === 'owner' || ownerOf[i.sale_id] === r.name); if (c.length) L.push(`MONEY TO CHASE (${c.length})`, ...c.map(i => `  No. ${String(i.invoice_number).padStart(4, '0')} · ${nameOf(i.collectors)} · ${usd(balance[i.id])}`));
    if (!L.length) continue;
    const text = `Good morning ${r.name}. Your day on the engine:\n\n${L.join('\n')}\n\n${APP()}/today`;
    await alertReps({ to: [r], subject: `Your day · ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`, text,
      html: `<pre style="font:13px/1.6 Helvetica,Arial,sans-serif;white-space:pre-wrap">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre>` });
    sent.push(r.name);
  }
  if ((unclaimed || []).length) await slack(`:sunrise: Morning. ${unclaimed.length} unclaimed inquir${unclaimed.length === 1 ? 'y' : 'ies'} on the board: ${APP()}/pipeline`);
  return Response.json({ ok: true, sent });
}
