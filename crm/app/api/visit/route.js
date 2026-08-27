import { db } from '../../../lib/db';

// Page-view beacon from the site. Sent via navigator.sendBeacon as a text/plain
// simple request (no preflight, response never read — no CORS headers needed).
// Anonymous until the visitor identifies (inquiry submit stitches the trail).
export async function POST(req) {
  let p;
  try { p = JSON.parse(await req.text()); } catch { return new Response(null, { status: 400 }); }
  const v = String(p.v || '');
  if (!/^v-[a-z0-9]{8,40}$/.test(v)) return new Response(null, { status: 400 });
  const { data: link } = await db.from('visitor_links')
    .select('collector_id').eq('visitor_id', v).maybeSingle();
  await db.from('site_events').insert({
    visitor_id: v,
    collector_id: link?.collector_id || null,
    path: String(p.p || '').slice(0, 300) || null,
    referrer: String(p.r || '').slice(0, 300) || null,
    utm: String(p.u || '').slice(0, 300) || null,
  });
  return new Response(null, { status: 204 });
}
