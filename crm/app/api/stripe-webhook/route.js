import Stripe from 'stripe';
import { db } from '../../../lib/db';
import { settleInvoice } from '../../../lib/settle';

export async function POST(req) {
  const key = process.env.STRIPE_SECRET_KEY, whsec = process.env.STRIPE_WEBHOOK_SECRET;
  if (!key || !whsec) return new Response('not configured', { status: 503 });
  const stripe = new Stripe(key);
  let event;
  try {
    event = stripe.webhooks.constructEvent(await req.text(),
      req.headers.get('stripe-signature'), whsec);
  } catch {
    return new Response('bad signature', { status: 400 });
  }
  if (event.type === 'checkout.session.completed') {
    const s = event.data.object;
    const invoiceId = s.metadata?.invoice_id;
    if (invoiceId && s.payment_status === 'paid') {
      const method = s.payment_method_types?.includes('us_bank_account') ? 'ach' : 'card';
      await settleInvoice(invoiceId, method);
      await db.from('activities').insert({ entity_type: 'invoice', entity_id: invoiceId,
        kind: 'paid_online', body: 'Stripe checkout completed', actor: 'stripe' });
    }
  }
  return new Response(JSON.stringify({ received: true }), { status: 200 });
}
