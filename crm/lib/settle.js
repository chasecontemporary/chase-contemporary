import { db } from './db';

// The one settlement chain, used by manual mark-paid AND payment webhooks:
// invoice -> settled payment -> commissions trigger -> purchases per item ->
// works flip sold -> sale + leads close.
export async function settleInvoice(invoiceId, method) {
  const { data: cur } = await db.from('invoices').select('status').eq('id', invoiceId).single();
  if (!cur || cur.status === 'paid') return null;   // idempotent: never settle twice
  const { data: inv } = await db.from('invoices')
    .update({ status: 'paid', paid_at: new Date().toISOString(), ...(method ? { method } : {}) })
    .eq('id', invoiceId).select().single();
  if (!inv) return null;
  const total = inv.amount_cents + (inv.tax_cents || 0) + (inv.shipping_cents || 0);
  const { data: pay } = await db.from('payments')
    .insert({ amount_cents: total, method: method || inv.method, status: 'pending' }).select().single();
  if (pay) await db.from('payments')
    .update({ status: 'settled', settled_at: new Date().toISOString() }).eq('id', pay.id);
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
  return inv;
}
