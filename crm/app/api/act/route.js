import { db } from '../../../lib/db';

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
  } else if (action === 'approval_out') {
    await db.from('holds').insert({ artwork_id: id, kind: 'approval',
      out_to: form.get('out_to'), expires_at: form.get('due') || null });
    await db.from('activities').insert({ entity_type: 'artwork', entity_id: id,
      kind: 'on_approval_out', body: 'to ' + form.get('out_to'), actor: rep });
  } else if (action === 'approval_close') {
    const outcome = form.get('outcome');   // returned | converted
    await db.from('holds').update({ status: outcome }).eq('id', form.get('hold_id'));
    await db.from('activities').insert({ entity_type: 'artwork', entity_id: id,
      kind: 'on_approval_' + outcome, actor: rep });
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
  } else if (action === 'invoice_add') {
    const cents = Math.round(Number(form.get('amount') || 0) * 100);
    await db.from('invoices').insert({
      collector_id: form.get('collector_id') || null,
      title: form.get('title'), artist: form.get('artist') || null,
      amount_cents: cents,
      tax_cents: Math.round(Number(form.get('tax') || 0) * 100),
      shipping_cents: Math.round(Number(form.get('shipping') || 0) * 100),
      due_at: form.get('due') || null, notes: form.get('notes') || null });
  } else if (action === 'invoice_paid') {
    const { data: inv } = await db.from('invoices')
      .update({ status: 'paid', paid_at: new Date().toISOString(), method: form.get('method') || null })
      .eq('id', id).select().single();
    if (inv) {
      const { data: pay } = await db.from('payments')
        .insert({ amount_cents: inv.amount_cents + (inv.tax_cents || 0) + (inv.shipping_cents || 0), method: inv.method, status: 'pending' })
        .select().single();
      if (pay) await db.from('payments').update({ status: 'settled', settled_at: new Date().toISOString() }).eq('id', pay.id);
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
      } else if (inv.collector_id) {
        await db.from('purchases').insert({
          collector_id: inv.collector_id, title: inv.title, artist: inv.artist,
          amount_cents: inv.amount_cents, source: 'engine' });
        if (inv.inquiry_id) await db.from('inquiries')
          .update({ status: 'paid', stage_changed_at: new Date().toISOString() }).eq('id', inv.inquiry_id);
      }
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
