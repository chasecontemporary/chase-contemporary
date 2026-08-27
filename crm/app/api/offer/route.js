import { db } from '../../../lib/db';

// One-tap interest from a private-selection page. No auth — the token IS the auth.
export async function POST(req) {
  let p;
  try { p = await req.json(); } catch { return new Response(null, { status: 400 }); }
  const { data: o } = await db.from('offers')
    .select('id, collector_id, created_by, status, expires_at, items, title')
    .eq('token', String(p.token || '')).single();
  if (!o || o.status !== 'active') return new Response(null, { status: 404 });
  if (o.expires_at && new Date(o.expires_at) < new Date()) return new Response(null, { status: 404 });
  const artworkId = String(p.artwork_id || '');
  if (!(o.items || []).some(x => x.id === artworkId)) return new Response(null, { status: 400 });

  // already responded to this work — idempotent
  const { data: existing } = await db.from('offer_responses')
    .select('id').eq('offer_id', o.id).eq('artwork_id', artworkId).maybeSingle();
  if (existing) return Response.json({ ok: true });

  const { data: a } = await db.from('artworks')
    .select('handle, title, artist').eq('id', artworkId).single();
  const { data: inquiry } = await db.from('inquiries').insert({
    collector_id: o.collector_id,
    artwork_handle: a?.handle || null,
    artwork_title: a?.title || null,
    artist: a?.artist || null,
    purpose: 'acquire',
    source: 'Private selection',
    message: `Tapped "I'm interested" on ${a?.title || 'a work'} in ${o.title || 'a private selection'}.`,
    owner: o.created_by || 'Sara',
    status: 'new',
  }).select().single();
  await db.from('offer_responses').insert({
    offer_id: o.id, artwork_id: artworkId, inquiry_id: inquiry?.id || null });
  await db.from('activities').insert({
    entity_type: 'collector', entity_id: o.collector_id,
    kind: 'offer_interest', body: `interested in ${a?.title || 'a work'} from ${o.title || 'a private selection'}` });
  return Response.json({ ok: true });
}
