import { db } from '../../../lib/db';

export async function POST(req) {
  const form = await req.formData();
  const token = form.get('token');
  const { data: c } = await db.from('collectors').select('id').eq('details_token', token).single();
  if (!c) return new Response('Link expired', { status: 404 });
  const g = (k) => (form.get(k) || '').trim() || null;
  const patch = {
    first_name: g('first_name'), last_name: g('last_name'),
    phone: g('phone'),
    address_line1: g('address_line1'), address_line2: g('address_line2'),
    city: g('city'), state: g('state'), zip: g('zip'), country: g('country'),
    details_completed_at: new Date().toISOString(),
  };
  const email = g('email');
  if (email) patch.email = email.toLowerCase();
  if (form.get('ship_same')) {
    patch.shipping_line1 = patch.address_line1; patch.shipping_line2 = patch.address_line2;
    patch.shipping_city = patch.city; patch.shipping_state = patch.state;
    patch.shipping_zip = patch.zip; patch.shipping_country = patch.country;
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
