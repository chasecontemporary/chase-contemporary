import { db } from '../../../lib/db';
import { isStaff } from '../../../lib/identity';
import { suggestTax } from '../../../lib/tax';

// Tax suggestion for the sale wizard: ship-to (else billing) state of the collector.
export async function GET(req) {
  if (!(await isStaff())) return new Response('forbidden', { status: 403 });
  const u = new URL(req.url);
  const subtotal = Number(u.searchParams.get('subtotal') || 0);
  let state = u.searchParams.get('state'), zip = u.searchParams.get('zip'), country = u.searchParams.get('country');
  const cid = u.searchParams.get('collector_id');
  if (cid && !state) {
    const { data: c } = await db.from('collectors').select('state, zip, country, shipping_state, shipping_zip, shipping_country').eq('id', cid).single();
    state = c?.shipping_state || c?.state; zip = c?.shipping_zip || c?.zip; country = c?.shipping_country || c?.country;
  }
  return Response.json(await suggestTax({ state, zip, country, subtotalCents: Math.round(subtotal * 100) }));
}
