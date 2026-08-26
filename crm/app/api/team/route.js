import { db } from '../../../lib/db';
export async function GET() {
  const { data } = await db.from('team_members').select('name, role').eq('active', true).order('name');
  return new Response(JSON.stringify(data || []), { headers: { 'Content-Type': 'application/json' } });
}
