import { db } from '../../../lib/db';

export async function POST(req) {
  const form = await req.formData();
  const token = form.get('token');
  const { data: c } = await db.from('collectors').select('id').eq('details_token', token).single();
  if (!c) return new Response('Link expired', { status: 404 });
  const g = (k) => (form.get(k) || '').trim() || null;
  if (form.get('mode') === 'confirm') {
    const { data: cur } = await db.from('collectors').select('address_line1, address_line2, city, state, zip, country, shipping_line1').eq('id', c.id).single();
    const stamp = { details_completed_at: new Date().toISOString() };
    if (cur && !cur.shipping_line1) Object.assign(stamp, { shipping_line1: cur.address_line1,
      shipping_line2: cur.address_line2, shipping_city: cur.city, shipping_state: cur.state,
      shipping_zip: cur.zip, shipping_country: cur.country });
    await db.from('collectors').update(stamp).eq('id', c.id);
    await db.from('activities').insert({ entity_type: 'collector', entity_id: c.id,
      kind: 'details_confirmed', body: 'collector confirmed details on file', actor: 'collector' });
    return Response.redirect(new URL('/d/' + token, req.url), 303);
  }
  const patch = { details_completed_at: new Date().toISOString() };
  for (const k of ['first_name','last_name','phone','address_line1','address_line2','city','state','zip','country']) {
    const v = g(k); if (v) patch[k] = v;
  }
  const email = g('email');
  if (email) patch.email = email.toLowerCase();
  if (form.get('ship_same')) {
    const { data: cur } = await db.from('collectors').select('address_line1, address_line2, city, state, zip, country').eq('id', c.id).single();
    const b = { ...cur, ...patch };
    patch.shipping_line1 = b.address_line1; patch.shipping_line2 = b.address_line2;
    patch.shipping_city = b.city; patch.shipping_state = b.state;
    patch.shipping_zip = b.zip; patch.shipping_country = b.country;
  } else {
    patch.shipping_line1 = g('shipping_line1'); patch.shipping_line2 = g('shipping_line2');
    patch.shipping_city = g('shipping_city'); patch.shipping_state = g('shipping_state');
    patch.shipping_zip = g('shipping_zip'); patch.shipping_country = g('shipping_country');
  }
  const { error } = await db.from('collectors').update(patch).eq('id', c.id);
  if (error && email) {
    // email collides with an existing record: keep their current email, save the rest
    delete patch.email;
    await db.from('collectors').update(patch).eq('id', c.id);
  }
  await db.from('activities').insert({ entity_type: 'collector', entity_id: c.id,
    kind: 'details_completed', body: 'collector completed the details link', actor: 'collector' });
  return Response.redirect(new URL('/d/' + token, req.url), 303);
}
