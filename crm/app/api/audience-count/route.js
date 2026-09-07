import { db } from '../../../lib/db';
import { isStaff } from '../../../lib/identity';

// Live reach preview for the audience builder.
export async function GET(req) {
  // Signed in is not the same as staff — this endpoint returns real collector
  // and inventory data, so it must never answer a stranger's account.
  if (!(await isStaff())) return new Response('Not authorised', { status: 403 });

  const sp = new URL(req.url).searchParams;
  const def = { seg: sp.get('seg') || 'all', artist: sp.get('artist') || null,
    min_spend: sp.get('min_spend') || null, consented: sp.get('consented') !== 'false' };
  const { data } = await db.rpc('audience_count', { def });
  return Response.json({ count: Number(data || 0) });
}
