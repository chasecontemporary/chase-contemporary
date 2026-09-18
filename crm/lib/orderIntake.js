import { db } from './db';
import { settleInvoice } from './settle';
import { shopifyReady, showProduct } from './shopify';

// Turning a Shopify order into what the engine already understands: a collector, a sale, an
// invoice, a payment, a purchase, a commission, a line on the timeline.
//
// Two paths arrive here. An order carrying note_attribute `engine_invoice_id` came from a pay
// link a rep made, so the invoice already exists and only needs settling. Everything else is an
// unattended storefront sale: nobody typed it, nobody is watching it, and before this it reached
// nothing at all. That one is built here, end to end.
//
// One rule runs through the whole file: the money chain is not reimplemented. `create_manual_invoice`
// builds the sale, the items, the invoice and the lines in one transaction; `settleInvoice` records
// the payment, books the purchases, marks the works sold, closes the lead and fires the commission
// trigger; `unsettle_invoice` unwinds exactly that. This file assembles the arguments and writes the
// order's own ledger row. It never books money by hand.

// The webhook route has no `must()` of its own (that lives in /api/act), so failures are raised
// here instead of being swallowed. A silent write failure in this file means money that arrived
// and was never recorded.
const must = (r, what) => {
  if (r?.error) throw new Error(`${what}: ${r.error.message}`);
  return r;
};

const PAY_METHOD = 'card, shopify';
const SYNTHETIC_DOMAIN = 'import.chasecontemporary.com';

