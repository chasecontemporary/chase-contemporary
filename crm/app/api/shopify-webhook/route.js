import crypto from 'crypto';
import { handleOrderPaid, handleRefund, handleOrderCancelled } from '../../../lib/orderIntake';

// Shopify talking back to the engine. Verify, parse, dispatch: every decision about what an
// order means to the gallery lives in lib/orderIntake.js, so this file stays the door.
//
// Shopify retries a webhook that does not answer 200, up to 48 hours. That is the right
// behaviour for a genuine failure and a stampede for anything we have already handled, so the
// intake is idempotent on the order id and this route answers 200 for everything it understood.

export async function POST(req) {
  const secret = process.env.SHOPIFY_API_SECRET;
  if (!secret) return new Response('not configured', { status: 503 });
  const raw = await req.text();
  const digest = crypto.createHmac('sha256', secret).update(raw, 'utf8').digest('base64');
  const given = req.headers.get('x-shopify-hmac-sha256') || '';
  const a = Buffer.from(digest), b = Buffer.from(given);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b))
    return new Response('bad signature', { status: 401 });

  const topic = (req.headers.get('x-shopify-topic') || '').toLowerCase();
  let body;
  try { body = JSON.parse(raw); }
  catch { return new Response(JSON.stringify({ ok: true, ignored: 'unparseable' }), { status: 200 }); }

  try {
    let result = null;
    switch (topic) {
      // Both arrive for a paid checkout and either may arrive first. The order id is the
      // idempotency key, so whichever lands second does nothing.
      case 'orders/paid':
      case 'orders/create':
        result = await handleOrderPaid(body);
        break;
      case 'refunds/create':
        result = await handleRefund(body);
        break;
      case 'orders/cancelled':
        result = await handleOrderCancelled(body);
        break;
      default:
        return new Response(JSON.stringify({ ok: true, ignored: topic || 'no topic' }), { status: 200 });
    }
    return new Response(JSON.stringify({ ok: true, ...(result || {}) }), { status: 200 });
  } catch (e) {
    // Answering 500 asks Shopify to deliver it again, which is what we want: the intake either
    // released its claim on the order (nothing was built) or kept it and flagged the order for a
    // person, in which case the retry is a no-op. Either way the failure is on the server log.
    console.error('[shopify-webhook]', topic, body?.id, String(e?.message || e));
    return new Response(JSON.stringify({ ok: false }), { status: 500 });
  }
}
