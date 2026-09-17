import { db } from './db';

// The gallery's signing policy, in one place, so that "what has to be signed" is a rule the
// system applies rather than something a salesperson has to remember on a Friday afternoon.
//
// How art sales at this level are actually papered:
//   Every sale        the invoice is the bill of sale, and the certificate of authenticity
//                     goes with the work. Neither needs a countersignature.
//   Larger sales      a purchase agreement, signed by the collector and countersigned by the
//                     gallery, before the work leaves. The threshold is a number the gallery
//                     sets, not a law: SIGNING_THRESHOLD_CENTS, default $50,000.
//   Payment plans     the same, whatever the total, because the terms are the whole point.
//   On approval       a work released before purchase never leaves without the approval
//                     agreement signed. There is no threshold on this one.
//
// Nothing here sends anything. It answers two questions: what does this sale need, and what
// is still missing. The Signing page and Today read it; the wizard warns from it.

export const THRESHOLD = () => Number(process.env.SIGNING_THRESHOLD_CENTS || 5000000);

// A signature is only meaningful once the envelope is completed. Everything else is in
// flight, and "declined" or "voided" means the paper is not done and somebody must act.
export const SIGNED = 'completed';
export const IN_FLIGHT = ['sent', 'delivered'];
export const STUCK = ['declined', 'voided'];

export const DOC_LABEL = {
  invoice: 'Invoice', coa: 'Certificate of authenticity', tearsheet: 'Tear sheet',
  purchase_agreement: 'Purchase agreement', approval: 'On approval agreement',
  consignment: 'Consignment agreement',
};

export const STATUS_LABEL = {
  draft: 'Not sent', sent: 'Waiting on the collector', delivered: 'Opened, not signed yet',
  completed: 'Signed', declined: 'Declined', voided: 'Voided',
};

/**
 * What this sale has to have signed. `total_cents` is the whole invoice, tax and shipping
 * included, because the threshold is about the size of the deal, not the art alone.
 */
export function required({ totalCents = 0, hasPaymentPlan = false, onApproval = false } = {}) {
  const need = [];
  if (onApproval) need.push('approval');
  if (hasPaymentPlan || Number(totalCents) >= THRESHOLD()) need.push('purchase_agreement');
  return need;
}

export const requiredReason = ({ totalCents = 0, hasPaymentPlan = false }) =>
  hasPaymentPlan ? 'the sale is on a payment plan'
    : `the sale is over ${'$' + Math.round(THRESHOLD() / 100).toLocaleString()}`;

/**
 * Everything with a signature state, newest first, already grouped the way a person asks
 * about it: what are we waiting on, what is stuck, what is done.
 */
export async function signingBoard({ days = 180 } = {}) {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { data: docs } = await db.from('documents')
    .select('*, collectors(id, first_name, last_name, email), invoices(id, invoice_number, amount_cents, tax_cents, shipping_cents, status)')
    .gte('created_at', since).order('created_at', { ascending: false }).limit(400);
  const rows = docs || [];
  const signable = rows.filter(d => d.envelope_id || d.status !== 'draft');
  return {
    waiting: signable.filter(d => IN_FLIGHT.includes(d.status)),
    stuck: signable.filter(d => STUCK.includes(d.status)),
    signed: signable.filter(d => d.status === SIGNED),
    all: rows,
  };
}

/**
 * Sales whose paper the policy says is missing: an invoice big enough to need an agreement
 * that has none signed and none in flight. This is the list that stops a work shipping on a
 * handshake.
 */
export async function missingPaper() {
  const { data: invs } = await db.from('invoices')
    .select('id, invoice_number, amount_cents, tax_cents, shipping_cents, status, issued_at, deposit_cents, collectors(id, first_name, last_name)')
    .in('status', ['open', 'paid']).order('issued_at', { ascending: false }).limit(200);
  const list = invs || [];
  if (!list.length) return [];
  const { data: docs } = await db.from('documents')
    .select('invoice_id, kind, status').in('invoice_id', list.map(i => i.id));
  const have = {};
  (docs || []).forEach(d => {
    if (d.kind !== 'purchase_agreement') return;
    const state = d.status === SIGNED ? 'signed' : STUCK.includes(d.status) ? 'stuck' : 'in flight';
    // signed beats in flight beats stuck, so one bad envelope does not hide a good one
    const rank = { signed: 3, 'in flight': 2, stuck: 1 };
    if (!have[d.invoice_id] || rank[state] > rank[have[d.invoice_id]]) have[d.invoice_id] = state;
  });
  const total = (i) => Number(i.amount_cents || 0) + Number(i.tax_cents || 0) + Number(i.shipping_cents || 0);
  return list
    .filter(i => required({ totalCents: total(i), hasPaymentPlan: Number(i.deposit_cents || 0) > 0 }).includes('purchase_agreement'))
    .filter(i => have[i.id] !== 'signed' && have[i.id] !== 'in flight')
    .map(i => ({ ...i, total_cents: total(i), why: requiredReason({ totalCents: total(i), hasPaymentPlan: Number(i.deposit_cents || 0) > 0 }), state: have[i.id] || 'nothing sent' }));
}
