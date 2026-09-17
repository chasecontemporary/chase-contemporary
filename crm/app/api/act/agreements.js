// Agreements and certificates: generate the paper, store it on Blob, file it in `documents`.
// Called from the act route; returns true when it handled the action.
//
// agreement_pdf  kind=purchase  id = the invoice   -> purchase agreement
// agreement_pdf  kind=approval  id = the hold      -> on approval agreement
// coa_refresh    artwork_id (or id)                -> certificate of authenticity, refreshed
//
// Nothing here sends anything to a collector. A person presses Send for signature afterwards.
import { buildPurchaseAgreement, buildApprovalAgreement, inventoryNo } from '../../../lib/agreementsPdf';
import { buildCoa } from '../../../lib/collateralPdf';

const slugOf = (s, n = 50) => String(s || 'work').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, n) || 'work';

export async function handleAgreements({ action, form, id, rep, db, must, put }) {
  if (action === 'agreement_pdf') {
    const kind = form.get('kind') || 'purchase';
    if (!['purchase', 'approval'].includes(kind)) throw new Error('That is not an agreement the engine makes.');
    if (!id) throw new Error('Pick the invoice or the approval first.');

    if (kind === 'purchase') {
      const { data: inv } = await db.from('invoices').select('*, collectors(*)').eq('id', id).single();
      if (!inv) throw new Error('That invoice is no longer here.');
      const { data: lines } = await db.from('invoice_lines').select('*').eq('invoice_id', id).order('sort');
      let rows = lines || [];
      if (!rows.length && inv.sale_id) {
        const { data: si } = await db.from('sale_items').select('artwork_id, title, artist, agreed_cents').eq('sale_id', inv.sale_id);
        rows = (si || []).map((it, ix) => ({ kind: 'work', artwork_id: it.artwork_id, title: it.title,
          artist: it.artist, amount_cents: it.agreed_cents, sort: ix }));
        if (inv.shipping_cents) rows.push({ kind: 'shipping', title: 'Shipping and crating', amount_cents: inv.shipping_cents });
        if (inv.tax_cents) rows.push({ kind: 'tax', title: 'Sales tax', amount_cents: inv.tax_cents });
      }
      if (!rows.length) rows = [{ kind: 'work', title: inv.title, artist: inv.artist, amount_cents: inv.amount_cents },
        ...(inv.shipping_cents ? [{ kind: 'shipping', title: 'Shipping and crating', amount_cents: inv.shipping_cents }] : []),
        ...(inv.tax_cents ? [{ kind: 'tax', title: 'Sales tax', amount_cents: inv.tax_cents }] : [])];
      // the works, in the order they sit on the invoice, with the inventory record where we have it
      const workLines = rows.filter(l => l.kind === 'work');
      const artIds = workLines.map(l => l.artwork_id).filter(Boolean);
      const { data: arts } = artIds.length ? await db.from('artworks').select('*').in('id', artIds) : { data: [] };
      const artById = {}; (arts || []).forEach(a => artById[a.id] = a);
      const works = workLines.map(l => artById[l.artwork_id] || { artist: l.artist, title: l.title });
      const { data: sale } = inv.sale_id ? await db.from('sales').select('*').eq('id', inv.sale_id).single() : { data: null };

      const bytes = await buildPurchaseAgreement({ invoice: inv, lines: rows, collector: inv.collectors, works, sale });
      const num = String(inv.invoice_number ?? '').padStart(4, '0');
      const blob = await put(`agreements/chase-contemporary-purchase-agreement-${num}.pdf`, Buffer.from(bytes),
        { access: 'public', contentType: 'application/pdf', addRandomSuffix: true, allowOverwrite: true });
      must(await db.from('documents').insert({ kind: 'purchase_agreement', collector_id: inv.collector_id || null,
        invoice_id: inv.id, sale_id: inv.sale_id || null, pdf_url: blob.url, status: 'draft', created_by: rep }));
      must(await db.from('activities').insert({ entity_type: 'invoice', entity_id: inv.id,
        kind: 'purchase_agreement', body: blob.url, actor: rep }));
      return true;
    }

    const { data: hold } = await db.from('holds').select('*, artworks(*), collectors(*)').eq('id', id).single();
    if (!hold) throw new Error('That approval is no longer here.');
    const price = String(form.get('price') || '').replace(/[$,\s]/g, '');
    const bytes = await buildApprovalAgreement({ hold, collector: hold.collectors, artwork: hold.artworks,
      opts: price ? { price_cents: Math.round(Number(price) * 100) } : {} });
    const ref = inventoryNo(hold.artworks) || slugOf(hold.artworks?.title, 40);
    const blob = await put(`agreements/chase-contemporary-on-approval-${ref}.pdf`, Buffer.from(bytes),
      { access: 'public', contentType: 'application/pdf', addRandomSuffix: true, allowOverwrite: true });
    must(await db.from('documents').insert({ kind: 'approval', collector_id: hold.collector_id || null,
      artwork_id: hold.artwork_id || null, pdf_url: blob.url, status: 'draft', created_by: rep }));
    must(await db.from('activities').insert({ entity_type: 'artwork', entity_id: hold.artwork_id,
      kind: 'approval_agreement', body: blob.url, actor: rep }));
    if (hold.collector_id) await db.from('activities').insert({ entity_type: 'collector', entity_id: hold.collector_id,
      kind: 'approval_agreement', body: blob.url, actor: rep });
    return true;
  }

  if (action === 'coa_refresh') {
    const artworkId = form.get('artwork_id') || id;
    if (!artworkId) throw new Error('Pick the work first.');
    const { data: art } = await db.from('artworks').select('*').eq('id', artworkId).single();
    if (!art) throw new Error('That work is no longer in inventory.');
    const bytes = await buildCoa(art);
    const blob = await put(`collateral/coa-${slugOf(art.title)}.pdf`, Buffer.from(bytes),
      { access: 'public', contentType: 'application/pdf', addRandomSuffix: true, allowOverwrite: true });
    must(await db.from('artworks').update({ coa_url: blob.url }).eq('id', art.id));
    must(await db.from('documents').insert({ kind: 'coa', artwork_id: art.id,
      collector_id: form.get('collector_id') || null, pdf_url: blob.url, status: 'draft', created_by: rep }));
    must(await db.from('activities').insert({ entity_type: 'artwork', entity_id: art.id,
      kind: 'coa_generated', body: blob.url, actor: rep }));
    return true;
  }

  return false;
}
