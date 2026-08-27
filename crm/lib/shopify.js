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
export async function createPayLink(inv, collector) {
  const line_items = [{ title: (inv.title || 'Artwork') + (inv.artist ? ' · ' + inv.artist : ''),
    price: (inv.amount_cents / 100).toFixed(2), quantity: 1, requires_shipping: false,
    taxable: false }];
  if (inv.shipping_cents) line_items.push({ title: 'Shipping', quantity: 1, taxable: false,
    price: (inv.shipping_cents / 100).toFixed(2), requires_shipping: false });
  const email = collector?.email && !collector.email.endsWith('import.chasecontemporary.com')
    ? collector.email : undefined;
  const payload = { draft_order: {
    line_items,
    ...(email ? { email } : {}),
    note: `Chase Engine invoice ${String(inv.invoice_number).padStart(4, '0')}`,
    note_attributes: [{ name: 'engine_invoice_id', value: inv.id }],
    tags: 'chase-engine',
    ...(inv.tax_cents ? { tax_lines: [{ title: 'Sales tax', rate: 0,
      price: (inv.tax_cents / 100).toFixed(2) }] } : {}),
  } };
  const { draft_order } = await shopify('/draft_orders.json', 'POST', payload);
  return { url: draft_order.invoice_url, draftId: String(draft_order.id) };
}

// One-time webhook registration (idempotent) — called on first pay-link creation.
export async function ensureWebhook(origin) {
  const { webhooks } = await shopify('/webhooks.json');
  const address = origin + '/api/shopify-webhook';
  if ((webhooks || []).some(w => w.address === address && w.topic === 'orders/paid')) return;
  await shopify('/webhooks.json', 'POST', { webhook: { topic: 'orders/paid', address, format: 'json' } });
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
