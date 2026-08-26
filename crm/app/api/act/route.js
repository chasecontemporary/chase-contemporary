import { db } from '../../../lib/db';

export async function POST(req) {
  const form = await req.formData();
  const rep = decodeURIComponent((req.headers.get('cookie') || '').match(/cc_rep=([^;]+)/)?.[1] || 'rep');
  const action = form.get('action');
  const id = form.get('id');
  const back = form.get('back') || '/today';
  if (action === 'claim') {
    await db.from('inquiries').update({ owner: rep }).eq('id', id);
  } else if (action === 'contacted') {
    const { data: cur } = await db.from('inquiries').select('owner').eq('id', id).single();
    await db.from('inquiries').update({ status: 'contacted', contacted_at: new Date().toISOString(),
      owner: cur?.owner || rep }).eq('id', id);
    await db.from('activities').insert({ entity_type: 'inquiry', entity_id: id, kind: 'contacted', actor: rep });
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
      amount_cents: cents, due_at: form.get('due') || null, notes: form.get('notes') || null });
  } else if (action === 'invoice_paid') {
    const { data: inv } = await db.from('invoices')
      .update({ status: 'paid', paid_at: new Date().toISOString(), method: form.get('method') || null })
      .eq('id', id).select().single();
    if (inv) {
      const { data: pay } = await db.from('payments')
        .insert({ amount_cents: inv.amount_cents, method: inv.method, status: 'pending' })
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
