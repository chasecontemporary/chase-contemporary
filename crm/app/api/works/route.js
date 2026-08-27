import { db } from '../../../lib/db';

// Work search for pickers: available inventory by title or artist.
export async function GET(req) {
  const q = new URL(req.url).searchParams.get('q') || '';
  if (q.length < 2) return Response.json([]);
  const { data } = await db.from('artworks')
    .select('id, title, artist, price_cents, internal_value_cents, image_url')
    .eq('available', true)
    .or(`title.ilike.%${q}%,artist.ilike.%${q}%`)
    .order('price_cents', { ascending: false, nullsFirst: false }).limit(8);
  return Response.json((data || []).map(w => ({
    id: w.id, title: w.title, artist: w.artist || '',
    cents: Number(w.price_cents || w.internal_value_cents || 0),
    est: !(w.price_cents > 0) && w.internal_value_cents > 0,
    img: w.image_url ? w.image_url + (w.image_url.includes('?') ? '&' : '?') + 'width=88' : null,
  })));
}
