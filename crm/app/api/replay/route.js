import { db } from '../../../lib/db';
import { persist } from '../../../lib/capture';
import { listSpill, readSpill, dropSpill, dbReachable } from '../../../lib/spill';

export const dynamic = 'force-dynamic';

// Drain inquiries that were parked while the database was unreachable. Behind the CRM
// login (middleware). Each one is only deleted from the parking store once it has landed
// in the database, so a half-finished replay loses nothing and can simply be run again.
export async function POST(req) {
  const back = '/today';
  if (!(await dbReachable(db)))
    return redirect(req, back, 'The database is still unreachable — try again once it is back.');

  const blobs = await listSpill();
  let replayed = 0, failed = 0;
  for (const b of blobs) {
    const rec = await readSpill(b.url);
    const p = rec?.payload;
    const email = (p?.email || '').trim().toLowerCase();
    if (!p || !email) { failed++; continue; }
    try {
      await persist(p, email);
      await dropSpill(b.url);
      replayed++;
    } catch {
      failed++;                       // stays parked, safe to retry
    }
  }
  const msg = failed
    ? `Replayed ${replayed}. ${failed} could not be replayed and are still parked.`
    : `Replayed ${replayed} inquir${replayed === 1 ? 'y' : 'ies'} into the pipeline.`;
  return redirect(req, back, failed ? msg : null, failed ? null : msg);
}

function redirect(req, back, err, ok) {
  const u = new URL(back, req.url);
  if (err) u.searchParams.set('err', err);
  if (ok) u.searchParams.set('ok', ok);
  return new Response(null, { status: 303, headers: { Location: u.toString() } });
}
