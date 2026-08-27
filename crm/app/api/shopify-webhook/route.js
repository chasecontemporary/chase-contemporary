import crypto from 'crypto';
import { db } from '../../../lib/db';
import { settleInvoice } from '../../../lib/settle';

export async function POST(req) {
  const secret = process.env.SHOPIFY_API_SECRET;
  if (!secret) return new Response('not configured', { status: 503 });
  const raw = await req.text();
  const digest = crypto.createHmac('sha256', secret).update(raw, 'utf8').digest('base64');
  const given = req.headers.get('x-shopify-hmac-sha256') || '';
  const a = Buffer.from(digest), b = Buffer.from(given);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b))
    return new Response('bad signature', { status: 401 });
  const order = JSON.parse(raw);
  const attr = (order.note_attributes || []).find(x => x.name === 'engine_invoice_id');
  if (attr?.value) {
    await settleInvoice(attr.value, 'card · shopify');
    await db.from('activities').insert({ entity_type: 'invoice', entity_id: attr.value,
      kind: 'paid_online', body: `Shopify order ${order.name || order.id} paid`, actor: 'shopify' });
  }
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
