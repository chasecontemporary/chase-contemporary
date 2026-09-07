import { db } from './db';
import { shopifyReady, hideProduct } from './shopify';
import { announcePayment } from './notify';

// Close-out: what happens when an invoice is fully collected — works flip sold,
// purchases land on the ledger, sale + leads close. Shared by every payment path.
export async function closeOutInvoice(inv) {
  if (inv.sale_id) {
    const { data: items } = await db.from('sale_items').select('*').eq('sale_id', inv.sale_id);
    for (const it of (items || [])) {
      await db.from('purchases').insert({
        collector_id: inv.collector_id, artwork_id: it.artwork_id,
        title: it.title, artist: it.artist, amount_cents: it.agreed_cents, source: 'engine' });
      if (it.artwork_id) {
        await db.from('artworks').update({ available: false }).eq('id', it.artwork_id);
        await syncSold(it.artwork_id);
      }
    }
    await db.from('sales').update({ status: 'paid' }).eq('id', inv.sale_id);
    const inqIds = (items || []).map(i => i.inquiry_id).filter(Boolean);
    if (inqIds.length) await db.from('inquiries')
      .update({ status: 'paid', stage_changed_at: new Date().toISOString() }).in('id', inqIds);
  } else if (inv.inquiry_id) {
    await db.from('inquiries')
      .update({ status: 'paid', stage_changed_at: new Date().toISOString() }).eq('id', inv.inquiry_id);
  }
}

// The website must stop offering a work the moment it is sold. Best effort: a Shopify
// hiccup must never fail a settlement, so this logs and moves on.
export async function syncSold(artworkId) {
  if (!shopifyReady()) return;
  try {
    const { data: a } = await db.from('artworks').select('shopify_product_id, site_status, title').eq('id', artworkId).single();
    if (!a?.shopify_product_id || a.site_status === 'sold') return;
    await hideProduct(a.shopify_product_id);
    await db.from('artworks').update({ site_status: 'sold' }).eq('id', artworkId);
    await db.from('activities').insert({ entity_type: 'artwork', entity_id: artworkId,
      kind: 'site_hidden', body: 'sold: taken off the website', actor: 'system' });
  } catch (e) {
    await db.from('activities').insert({ entity_type: 'artwork', entity_id: artworkId,
      kind: 'site_sync_failed', body: String(e?.message || e).slice(0, 200), actor: 'system' });
  }
}

// Record money against an invoice. Partial amounts accumulate; commissions accrue per
// settled payment via the DB trigger; the invoice closes out when the balance reaches zero.
export async function recordPayment(invoiceId, amountCents, method) {
  const { data: inv } = await db.from('invoices').select('*').eq('id', invoiceId).single();
  if (!inv) throw new Error('That invoice no longer exists.');
  if (inv.status !== 'open') throw new Error('That invoice is already closed.');
  const total = inv.amount_cents + (inv.tax_cents || 0) + (inv.shipping_cents || 0);
  const { data: prior } = await db.from('payments').select('amount_cents').eq('invoice_id', invoiceId).eq('status', 'settled');
  const received = (prior || []).reduce((s, p) => s + Number(p.amount_cents), 0);
  const balance = total - received;
  const amount = amountCents ?? balance;                     // no amount = settle the balance
  // Guardrails: money that can't be right shouldn't be quietly accepted.
  if (!Number.isFinite(amount) || amount <= 0)
    throw new Error('Enter a payment amount greater than zero.');
  if (amount > balance)
    throw new Error(`That is more than the ${(balance / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })} still owed. Record the balance, or check the amount.`);
  const { data: pay } = await db.from('payments')
    .insert({ invoice_id: invoiceId, amount_cents: amount, method: method || null, status: 'pending' })
    .select().single();
  if (pay) await db.from('payments')
    .update({ status: 'settled', settled_at: new Date().toISOString() }).eq('id', pay.id);
  const nowReceived = received + amount;
  const closed = nowReceived >= total;
  if (closed) {
    await db.from('invoices').update({ status: 'paid', paid_at: new Date().toISOString(),
      ...(method ? { method } : {}) }).eq('id', invoiceId);
    await closeOutInvoice(inv);
  }
  // tell the floor and the owner; never let an alert failure fail the payment
  try {
    const { data: full } = await db.from('invoices').select('id, invoice_number, title, sale_id, inquiry_id, collectors(first_name, last_name)').eq('id', invoiceId).single();
    let owner = null;
    if (full?.sale_id) owner = (await db.from('sales').select('owner').eq('id', full.sale_id).single()).data?.owner;
    if (!owner && full?.inquiry_id) owner = (await db.from('inquiries').select('owner').eq('id', full.inquiry_id).single()).data?.owner;
    announcePayment({ invoice: full || inv, amountCents: amount, closed, owner }).catch(() => {});
  } catch {}
  return { inv, received: nowReceived, total, closed };
}

// Full settle in one step (webhooks, mark-paid) — same path, balance-sized payment.
export async function settleInvoice(invoiceId, method) {
  const r = await recordPayment(invoiceId, null, method);
  return r ? r.inv : null;
}
