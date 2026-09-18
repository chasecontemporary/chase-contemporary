import { drain } from '../../../../lib/publishing';
import { isStaff } from '../../../../lib/identity';

// Drain the publishing queue: push what is queued to Shopify as drafts, switch what Bernie
// approved to active. Two ways in, because it is both a background job and a button:
//   the cron calls it with Authorization: Bearer <CRON_SECRET>
//   the approvals page calls it as a signed-in person pressing "push the next batch"
// Both are safe to run at any time. Nothing here is destructive and every step is idempotent.
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function run(req) {
  const s = process.env.CRON_SECRET;
  const authed = !!s && req.headers.get('authorization') === `Bearer ${s}`;
  if (!authed && !(await isStaff())) return new Response('unauthorized', { status: 401 });
  const url = new URL(req.url);
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit')) || 20));
  const result = await drain({ limit });
  return Response.json(result);
}

export const GET = run;
export const POST = run;
