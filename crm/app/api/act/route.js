import { db } from '../../../lib/db';

export async function POST(req) {
  const form = await req.formData();
  const action = form.get('action');
  const id = form.get('id');
  const back = form.get('back') || '/today';
  if (action === 'claim') {
    await db.from('inquiries').update({ owner: form.get('owner') }).eq('id', id);
  } else if (action === 'contacted') {
    await db.from('inquiries').update({ status: 'contacted', contacted_at: new Date().toISOString() }).eq('id', id);
    await db.from('activities').insert({ entity_type: 'inquiry', entity_id: id, kind: 'contacted', actor: form.get('owner') || 'rep' });
  } else if (action === 'status') {
    await db.from('inquiries').update({ status: form.get('status'), stage_changed_at: new Date().toISOString() }).eq('id', id);
    await db.from('activities').insert({ entity_type: 'inquiry', entity_id: id, kind: 'status_change', body: form.get('status'), actor: 'rep' });
  } else if (action === 'rule_add') {
    await db.from('commission_rules').insert({ person: form.get('person'), pct: Number(form.get('pct')) });
  } else if (action === 'rule_toggle') {
    await db.from('commission_rules').update({ active: form.get('active') === '1' }).eq('id', id);
  } else if (action === 'purchase_add') {
    await db.from('purchases').insert({
      collector_id: id, title: form.get('title'), artist: form.get('artist'),
      amount_cents: Math.round(Number(form.get('amount') || 0) * 100),
      purchased_at: form.get('date') || new Date().toISOString().slice(0, 10), source: 'manual' });
    await db.from('activities').insert({ entity_type: 'collector', entity_id: id,
      kind: 'purchase_logged', body: `${form.get('title')} · $${form.get('amount')}`, actor: 'rep' });
  } else if (action === 'note') {
    await db.from('activities').insert({ entity_type: form.get('entity_type') || 'collector', entity_id: id, kind: 'note', body: form.get('body'), actor: 'rep' });
  }
  return new Response(null, { status: 302, headers: { Location: back } });
}
