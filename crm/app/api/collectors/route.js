import { db } from '../../../lib/db';

// Collector search for pickers: top matches by name/email/company.
export async function GET(req) {
  const q = new URL(req.url).searchParams.get('q') || '';
  if (q.length < 2) return Response.json([]);
  const { data } = await db.from('collector_index')
    .select('id, first_name, last_name, email, city, spend_cents')
    .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,company.ilike.%${q}%`)
    .neq('email', 'sale-@import.chasecontemporary.com')
    .order('spend_cents', { ascending: false }).limit(8);
  return Response.json((data || []).map(c => ({
    id: c.id,
    name: [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email,
    sub: [c.city, c.email?.endsWith('import.chasecontemporary.com') ? null : c.email].filter(Boolean).join(' · '),
    spend: Number(c.spend_cents || 0),
  })));
}
