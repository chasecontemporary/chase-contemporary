import { db } from '../../../lib/db';

// Live reach preview for the audience builder.
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  const def = { seg: sp.get('seg') || 'all', artist: sp.get('artist') || null,
    min_spend: sp.get('min_spend') || null, consented: sp.get('consented') !== 'false' };
  const { data } = await db.rpc('audience_count', { def });
  return Response.json({ count: Number(data || 0) });
}
