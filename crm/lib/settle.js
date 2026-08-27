import { db } from './db';

// Close-out: what happens when an invoice is fully collected — works flip sold,
// purchases land on the ledger, sale + leads close. Shared by every payment path.
export async function closeOutInvoice(inv) {
  if (inv.sale_id) {
    const { data: items } = await db.from('sale_items').select('*').eq('sale_id', inv.sale_id);
    for (const it of (items || [])) {
      await db.from('purchases').insert({
        collector_id: inv.collector_id, artwork_id: it.artwork_id,
        title: it.title, artist: it.artist, amount_cents: it.agreed_cents, source: 'engine' });
      if (it.artwork_id) await db.from('artworks').update({ available: false }).eq('id', it.artwork_id);
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

// Record money against an invoice. Partial amounts accumulate; commissions accrue per
// settled payment via the DB trigger; the invoice closes out when the balance reaches zero.
export async function recordPayment(invoiceId, amountCents, method) {
  const { data: inv } = await db.from('invoices').select('*').eq('id', invoiceId).single();
  if (!inv || inv.status !== 'open') return null;
  const total = inv.amount_cents + (inv.tax_cents || 0) + (inv.shipping_cents || 0);
  const { data: prior } = await db.from('payments').select('amount_cents').eq('invoice_id', invoiceId).eq('status', 'settled');
  const received = (prior || []).reduce((s, p) => s + Number(p.amount_cents), 0);
  const amount = amountCents ?? (total - received);          // no amount = settle the balance
  const { data: pay } = await db.from('payments')
    .insert({ invoice_id: invoiceId, amount_cents: amount, method: method || null, status: 'pending' })
    .select().single();
  if (pay) await db.from('payments')
    .update({ status: 'settled', settled_at: new Date().toISOString() }).eq('id', pay.id);
  const nowReceived = received + amount;
  if (nowReceived >= total) {
    await db.from('invoices').update({ status: 'paid', paid_at: new Date().toISOString(),
      ...(method ? { method } : {}) }).eq('id', invoiceId);
    await closeOutInvoice(inv);
  }
  return { inv, received: nowReceived, total, closed: nowReceived >= total };
}

// Full settle in one step (webhooks, mark-paid) — same path, balance-sized payment.
export async function settleInvoice(invoiceId, method) {
  const r = await recordPayment(invoiceId, null, method);
  return r ? r.inv : null;
}
