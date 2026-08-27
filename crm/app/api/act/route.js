import { db } from '../../../lib/db';
import { buildInvoicePdf } from '../../../lib/invoicePdf';
import { put } from '@vercel/blob';
import { settleInvoice, recordPayment } from '../../../lib/settle';
import { shopifyReady, createPayLink, ensureWebhook } from '../../../lib/shopify';
import { klaviyoReady, ensureList, syncMembers, pushCampaign } from '../../../lib/klaviyo';
import { renderCampaignEmail } from '../../../lib/email';
import { listingGaps, probeImageWidth, MIN_IMAGE_PX } from '../../../lib/readiness';
import { buildTearSheet, buildCoa } from '../../../lib/collateralPdf';

export async function POST(req) {
  const form = await req.formData();
  const rep = decodeURIComponent((req.headers.get('cookie') || '').match(/cc_rep=([^;]+)/)?.[1] || 'rep');
  const action = form.get('action');
  const id = form.get('id');
  const back = form.get('back') || '/today';
  if (action === 'assign') {
    const owner = form.get('owner') || null;
    await db.from('inquiries').update({ owner }).eq('id', id);
    await db.from('activities').insert({ entity_type: 'inquiry', entity_id: id,
      kind: 'assigned', body: owner ? `to ${owner}` : 'unassigned', actor: rep });
    if (req.headers.get('accept')?.includes('application/json') || form.get('back') === 'json') {
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
  } else if (action === 'audience_sync') {
    if (!klaviyoReady())
      return Response.redirect(new URL('/audiences?err=klaviyo-not-connected', req.url), 303);
    const { data: aud } = await db.from('audiences').select('*').eq('id', id).single();
    if (aud) {
      const listId = await ensureList(aud);
      const { data: ids } = await db.rpc('audience_ids', { def: aud.definition });
      const memberIds = (ids || []).map(x => typeof x === 'string' ? x : x.audience_ids || x.id).filter(Boolean);
      let members = [];
      for (let i = 0; i < memberIds.length; i += 500) {
        const { data: chunk } = await db.from('collectors').select('email, first_name, last_name, city')
          .in('id', memberIds.slice(i, i + 500));
        members = members.concat((chunk || []).filter(m => m.email && !m.email.endsWith('import.chasecontemporary.com')));
      }
      const n = await syncMembers(listId, members);
      await db.from('audiences').update({ klaviyo_list_id: listId,
        synced_at: new Date().toISOString(), synced_count: n }).eq('id', id);
    }
  } else if (action === 'campaign_push') {
    if (!klaviyoReady())
      return Response.redirect(new URL('/campaigns?err=klaviyo-not-connected', req.url), 303);
    const { data: camp } = await db.from('campaigns').select('*, audiences(*)').eq('id', id).single();
    if (camp && camp.status === 'approved' && camp.audiences?.klaviyo_list_id) {
      const { data: works } = (camp.artwork_ids || []).length
        ? await db.from('artworks').select('*').in('id', camp.artwork_ids)
        : { data: [] };
      const ordered = (camp.artwork_ids || []).map(aid => (works || []).find(w => w.id === aid)).filter(Boolean);
      const html = renderCampaignEmail({ campaign: camp, artworks: ordered });
      const kid = await pushCampaign(camp, html, camp.audiences.klaviyo_list_id);
      await db.from('campaigns').update({ klaviyo_campaign_id: kid, pushed_at: new Date().toISOString() }).eq('id', id);
    }
  } else if (action === 'audience_add') {
    await db.from('audiences').insert({ name: form.get('name'), created_by: rep,
      definition: { seg: form.get('seg') || 'all', artist: form.get('artist') || null,
        min_spend: form.get('min_spend') || null, consented: form.get('consented') === 'true' } });
  } else if (action === 'audience_del') {
    await db.from('audiences').delete().eq('id', id);
  } else if (action === 'campaign_add') {
    await db.from('campaigns').insert({ name: form.get('name'), kind: form.get('kind') || 'drop',
      subject: form.get('subject'), preheader: form.get('preheader') || null,
      body: form.get('body') || null, audience_id: form.get('audience_id') || null,
      artwork_ids: form.getAll('artwork_ids'), created_by: rep });
  } else if (action === 'campaign_approve') {
    await db.from('campaigns').update({ status: 'approved', approved_by: rep }).eq('id', id);
  } else if (action === 'campaign_del') {
    await db.from('campaigns').delete().eq('id', id);
  } else if (action === 'artwork_collateral') {
    const kind = form.get('kind');   // tearsheet | coa
    const { data: art } = await db.from('artworks').select('*').eq('id', id).single();
    if (art) {
      const bytes = kind === 'coa' ? await buildCoa(art) : await buildTearSheet(art);
      const slug = (art.title || 'work').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);
      const blob = await put(`collateral/${kind}-${slug}.pdf`, Buffer.from(bytes),
        { access: 'public', contentType: 'application/pdf', addRandomSuffix: true, allowOverwrite: true });
      await db.from('artworks').update(kind === 'coa' ? { coa_url: blob.url } : { tearsheet_url: blob.url }).eq('id', id);
      await db.from('activities').insert({ entity_type: 'artwork', entity_id: id,
        kind: kind + '_generated', body: blob.url, actor: rep });
    }
  } else if (action === 'artwork_update') {
    const patch = {};
    for (const f of ['title','artist','medium']) if (form.has(f)) patch[f] = form.get(f) || null;
    if (form.has('h')) patch.dims_h_in = Number(form.get('h')) || null;
    if (form.has('w')) patch.dims_w_in = Number(form.get('w')) || null;
    await db.from('artworks').update(patch).eq('id', id);
  } else if (action === 'artwork_push') {
    if (!shopifyReady())
      return Response.redirect(new URL((form.get('back') || '/inventory') + '?err=shopify-not-connected', req.url), 303);
    const { data: art } = await db.from('artworks').select('*').eq('id', id).single();
    if (art && !art.shopify_product_id) {
      const gaps = listingGaps(art);
      if (!gaps.length) {
        const w = await probeImageWidth(art.image_url);
        if (w !== null && w < MIN_IMAGE_PX) gaps.push(`image too small (${w}px, needs ${MIN_IMAGE_PX})`);
      }
      if (gaps.length)
        return Response.redirect(new URL((form.get('back') || '/inventory') + '?pusherr=' + encodeURIComponent(gaps.join(', ')), req.url), 303);
      const { pushProduct } = await import('../../../lib/shopify');
      const { productId, handle } = await pushProduct(art);
      await db.from('artworks').update({ shopify_product_id: productId, handle }).eq('id', id);
      await db.from('activities').insert({ entity_type: 'artwork', entity_id: id,
        kind: 'pushed_to_site', body: 'draft product ' + handle, actor: rep });
    }
  } else if (action === 'artwork_value') {
    const cents = Math.round(Number(String(form.get('value') || '0').replace(/[$,\s]/g, '')) * 100);
    await db.from('artworks').update({ internal_value_cents: cents || null }).eq('id', id);
    await db.from('activities').insert({ entity_type: 'artwork', entity_id: id,
      kind: 'internal_value_set', body: cents ? '$' + (cents / 100).toLocaleString() : 'cleared', actor: rep });
  } else if (action === 'approval_out') {
    const collectorId = form.get('collector_id') || null;
    let outTo = form.get('out_to') || null;
    if (collectorId && !outTo) {
      const { data: col } = await db.from('collectors').select('first_name, last_name, email').eq('id', collectorId).single();
      outTo = col ? ([col.first_name, col.last_name].filter(Boolean).join(' ') || col.email) : null;
    }
    const due = form.get('due') || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    await db.from('holds').insert({ artwork_id: id, kind: 'approval',
      collector_id: collectorId, out_to: outTo, expires_at: due });
    await db.from('activities').insert({ entity_type: 'artwork', entity_id: id,
      kind: 'on_approval_out', body: `to ${outTo} · due back ${due}`, actor: rep });
    if (collectorId) await db.from('activities').insert({ entity_type: 'collector', entity_id: collectorId,
      kind: 'on_approval_out', body: `took a work on approval · due back ${due}`, actor: rep });
    if (form.get('inquiry_id')) await db.from('inquiries')
      .update({ status: 'hold', stage_changed_at: new Date().toISOString() }).eq('id', form.get('inquiry_id'));
    if (form.get('back') === 'json')
      return new Response(JSON.stringify({ ok: true, out_to: outTo, due }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } else if (action === 'approval_close') {
    const outcome = form.get('outcome');   // returned | converted
    await db.from('holds').update({ status: outcome }).eq('id', form.get('hold_id'));
    await db.from('activities').insert({ entity_type: 'artwork', entity_id: id,
      kind: 'on_approval_' + outcome, actor: rep });
  } else if (action === 'details_link') {
    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 8);
    await db.from('collectors').update({ details_token: token,
      details_requested_at: new Date().toISOString(), details_completed_at: null }).eq('id', id);
    await db.from('activities').insert({ entity_type: 'collector', entity_id: id,
      kind: 'details_link_sent', actor: rep });
    const url = new URL(req.url).origin + '/d/' + token;
    if (form.get('back') === 'json')
      return new Response(JSON.stringify({ ok: true, url }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    return Response.redirect(new URL((form.get('back') || '/collectors/' + id) + '?dlink=' + encodeURIComponent(url), req.url), 303);
  } else if (action === 'offer_create') {
    const items = JSON.parse(form.get('items') || '[]')
      .filter(x => x.id).slice(0, 10)
      .map(x => ({ id: x.id, price_cents: Number(x.price_cents) > 0 ? Math.round(Number(x.price_cents)) : null }));
    if (!items.length) return new Response(JSON.stringify({ error: 'no works' }), { status: 400 });
    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 8);
    const days = Math.min(90, Math.max(1, Number(form.get('expires_days')) || 14));
    const { data: offer, error: oErr } = await db.from('offers').insert({
      token, collector_id: id, inquiry_id: form.get('inquiry_id') || null,
      title: form.get('title') || null, note: form.get('note') || null,
      items, created_by: rep === 'rep' ? null : rep,
      expires_at: new Date(Date.now() + days * 86400000).toISOString(),
    }).select().single();
    if (oErr) return new Response(JSON.stringify({ error: oErr.message }), { status: 500 });
    await db.from('activities').insert({ entity_type: 'collector', entity_id: id,
      kind: 'offer_sent', body: `${offer.title || 'Private selection'} · ${items.length} work${items.length > 1 ? 's' : ''}`, actor: rep });
    const url = new URL(req.url).origin + '/o/' + token;
    return new Response(JSON.stringify({ ok: true, url }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } else if (action === 'offer_revoke') {
    await db.from('offers').update({ status: 'revoked' }).eq('id', id);
  } else if (action === 'collector_update') {
    const fields = ['salutation','first_name','last_name','company','phone','email',
      'address_line1','address_line2','city','state','zip','country',
      'shipping_line1','shipping_line2','shipping_city','shipping_state','shipping_zip','shipping_country'];
    const patch = {};
    fields.forEach(f => { if (form.has(f)) patch[f] = form.get(f) || null; });
    if (patch.email) patch.email = patch.email.trim().toLowerCase();
    await db.from('collectors').update(patch).eq('id', id);
    await db.from('activities').insert({ entity_type: 'collector', entity_id: id,
      kind: 'details_updated', actor: rep });
  } else if (action === 'interest_add') {
    const label = (form.get('label') || '').trim();
    if (label) await db.from('collector_interests').upsert(
      { collector_id: form.get('id'), label, kind: form.get('kind') || 'custom', added_by: rep },
      { onConflict: 'collector_id,label' });
  } else if (action === 'interest_del') {
    await db.from('collector_interests').delete().eq('id', form.get('iid'));
  } else if (action === 'collector_add') {
    const email = (form.get('email') || '').trim().toLowerCase() ||
      ('manual+' + Date.now() + '@import.chasecontemporary.com');
    await db.from('collectors').upsert({ email,
      first_name: form.get('first_name'), last_name: form.get('last_name'),
      phone: form.get('phone') || null, city: form.get('city') || null,
      source: form.get('source') || 'Manual', notes: form.get('notes') || null },
      { onConflict: 'email' });
  } else if (action === 'team_add') {
    await db.from('team_members').insert({ name: form.get('name'), email: form.get('email') || null,
      role: form.get('role') || 'rep' });
  } else if (action === 'team_toggle') {
    await db.from('team_members').update({ active: form.get('active') === '1' }).eq('id', id);
  } else if (action === 'claim') {
    await db.from('inquiries').update({ owner: rep }).eq('id', id);
  } else if (action === 'contacted') {
    const { data: cur } = await db.from('inquiries').select('owner').eq('id', id).single();
    await db.from('inquiries').update({ status: 'contacted', contacted_at: new Date().toISOString(),
      owner: cur?.owner || rep }).eq('id', id);
    await db.from('activities').insert({ entity_type: 'inquiry', entity_id: id, kind: 'contacted', actor: rep });
  } else if (action === 'called') {
    const { data: cur } = await db.from('inquiries').select('first_called_at, status, owner, contacted_at').eq('id', id).single();
    const patch = { first_called_at: cur?.first_called_at || new Date().toISOString(), owner: cur?.owner || rep };
    if (!cur?.contacted_at) patch.contacted_at = new Date().toISOString();
    if (cur?.status === 'new') { patch.status = 'contacted'; patch.stage_changed_at = new Date().toISOString(); }
    await db.from('inquiries').update(patch).eq('id', id);
    await db.from('activities').insert({ entity_type: 'inquiry', entity_id: id, kind: 'call', actor: rep });
    if (form.get('back') !== 'json' && !req.headers.get('accept')?.includes('application/json')) {
      return new Response(null, { status: 302, headers: { Location: form.get('back') || '/today' } });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } else if (action === 'status') {
    await db.from('inquiries').update({ status: form.get('status'), stage_changed_at: new Date().toISOString() }).eq('id', id);
    await db.from('activities').insert({ entity_type: 'inquiry', entity_id: id, kind: 'status_change', body: form.get('status'), actor: rep });
  } else if (action === 'commissions_recompute') {
    // apply current rates to everything not yet paid out — for when the real percentages land
    const { data: rls } = await db.from('commission_rules').select('*').eq('active', true);
    for (const r of (rls || [])) {
      const { data: rowsToFix } = await db.from('commissions').select('id, payment_id')
        .eq('person', r.person).is('paid_at', null);
      for (const row of (rowsToFix || [])) {
        const { data: pay } = await db.from('payments').select('amount_cents').eq('id', row.payment_id).single();
        if (pay) await db.from('commissions').update({ pct: r.pct,
          amount_cents: Math.round(pay.amount_cents * Number(r.pct) / 100) }).eq('id', row.id);
      }
    }
    await db.from('activities').insert({ entity_type: 'commission',
      entity_id: '00000000-0000-0000-0000-000000000000',
      kind: 'commissions_recomputed', body: 'unpaid rows re-rated', actor: rep });
  } else if (action === 'payout_complete') {
    await db.from('commissions').update({ paid_at: new Date().toISOString() })
      .eq('person', form.get('person')).eq('period', form.get('period')).is('paid_at', null);
    await db.from('activities').insert({ entity_type: 'commission', entity_id: id || '00000000-0000-0000-0000-000000000000',
      kind: 'payout_complete', body: `${form.get('person')} · ${form.get('period')}`, actor: rep });
  } else if (action === 'rule_add') {
    await db.from('commission_rules').insert({ person: form.get('person'), pct: Number(form.get('pct')) });
  } else if (action === 'rule_toggle') {
    await db.from('commission_rules').update({ active: form.get('active') === '1' }).eq('id', id);
  } else if (action === 'sale_add_item') {
    const { data: lead } = await db.from('inquiries').select('*').eq('id', id).single();
    if (lead) {
      let { data: sale } = await db.from('sales').select('*')
        .eq('collector_id', lead.collector_id).eq('status', 'open').maybeSingle();
      if (!sale) {
        ({ data: sale } = await db.from('sales')
          .insert({ collector_id: lead.collector_id, owner: lead.owner || rep }).select().single());
      }
      const { data: art } = lead.artwork_handle
        ? await db.from('artworks').select('id').eq('handle', lead.artwork_handle).maybeSingle()
        : { data: null };
      await db.from('sale_items').insert({
        sale_id: sale.id, inquiry_id: lead.id, artwork_id: art?.id || null,
        title: lead.artwork_title || lead.purpose, artist: lead.artist,
        agreed_cents: Math.round(Number(form.get('amount') || 0) * 100) });
      await db.from('inquiries').update({ status: 'in_conversation', stage_changed_at: new Date().toISOString() }).eq('id', id);
      await db.from('activities').insert({ entity_type: 'inquiry', entity_id: id,
        kind: 'added_to_sale', body: lead.artwork_title, actor: rep });
      return new Response(JSON.stringify({ ok: true, sale_id: sale.id }),
        { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
  } else if (action === 'invoice_from_sale') {
    // one invoice per sale — the thesis. An existing open invoice is returned, never duplicated.
    const { data: existing } = await db.from('invoices').select('id, invoice_number')
      .eq('sale_id', id).neq('status', 'void').limit(1);
    if (existing?.length) {
      if (form.get('back') && form.get('back') !== 'json')
        return Response.redirect(new URL(form.get('back'), req.url), 303);
      return new Response(JSON.stringify({ ok: true, invoice_number: existing[0].invoice_number, existing: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    const { data: items } = await db.from('sale_items').select('*').eq('sale_id', id);
    const { data: sale } = await db.from('sales').select('*').eq('id', id).single();
    if (sale && items?.length) {
      const total = items.reduce((s, i) => s + i.agreed_cents, 0);
      const title = items.length === 1 ? items[0].title : `${items.length} works · ${items.map(i => i.title).join(', ').slice(0, 120)}`;
      const { data: inv } = await db.from('invoices').insert({
        collector_id: sale.collector_id, sale_id: sale.id,
        title, artist: items.length === 1 ? items[0].artist : null,
        amount_cents: total, notes: 'generated from sale' }).select().single();
      await db.from('sales').update({ status: 'invoiced' }).eq('id', id);
      const inqIds = items.map(i => i.inquiry_id).filter(Boolean);
      if (inqIds.length) await db.from('inquiries')
        .update({ status: 'invoice', stage_changed_at: new Date().toISOString() }).in('id', inqIds);
      if (form.get('back') && form.get('back') !== 'json')
        return Response.redirect(new URL(form.get('back'), req.url), 303);
      return new Response(JSON.stringify({ ok: true, invoice_number: inv?.invoice_number }),
        { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
  } else if (action === 'invoice_from_lead') {
    const { data: lead } = await db.from('inquiries')
      .select('*, collectors(id)').eq('id', id).single();
    if (lead) {
      const cents = Math.round(Number(form.get('amount') || 0) * 100);
      const { data: inv } = await db.from('invoices').insert({
        collector_id: lead.collector_id, inquiry_id: lead.id,
        title: lead.artwork_title || lead.purpose, artist: lead.artist,
        amount_cents: cents, notes: 'generated from lead' }).select().single();
      await db.from('inquiries').update({ status: 'invoice', stage_changed_at: new Date().toISOString() }).eq('id', id);
      await db.from('activities').insert({ entity_type: 'inquiry', entity_id: id,
        kind: 'invoice_generated', body: `#${String(inv?.invoice_number).padStart(4,'0')} · $${(cents/100).toLocaleString()}`, actor: rep });
      return new Response(JSON.stringify({ ok: true, invoice_number: inv?.invoice_number }),
        { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
  } else if (action === 'invoice_manual') {
    // line-item invoice: works create a sale underneath (thesis), shipping/tax/service are lines
    const collectorId = form.get('collector_id') || null;
    let lines = [];
    try { lines = JSON.parse(form.get('lines') || '[]'); } catch {}
    const cents = (x) => Math.round(Number(String(x || '0').replace(/[$,\s]/g, '')) * 100);
    lines = lines.filter(l => cents(l.amount) > 0 || (l.kind === 'work' && l.artwork_id));
    const workLines = lines.filter(l => l.kind === 'work' && l.artwork_id);
    const svcLines = lines.filter(l => l.kind === 'service');
    const shipC = lines.filter(l => l.kind === 'shipping').reduce((s, l) => s + cents(l.amount), 0);
    const taxC = lines.filter(l => l.kind === 'tax').reduce((s, l) => s + cents(l.amount), 0);
    const artC = workLines.reduce((s, l) => s + cents(l.amount), 0) + svcLines.reduce((s, l) => s + cents(l.amount), 0);
    if (artC + shipC + taxC > 0 || workLines.length) {
      let saleId = null;
      if (collectorId && workLines.length) {
        const { data: sale } = await db.from('sales').insert({ collector_id: collectorId, owner: rep }).select().single();
        saleId = sale?.id;
        for (const l of workLines)
          await db.from('sale_items').insert({ sale_id: saleId, artwork_id: l.artwork_id,
            title: l.title, artist: l.artist, agreed_cents: cents(l.amount) });
        if (saleId) await db.from('sales').update({ status: 'invoiced' }).eq('id', saleId);
      }
      const first = workLines[0] || svcLines[0] || {};
      const title = workLines.length > 1 ? `${workLines.length} works · ` + workLines.map(l => l.title).join(', ').slice(0, 110)
        : (first.title || 'Sale');
      const { data: inv } = await db.from('invoices').insert({ collector_id: collectorId, sale_id: saleId,
        title, artist: workLines.length === 1 ? first.artist : null,
        amount_cents: artC, tax_cents: taxC, shipping_cents: shipC,
        due_at: form.get('due') || null, notes: 'manual invoice' }).select().single();
      if (inv) {
        let sort = 0;
        for (const l of lines)
          await db.from('invoice_lines').insert({ invoice_id: inv.id, kind: l.kind,
            artwork_id: l.artwork_id || null, title: l.title || null, artist: l.artist || null,
            amount_cents: cents(l.amount), sort: sort++ });
        if (form.get('inquiry_id')) {
          await db.from('inquiries').update({ status: 'invoice', stage_changed_at: new Date().toISOString() })
            .eq('id', form.get('inquiry_id'));
          await db.from('activities').insert({ entity_type: 'inquiry', entity_id: form.get('inquiry_id'),
            kind: 'invoice_generated', body: `#${String(inv.invoice_number).padStart(4,'0')}`, actor: rep });
        }
      }
    }
  } else if (action === 'invoice_add') {
    const cents = Math.round(Number(form.get('amount') || 0) * 100);
    await db.from('invoices').insert({
      collector_id: form.get('collector_id') || null,
      title: form.get('title'), artist: form.get('artist') || null,
      amount_cents: cents,
      tax_cents: Math.round(Number(form.get('tax') || 0) * 100),
      shipping_cents: Math.round(Number(form.get('shipping') || 0) * 100),
      due_at: form.get('due') || null, notes: form.get('notes') || null });
  } else if (action === 'invoice_pdf') {
    const { data: inv } = await db.from('invoices').select('*, collectors(*)').eq('id', id).single();
    if (inv) {
      let items = [];
      const { data: ilines } = await db.from('invoice_lines').select('*, artworks(medium, dims_h_in, dims_w_in)')
        .eq('invoice_id', id).in('kind', ['work', 'service']).order('sort');
      if (ilines?.length) {
        items = ilines.map(it => ({ artist: it.artist, title: it.title, amount_cents: it.amount_cents,
          medium: it.artworks?.medium,
          dims: it.artworks?.dims_h_in ? `${it.artworks.dims_h_in} × ${it.artworks.dims_w_in} in` : null }));
      } else if (inv.sale_id) {
        const { data: si } = await db.from('sale_items')
          .select('*, artworks(medium, dims_h_in, dims_w_in)').eq('sale_id', inv.sale_id);
        items = (si || []).map(it => ({ artist: it.artist, title: it.title, amount_cents: it.agreed_cents,
          medium: it.artworks?.medium,
          dims: it.artworks?.dims_h_in ? `${it.artworks.dims_h_in} × ${it.artworks.dims_w_in} in` : null }));
      }
      if (!items.length) items = [{ artist: inv.artist, title: inv.title, amount_cents: inv.amount_cents }];
      const { data: pays } = await db.from('payments').select('amount_cents, method, settled_at')
        .eq('invoice_id', id).eq('status', 'settled').order('settled_at');
      const bytes = await buildInvoicePdf({ invoice: inv, collector: inv.collectors, items, payments: pays || [] });
      const num = String(inv.invoice_number).padStart(4, '0');
      const blob = await put(`invoices/chase-contemporary-invoice-${num}.pdf`, Buffer.from(bytes),
        { access: 'public', contentType: 'application/pdf', addRandomSuffix: true, allowOverwrite: true });
      await db.from('invoices').update({ pdf_url: blob.url }).eq('id', id);
      await db.from('activities').insert({ entity_type: 'invoice', entity_id: id,
        kind: 'invoice_pdf', body: blob.url, actor: rep });
    }
  } else if (action === 'invoice_ar') {
    const st = form.get('ar_status');
    const patch = { ar_status: st };
    if (st.startsWith('fu')) patch.last_nudge_at = new Date().toISOString();
    await db.from('invoices').update(patch).eq('id', id);
    await db.from('activities').insert({ entity_type: 'invoice', entity_id: id,
      kind: 'ar_' + st, body: form.get('promise_date') || null, actor: rep });
  } else if (action === 'invoice_payment') {
    let amt = Math.round(Number(String(form.get('amount') || '0').replace(/[$,\s]/g, '')) * 100);
    if (!amt && form.get('fraction')) {
      const { data: fi } = await db.from('invoices').select('amount_cents, tax_cents, shipping_cents').eq('id', id).single();
      if (fi) amt = Math.round((fi.amount_cents + (fi.tax_cents || 0) + (fi.shipping_cents || 0)) * Number(form.get('fraction')));
    }
    if (amt > 0) {
      const r = await recordPayment(id, amt, form.get('method') || null);
      if (r) await db.from('activities').insert({ entity_type: 'invoice', entity_id: id,
        kind: r.closed ? 'paid' : 'payment_received',
        body: '$' + (amt / 100).toLocaleString() + (r.closed ? ' · settled in full' : ' · balance $' + ((r.total - r.received) / 100).toLocaleString()),
        actor: rep });
    }
  } else if (action === 'invoice_paid') {
    const inv = await settleInvoice(id, form.get('method') || null);
    if (inv) await db.from('activities').insert({ entity_type: 'invoice', entity_id: id,
      kind: 'paid', body: form.get('method') || null, actor: rep });
  } else if (action === 'invoice_paylink') {
    if (!shopifyReady())
      return Response.redirect(new URL('/finance?err=shopify-not-connected', req.url), 303);
    const { data: inv } = await db.from('invoices')
      .select('*, collectors(email)').eq('id', id).single();
    if (inv && inv.status === 'open') {
      await ensureWebhook(new URL(req.url).origin);
      const { url, draftId } = await createPayLink(inv, inv.collectors);
      await db.from('invoices').update({ pay_url: url, shopify_draft_id: draftId }).eq('id', id);
      await db.from('activities').insert({ entity_type: 'invoice', entity_id: id,
        kind: 'paylink_created', body: url, actor: rep });
    }
  } else if (action === 'invoice_void') {
    await db.from('invoices').update({ status: 'void' }).eq('id', id);
  } else if (action === 'purchase_add') {
    await db.from('purchases').insert({
      collector_id: id, title: form.get('title'), artist: form.get('artist'),
      amount_cents: Math.round(Number(form.get('amount') || 0) * 100),
      purchased_at: form.get('date') || new Date().toISOString().slice(0, 10), source: 'manual' });
    await db.from('activities').insert({ entity_type: 'collector', entity_id: id,
      kind: 'purchase_logged', body: `${form.get('title')} · $${form.get('amount')}`, actor: rep });
  } else if (action === 'note') {
    await db.from('activities').insert({ entity_type: form.get('entity_type') || 'collector', entity_id: id, kind: 'note', body: form.get('body'), actor: rep });
  }
  return new Response(null, { status: 302, headers: { Location: back } });
}
