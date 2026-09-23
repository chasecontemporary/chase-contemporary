// Shopify Admin API client for the payment lane. Env-gated:
// SHOPIFY_ADMIN_TOKEN (shpat_...) + SHOPIFY_API_SECRET (webhook HMAC) unlock it.
const STORE = process.env.SHOPIFY_STORE || 'chasecontemporaryshop.myshopify.com';
const API = `https://${STORE}/admin/api/2025-01`;

export const shopifyReady = () => !!process.env.SHOPIFY_ADMIN_TOKEN;

export async function shopify(path, method = 'GET', body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_TOKEN,
      'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Shopify ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

// Draft order = the pay link: custom line items, invoice_id carried in note attributes.
/**
 * A link a collector can pay on a card. Shopify is the payment processor, so this raises a
 * draft order and hands back its invoice URL.
 *
 * `amountCents` is the whole point of the options: a gallery takes a deposit and then a
 * balance, so a link has to be raisable for part of an invoice. Paying part of one is recorded
 * as part of one, and the invoice closes itself when enough has arrived.
 *
 * Card is not always the right answer. At this gallery's prices the processing fee on a large
 * original is thousands of dollars, so `payLinkAdvice` below exists to say so out loud before
 * anyone sends one.
 */
export async function createPayLink(inv, collector, { amountCents, label } = {}) {
  const full = Number(inv.amount_cents || 0) + Number(inv.tax_cents || 0) + Number(inv.shipping_cents || 0);
  const part = Number(amountCents) > 0 && Number(amountCents) < full ? Math.round(Number(amountCents)) : null;
  const ref = String(inv.invoice_number ?? '').padStart(4, '0');
  const line_items = part
    ? [{ title: `${label || 'Part payment'} on invoice ${ref}`, price: (part / 100).toFixed(2),
        quantity: 1, requires_shipping: false, taxable: false }]
    : [{ title: (inv.title || 'Artwork') + (inv.artist ? ' · ' + inv.artist : ''),
        price: (inv.amount_cents / 100).toFixed(2), quantity: 1, requires_shipping: false,
        taxable: false }];
  if (!part && inv.shipping_cents) line_items.push({ title: 'Shipping', quantity: 1, taxable: false,
    price: (inv.shipping_cents / 100).toFixed(2), requires_shipping: false });
  const email = collector?.email && !collector.email.endsWith('import.chasecontemporary.com')
    ? collector.email : undefined;
  const payload = { draft_order: {
    line_items,
    ...(email ? { email } : {}),
    note: `Chase Engine invoice ${String(inv.invoice_number).padStart(4, '0')}`,
    note_attributes: [{ name: 'engine_invoice_id', value: inv.id }],
    tags: 'chase-engine',
    ...(!part && inv.tax_cents ? { tax_lines: [{ title: 'Sales tax', rate: 0,
      price: (inv.tax_cents / 100).toFixed(2) }] } : {}),
  } };
  const { draft_order } = await shopify('/draft_orders.json', 'POST', payload);
  return { url: draft_order.invoice_url, draftId: String(draft_order.id) };
}

// Shopify Payments takes a percentage of every card payment. On a gallery original that is
// real money, so the engine says the number out loud rather than letting a rep find out in the
// payout. Above the ceiling a wire is the sane instrument and the UI says so.
export const CARD_FEE_PCT = Number(process.env.CARD_FEE_PCT || 2.9);
export const CARD_FEE_FLAT_CENTS = Number(process.env.CARD_FEE_FLAT_CENTS || 30);
export const CARD_CEILING_CENTS = Number(process.env.CARD_CEILING_CENTS || 2500000);
export function payLinkAdvice(amountCents) {
  const amount = Number(amountCents || 0);
  const fee = Math.round(amount * (CARD_FEE_PCT / 100)) + CARD_FEE_FLAT_CENTS;
  return { fee, tooBig: amount > CARD_CEILING_CENTS,
    ceiling: CARD_CEILING_CENTS, pct: CARD_FEE_PCT };
}

// One-time webhook registration (idempotent) — called on first pay-link creation.
// Every topic the engine actually handles, not just the one the pay link needed. A storefront
// sale, a refund and a cancellation all have to reach the engine or the books drift from the
// shop. Idempotent: it only registers what is missing.
export const WEBHOOK_TOPICS = ['orders/paid', 'orders/create', 'refunds/create', 'orders/cancelled'];

export async function ensureWebhook(origin) {
  const { webhooks } = await shopify('/webhooks.json');
  const address = origin + '/api/shopify-webhook';
  const have = new Set((webhooks || []).filter(w => w.address === address).map(w => w.topic));
  const added = [];
  for (const topic of WEBHOOK_TOPICS) {
    if (have.has(topic)) continue;
    try {
      await shopify('/webhooks.json', 'POST', { webhook: { topic, address, format: 'json' } });
      added.push(topic);
    } catch { /* one failing topic must not stop the rest */ }
  }
  return added;
}

// Telling the shop that a work has shipped.
//
// An edition bought on the site creates the sale in the engine, and until now nothing ever went
// back the other way: the Shopify order stayed unfulfilled for good, the collector never got the
// tracking email the shop would normally send, and the store's own order list was wrong.
//
// Shopify wants fulfilment expressed against fulfilment orders rather than the order itself on
// current API versions, so this reads them first and fulfils whatever is still open.
export async function fulfillShopifyOrder(orderId, { trackingNumber, trackingCompany, trackingUrl, notifyCustomer = false } = {}) {
  if (!shopifyReady() || !orderId) return { ok: false, reason: 'not connected' };
  const { fulfillment_orders: fos } = await shopify(`/orders/${orderId}/fulfillment_orders.json`);
  const open = (fos || []).filter(f => ['open', 'in_progress', 'scheduled'].includes(f.status));
  if (!open.length) return { ok: true, already: true };
  const done = [];
  for (const fo of open) {
    const body = { fulfillment: {
      line_items_by_fulfillment_order: [{ fulfillment_order_id: fo.id }],
      notify_customer: !!notifyCustomer,
      ...(trackingNumber ? { tracking_info: {
        number: trackingNumber,
        company: trackingCompany || undefined,
        url: trackingUrl || undefined,
      } } : {}),
    } };
    const r = await shopify('/fulfillments.json', 'POST', body);
    if (r?.fulfillment?.id) done.push(r.fulfillment.id);
  }
  return { ok: true, fulfillments: done };
}

// A refund or a cancellation should not leave a fulfilment claiming the work is on its way.
export async function cancelShopifyFulfillment(fulfillmentId) {
  if (!shopifyReady() || !fulfillmentId) return { ok: false };
  await shopify(`/fulfillments/${fulfillmentId}/cancel.json`, 'POST', {});
  return { ok: true };
}

// Push an on-hand work to the site as a DRAFT product — invisible until published.
// Needs write_products scope on the custom app token.
export async function pushProduct(a) {
  const payload = { product: {
    title: a.title,
    vendor: a.artist || 'Chase Contemporary',
    status: 'draft',
    product_type: a.medium && a.medium.length < 60 ? a.medium : 'Original Artwork',
    tags: ['chase-engine', a.artist].filter(Boolean).join(', '),
    body_html: [a.medium, a.dims_h_in ? `${a.dims_h_in} × ${a.dims_w_in} in` : null]
      .filter(Boolean).join(' · '),
    images: a.image_url ? [{ src: a.image_url }] : [],
    variants: [{ price: a.price_cents > 0 ? (a.price_cents / 100).toFixed(2) : '0.00',
      inventory_management: null, requires_shipping: true, taxable: true,
      sku: a.artcloud_id || undefined }],
  } };
  const { product } = await shopify('/products.json', 'POST', payload);
  return { productId: product.id, handle: product.handle };
}

// Sold-sync: the website must never offer a work the gallery has already sold.
// Settlement hides the product (status draft: the URL stops resolving, nothing is deleted);
// an undo puts it back exactly as it was. Both idempotent, both env-gated by the caller.
export async function setProductStatus(productId, status) {
  const { product } = await shopify(`/products/${productId}.json`, 'PUT', { product: { id: productId, status } });
  return product?.status;
}
export const hideProduct = (productId) => setProductStatus(productId, 'draft');
export const showProduct = (productId) => setProductStatus(productId, 'active');
