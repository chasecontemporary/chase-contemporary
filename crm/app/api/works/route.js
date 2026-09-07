import { db } from '../../../lib/db';
import { isStaff } from '../../../lib/identity';

// Work search for pickers: available inventory by title or artist.
export async function GET(req) {
  // Signed in is not the same as staff — this endpoint returns real collector
  // and inventory data, so it must never answer a stranger's account.
  if (!(await isStaff())) return new Response('Not authorised', { status: 403 });

  const q = new URL(req.url).searchParams.get('q') || '';
  let sel = db.from('artworks')
    .select('id, title, artist, price_cents, internal_value_cents, image_url')
    .eq('available', true);                     // on-hand inventory only
  if (q.length >= 2) sel = sel.or(`title.ilike.%${q}%,artist.ilike.%${q}%`);
  const { data } = await sel.order('price_cents', { ascending: false, nullsFirst: false }).limit(8);
  return Response.json((data || []).map(w => ({
    id: w.id, title: w.title, artist: w.artist || '',
    cents: Number(w.price_cents || w.internal_value_cents || 0),
    est: !(w.price_cents > 0) && w.internal_value_cents > 0,
    img: w.image_url ? w.image_url + (w.image_url.includes('?') ? '&' : '?') + 'width=88' : null,
  })));
}
