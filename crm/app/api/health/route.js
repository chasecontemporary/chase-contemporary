import { db } from '../../../lib/db';
import { dbReachable, listSpill } from '../../../lib/spill';

export const dynamic = 'force-dynamic';

// Public, deliberately boring: no data, just whether the machine is working. Point an
// uptime monitor at this — if `ok` goes false, capture is degraded and someone must look.
export async function GET() {
  const [up, spill] = await Promise.all([dbReachable(db), listSpill()]);
  const body = {
    ok: up && spill.length === 0,
    database: up ? 'up' : 'down',
    parked_inquiries: spill.length,
    checked_at: new Date().toISOString(),
  };
  return new Response(JSON.stringify(body), {
    status: up ? 200 : 503,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
