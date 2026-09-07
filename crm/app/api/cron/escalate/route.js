import { db } from '../../../../lib/db';
import { escalateInquiry } from '../../../../lib/notify';

// Every ten minutes: any buying inquiry still unclaimed after fifteen minutes gets
// announced again to the whole floor, once. Vercel calls this with
// Authorization: Bearer <CRON_SECRET>; nothing else may.
export const dynamic = 'force-dynamic';

const authed = (req) => {
  const s = process.env.CRON_SECRET;
  return !!s && req.headers.get('authorization') === `Bearer ${s}`;
};

export async function GET(req) {
  if (!authed(req)) return new Response('unauthorized', { status: 401 });
  const cutoff = new Date(Date.now() - 15 * 60000).toISOString();
  const { data: rows } = await db.from('inquiries')
    .select('id, created_at, artwork_title, purpose, owner, collectors(first_name, last_name, email, phone)')
    .eq('status', 'new').eq('kind', 'buying').is('owner', null).is('escalated_at', null)
    .lte('created_at', cutoff).order('created_at').limit(20);
  const done = [];
  for (const r of (rows || [])) {
    try { await escalateInquiry(r); done.push(r.id); } catch {}
  }
  return Response.json({ ok: true, escalated: done.length });
}
