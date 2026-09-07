import { db } from '../../../lib/db';
import { isStaff } from '../../../lib/identity';
export async function GET() {
  // Signed in is not the same as staff — this endpoint returns real collector
  // and inventory data, so it must never answer a stranger's account.
  if (!(await isStaff())) return new Response('Not authorised', { status: 403 });

  const { data } = await db.from('team_members').select('name, role').eq('active', true).order('name');
  return new Response(JSON.stringify(data || []), { headers: { 'Content-Type': 'application/json' } });
}