const cents = (v) => {
  const n = Number(String(v ?? '0').replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};
const str = (v, n) => {
  const s = typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim();
  return s ? s.slice(0, n) : null;
};
const blank = (v) => v == null || String(v).trim() === '';
const isDuplicateKey = (e) => e?.code === '23505' || /duplicate key|already exists/i.test(e?.message || '');

// Shopify puts the buyer's address in up to three places and the email in up to three fields.
// Take the first one that actually holds something.
const pick = (...vals) => vals.find(v => !blank(v)) ?? null;

export const orderEmail = (order) => {
  const e = pick(order?.email, order?.customer?.email, order?.contact_email);
  if (e) return { email: String(e).trim().toLowerCase(), minted: false };
  // A phone with no email is still a person, exactly as capture.js treats a phone-only inquiry.
  const d = String(pick(order?.phone, order?.customer?.phone,
    order?.billing_address?.phone, order?.shipping_address?.phone) || '').replace(/\D/g, '');
  if (d.length >= 7) return { email: `phone+${d}@${SYNTHETIC_DOMAIN}`, minted: true };
  // Nothing to key on. Mint an address off the order number so the sale still lands on a record,
  // and let the review queue say that nobody can be contacted about it.
  return { email: `shopify-order-${order?.id}@${SYNTHETIC_DOMAIN}`, minted: true };
};

// ---------------------------------------------------------------------------------------------
// The collector
// ---------------------------------------------------------------------------------------------

// Match on email without caring about case, else create from whatever the order carries. An
// existing record is only ever filled in, never overwritten: the gallery's own typing beats
// anything a checkout form collected.
async function matchOrCreateCollector(order) {
  const { email, minted } = orderEmail(order);
  const cust = order.customer || {};
  const bill = order.billing_address || {};
  const ship = order.shipping_address || {};

  const fields = {
    first_name: str(pick(cust.first_name, bill.first_name, ship.first_name), 80),
    last_name: str(pick(cust.last_name, bill.last_name, ship.last_name), 80),
    phone: str(pick(order.phone, cust.phone, bill.phone, ship.phone), 40),
    company: str(pick(bill.company, ship.company), 120),
    address_line1: str(bill.address1, 200),
    address_line2: str(bill.address2, 200),
    city: str(pick(bill.city, ship.city), 80),
    state: str(pick(bill.province, ship.province), 80),
    zip: str(pick(bill.zip, ship.zip), 30),
    country: str(pick(bill.country, ship.country), 80),
    shipping_line1: str(ship.address1, 200),
    shipping_line2: str(ship.address2, 200),
    shipping_city: str(ship.city, 80),
    shipping_state: str(ship.province, 80),
    shipping_zip: str(ship.zip, 30),
    shipping_country: str(ship.country, 80),
  };

  // ilike, because the book holds addresses typed in every case. The pattern is escaped so an
  // address containing _ or % matches itself and not half the collectors in the gallery.
  const pattern = email.replace(/([\\%_])/g, '\\$1');
  const { data: found } = await db.from('collectors')
    .select('*').ilike('email', pattern).limit(1).maybeSingle();

  if (found) {
    const patch = {};
    for (const [k, v] of Object.entries(fields)) if (v && blank(found[k])) patch[k] = v;
    if (order.buyer_accepts_marketing === true && found.newsletter !== true) patch.newsletter = true;
    if (Object.keys(patch).length) {
      patch.updated_at = new Date().toISOString();
      must(await db.from('collectors').update(patch).eq('id', found.id), 'collector update');
    }
    return { collector: { ...found, ...patch }, created: false, minted };
  }

  const attempt = await db.from('collectors').insert({
    email,
    ...fields,
    newsletter: order.buyer_accepts_marketing === true,
    source: 'Shopify checkout',
    updated_at: new Date().toISOString(),
  }).select().single();
  if (attempt.error) {
    // Two orders from the same new person at the same moment, or an address already in the book
    // under a spelling ilike did not reach. Take the record that exists rather than failing.
    if (isDuplicateKey(attempt.error)) {
      const { data: raced } = await db.from('collectors')
        .select('*').ilike('email', pattern).limit(1).maybeSingle();
      if (raced) return { collector: raced, created: false, minted };
    }
    throw new Error(`collector insert: ${attempt.error.message}`);
  }
  return { collector: attempt.data, created: true, minted };
}

// ---------------------------------------------------------------------------------------------
// The lines
// ---------------------------------------------------------------------------------------------

// Every line on the order becomes an invoice line. A line whose product id matches a work in the
// book carries that work and will be marked sold; a line that matches nothing is still charged and
// still named, and sends the order to the review queue so a person works out what was bought.
async function buildLines(order) {
  const items = (order.line_items || []).filter(li => Number(li.quantity ?? 1) > 0);
  const productIds = [...new Set(items.map(li => str(li.product_id, 32))
    .filter(v => v && /^\d+$/.test(v)))];

  let works = [];
  if (productIds.length) {
    const { data } = await db.from('artworks')
      .select('id, title, artist, is_edition, available, shopify_product_id, price_cents')
      .in('shopify_product_id', productIds);
    works = data || [];
  }
  const byProduct = new Map(works.map(w => [String(w.shopify_product_id), w]));

  const lines = [];
  const matched = [];
  const unmatched = [];
  const originals = [];

  for (const li of items) {
    const qty = Math.max(1, Number(li.quantity ?? 1));
    const gross = cents(li.price) * qty;
    const amount = Math.max(0, gross - cents(li.total_discount));
    const work = byProduct.get(String(li.product_id));
    const line = {
      kind: 'work',
      artwork_id: work?.id || null,
      title: str(work?.title || li.title || li.name, 300) || 'Untitled',
      artist: str(work?.artist || li.vendor, 200),
      amount_cents: amount,
    };
    lines.push(line);
    if (work) {
      matched.push(work);
      // Originals are supposed to be unbuyable: price on request, always through a rep. One
      // selling itself means it was published wrong, so it is recorded and shouted about.
      if (work.is_edition !== true) originals.push(work);
    } else {
      unmatched.push(line);
    }
  }

  const shipping = cents(pick(order.total_shipping_price_set?.shop_money?.amount,
    (order.shipping_lines || []).reduce((s, l) => s + Number(l.price || 0), 0)));
  if (shipping > 0) lines.push({ kind: 'shipping', artwork_id: null, title: 'Shipping', artist: null, amount_cents: shipping });
  const tax = cents(order.total_tax);
  if (tax > 0) lines.push({ kind: 'tax', artwork_id: null, title: 'Tax', artist: null, amount_cents: tax });

  const lineTotal = lines.reduce((s, l) => s + l.amount_cents, 0);
  return { lines, matched, unmatched, originals, lineTotal };
}

// ---------------------------------------------------------------------------------------------
// Paid
// ---------------------------------------------------------------------------------------------

export async function handleOrderPaid(order) {
  if (!order?.id) throw new Error('The order carried no id, so nothing can be keyed on it.');
  const key = String(order.id);
  const name = str(order.name, 60) || `#${key}`;
  const attr = (order.note_attributes || []).find(x => x?.name === 'engine_invoice_id');
  const paylinkInvoiceId = str(attr?.value, 64);

  // The claim. Unique on the Shopify order id, so a webhook delivered twice, or orders/create and
  // orders/paid arriving for the same order, gets exactly one pass through everything below.
  const { data: claim, error: claimErr } = await db.from('shopify_orders').insert({
    shopify_order_id: key,
    order_name: name,
    total_cents: cents(order.total_price),
    financial_status: str(order.financial_status, 40),
    raw: order,
  }).select().single();
  if (claimErr) {
    if (isDuplicateKey(claimErr)) return { ok: true, duplicate: true, order_id: key };
    throw new Error(`order claim: ${claimErr.message}`);
  }

  // Path one: a pay link a rep made. The invoice, the sale and the lines already exist, so this
  // settles what is there and stops. Unchanged from the day the pay link shipped.
  if (paylinkInvoiceId) {
    await settleInvoice(paylinkInvoiceId, 'card · shopify');
    await db.from('activities').insert({
      entity_type: 'invoice', entity_id: paylinkInvoiceId,
      kind: 'paid_online', body: `Shopify order ${order.name || order.id} paid`, actor: 'shopify' });
    const { data: inv } = await db.from('invoices')
      .select('id, sale_id, collector_id').eq('id', paylinkInvoiceId).maybeSingle();
    await db.from('shopify_orders').update({
      invoice_id: inv?.id || null, sale_id: inv?.sale_id || null, collector_id: inv?.collector_id || null,
    }).eq('id', claim.id);
    return { ok: true, paylink: true, invoice_id: paylinkInvoiceId, order_id: key };
  }

  // Path two: an unattended storefront sale. Nothing about it exists yet.
  try {
    return await buildStorefrontSale(order, claim, key, name);
  } catch (e) {
    // Nothing was built, so let the claim go and let Shopify deliver it again. Keeping the row
    // would turn a transient database blip into an order that can never be retried.
    await db.from('shopify_orders').delete().eq('id', claim.id).is('invoice_id', null);
    const { data: still } = await db.from('shopify_orders').select('id').eq('id', claim.id).maybeSingle();
    if (still) await db.from('shopify_orders').update({
      needs_review: true,
      review_reason: `The engine failed part way through recording this order: ${String(e?.message || e).slice(0, 300)}`,
    }).eq('id', claim.id);
    throw e;
  }
}

async function buildStorefrontSale(order, claim, key, name) {
  const { collector, minted } = await matchOrCreateCollector(order);
  const { lines, unmatched, originals, lineTotal } = await buildLines(order);

  const reasons = [];
  if (originals.length) reasons.push(
    `${originals.length === 1 ? 'An original' : originals.length + ' originals'} sold on the website: ${originals.map(o => o.title).join(', ')}. Originals are meant to be price on request, so this was published wrong. Check it now.`);
  if (unmatched.length) reasons.push(
    `${unmatched.length} line${unmatched.length === 1 ? '' : 's'} on this order match no work in the book: ${unmatched.map(l => l.title).join(', ')}.`);
  const orderTotal = cents(order.total_price);
  if (orderTotal && lineTotal !== orderTotal) reasons.push(
    `Shopify collected $${Math.round(orderTotal / 100).toLocaleString()} but the lines come to $${Math.round(lineTotal / 100).toLocaleString()}. The invoice records the lines, so reconcile the difference.`);
  if (minted) reasons.push(
    'This order carried no email address, so the collector record has a placeholder and cannot be written to.');

  // An order that comes to nothing cannot become an invoice: a zero invoice takes a number, shows
  // the gallery no money owed and cannot be settled. Record it and put it in front of a person.
  if (lineTotal <= 0) {
    must(await db.from('shopify_orders').update({
      collector_id: collector.id, needs_review: true,
      review_reason: `Shopify order ${name} came to nothing, so no invoice was raised. ${reasons.join(' ')}`.trim(),
    }).eq('id', claim.id), 'order row update');
    return { ok: true, order_id: key, collector_id: collector.id, invoice_id: null, needs_review: true };
  }

  // One transaction builds the sale, its items, the invoice and its lines. An unattended sale has
  // no rep, so it stays unclaimed and the commission books to Unassigned until someone claims it.
  const { data: inv, error: invErr } = await db.rpc('create_manual_invoice', {
    p_collector_id: collector.id,
    p_lines: lines,
    p_owner: null,
    p_due: null,
    p_inquiry_id: null,
  });
  if (invErr) throw new Error(`invoice: ${invErr.message.replace(/^.*?:\s*/, '')}`);
  if (!inv?.id) throw new Error('The invoice function returned nothing.');

  // Stamp the link the moment the invoice exists. If anything below fails, the recovery path
  // must be able to tell "nothing was built" from "an invoice exists", or a retry double books.
  must(await db.from('shopify_orders')
    .update({ collector_id: collector.id, invoice_id: inv.id }).eq('id', claim.id), 'order row link');
  must(await db.from('invoices')
    .update({ notes: `Shopify order ${name}` }).eq('id', inv.id), 'invoice note');

  // create_manual_invoice only opens a sale for lines that carry a work, which is right for a rep
  // typing an invoice and wrong here: an order of nothing but unmatched lines is still a sale that
  // happened. Open one so the purchase, the fulfilment and the reversal all have something to hang on.
  let saleId = inv.sale_id;
  if (!saleId && unmatched.length) {
    const { data: sale } = must(await db.from('sales')
      .insert({ collector_id: collector.id, owner: null, status: 'invoiced' })
      .select().single(), 'sale insert');
    saleId = sale.id;
    must(await db.from('invoices').update({ sale_id: saleId }).eq('id', inv.id), 'invoice sale link');
  }
  // Unmatched lines are recorded on the sale by title, with no work attached.
  if (saleId && unmatched.length) must(await db.from('sale_items').insert(
    unmatched.map(l => ({ sale_id: saleId, artwork_id: null, title: l.title, artist: l.artist, agreed_cents: l.amount_cents }))
  ), 'unmatched sale items');

  if (saleId && reasons.length) must(await db.from('sales').update({
    needs_review: true, review_reason: reasons.join(' ').slice(0, 1000),
  }).eq('id', saleId), 'sale flag');

  must(await db.from('shopify_orders').update({
    sale_id: saleId || null,
    needs_review: reasons.length > 0, review_reason: reasons.length ? reasons.join(' ').slice(0, 1000) : null,
  }).eq('id', claim.id), 'order row update');

  // The money. settleInvoice records the payment, books the purchases, marks every matched work
  // sold and off the website, closes the lead, fires the commission trigger and tells the floor
  // through announcePayment. Nothing in that chain is repeated here.
  await settleInvoice(inv.id, PAY_METHOD);

  // Stamp the order on the payment so Finance can reconcile a payout line back to it.
  await db.from('payments').update({ external_ref: `shopify:${key}` })
    .eq('invoice_id', inv.id).is('external_ref', null);

  const usd = '$' + Math.round(lineTotal / 100).toLocaleString();
  const what = lines.filter(l => l.kind === 'work').map(l => l.title).join(', ');
  await db.from('activities').insert([
    { entity_type: 'collector', entity_id: collector.id, kind: 'purchase_online',
      body: `Bought ${what} on the website · ${usd} · order ${name}`, actor: 'shopify' },
    { entity_type: 'invoice', entity_id: inv.id, kind: 'paid_online',
      body: `Shopify order ${name} paid · ${usd}`, actor: 'shopify' },
  ]);
  if (reasons.length) await db.from('activities').insert({
    entity_type: 'invoice', entity_id: inv.id, kind: 'needs_review',
    body: reasons.join(' ').slice(0, 500), actor: 'shopify' });

  return {
    ok: true, order_id: key, collector_id: collector.id, invoice_id: inv.id, sale_id: saleId || null,
    needs_review: reasons.length > 0, originals: originals.length, unmatched: unmatched.length,
  };
}

// ---------------------------------------------------------------------------------------------
// Reversals
// ---------------------------------------------------------------------------------------------

// A refund and a cancellation are the same event to the engine: the money goes back, so the work
// goes back on sale, the purchase and the commission come off the books and the payments reverse.
// unsettle_invoice, the same function the Undo button calls, does all of it in one transaction.
async function reverse(orderId, { reason, refundCents } = {}) {
  const key = String(orderId || '');
  if (!key) return { ok: false, skipped: 'no order id' };

  const { data: row } = await db.from('shopify_orders')
    .select('*').eq('shopify_order_id', key).maybeSingle();
  if (!row) return { ok: true, skipped: 'that order never reached the engine' };
  if (row.refunded_at) return { ok: true, duplicate: true, order_id: key };

  if (!row.invoice_id) {
    must(await db.from('shopify_orders').update({
      refunded_at: new Date().toISOString(), financial_status: 'refunded',
    }).eq('id', row.id), 'order row reversal');
    return { ok: true, order_id: key, invoice_id: null };
  }

  const { data: inv } = await db.from('invoices')
    .select('id, sale_id, status').eq('id', row.invoice_id).maybeSingle();

  const { error } = await db.rpc('unsettle_invoice', { p_invoice_id: row.invoice_id });
  if (error) throw new Error(`unsettle: ${error.message}`);

  // Lines with no work behind them left a purchase that unsettle_invoice cannot see, because it
  // unwinds by artwork id. Take those off by hand so a refunded order leaves nothing on the ledger.
  if (inv?.sale_id) {
    const { data: loose } = await db.from('sale_items')
      .select('title, agreed_cents').eq('sale_id', inv.sale_id).is('artwork_id', null);
    for (const it of (loose || [])) {
      await db.from('purchases').delete()
        .eq('collector_id', row.collector_id).eq('source', 'engine')
        .is('artwork_id', null).eq('title', it.title).eq('amount_cents', it.agreed_cents);
    }
  }

  // Put every work back on the website, the same way the Undo button does.
  if (shopifyReady() && inv?.sale_id) {
    const { data: its } = await db.from('sale_items')
      .select('artwork_id').eq('sale_id', inv.sale_id).not('artwork_id', 'is', null);
    for (const it of (its || [])) {
      const { data: art } = await db.from('artworks')
        .select('shopify_product_id, site_status').eq('id', it.artwork_id).maybeSingle();
      if (art?.shopify_product_id && art.site_status === 'sold') {
        try {
          await showProduct(art.shopify_product_id);
          await db.from('artworks').update({ site_status: 'live' }).eq('id', it.artwork_id);
        } catch {}
      }
    }
  }

  // unsettle_invoice reopens the invoice, which is right for a misclick and wrong for a refund:
  // a reversed order must not read as money the gallery is still owed. Void it with the reason.
  must(await db.from('invoices').update({
    status: 'void', void_reason: `${reason} on Shopify order ${row.order_name || key}`.slice(0, 200),
  }).eq('id', row.invoice_id), 'invoice void');

  if (inv?.sale_id) must(await db.from('sales')
    .update({ status: 'lost' }).eq('id', inv.sale_id), 'sale reversal');

  const partial = refundCents != null && row.total_cents != null && refundCents > 0 && refundCents < row.total_cents;
  must(await db.from('shopify_orders').update({
    refunded_at: new Date().toISOString(),
    financial_status: 'refunded',
    ...(partial ? {
      needs_review: true,
      review_reason: `Shopify refunded $${Math.round(refundCents / 100).toLocaleString()} of a $${Math.round(row.total_cents / 100).toLocaleString()} order. The engine reversed the whole sale, so check what the collector actually keeps.`,
    } : {}),
  }).eq('id', row.id), 'order row reversal');

  await db.from('activities').insert({
    entity_type: 'invoice', entity_id: row.invoice_id, kind: 'payment_undone',
    body: `${reason} on Shopify order ${row.order_name || key} · settlement reversed`, actor: 'shopify' });
  if (row.collector_id) await db.from('activities').insert({
    entity_type: 'collector', entity_id: row.collector_id, kind: 'purchase_reversed',
    body: `${reason} on Shopify order ${row.order_name || key}`, actor: 'shopify' });

  // The collector stays. A person who bought and returned is still a person the gallery knows.
  return { ok: true, order_id: key, invoice_id: row.invoice_id, reversed: true };
}

export async function handleRefund(refund) {
  const amount = (refund?.transactions || []).reduce((s, t) => s + cents(t.amount), 0)
    || (refund?.refund_line_items || []).reduce((s, l) => s + cents(l.subtotal), 0) || null;
  return reverse(refund?.order_id, { reason: 'Refunded', refundCents: amount });
}

export async function handleOrderCancelled(order) {
  return reverse(order?.id, { reason: 'Cancelled' });
}

// ---------------------------------------------------------------------------------------------
// The queue
// ---------------------------------------------------------------------------------------------

// Orders the engine took but could not fully believe: an original that sold itself, a line
// matching no work, a total that does not add up, a buyer with no address. Today renders these.
export async function ordersNeedingReview(limit = 20) {
  const { data } = await db.from('shopify_orders')
    .select('id, shopify_order_id, order_name, review_reason, total_cents, created_at, invoice_id, collector_id, collectors(first_name, last_name, email), invoices(invoice_number)')
    .eq('needs_review', true).is('refunded_at', null)
    .order('created_at', { ascending: false }).limit(limit);
  return data || [];
}
