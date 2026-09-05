import { db } from './db';

// The real write. Throws on any failure so the caller can fall back to the spill store.
export async function persist(p, email) {
  const { data: collector, error: cErr } = await db
    .from('collectors')
    .upsert({
      email,
      first_name: p.first_name || null,
      last_name: p.last_name || null,
      phone: p.phone || null,
      city: p.city || null,
      timezone: p.timezone || null,
      locale: p.locale || null,
      source: p.source || null,
      trade: p.trade === 'yes' || p.trade === true,
      newsletter: p.subscribe === true || p.newsletter_opt_in === 'yes' || p.newsletter_opt_in === true,
      budget_range: p.budget_range || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'email' })
    .select()
    .single();
  if (cErr || !collector) throw new Error(cErr?.message || 'collector upsert failed');

  // A newsletter signup is a person, not a lead: it belongs in the book and in the
  // audiences, but it must never clutter the sales pipeline with a fake inquiry.
  if (p.subscribe) {
    await db.from('activities').insert({ entity_type: 'collector', entity_id: collector.id,
      kind: 'newsletter_signup', body: p.source || 'Website' });
    return { collector, inquiry: null, subscribed: true };
  }

  const { data: inquiry, error: iErr } = await db
    .from('inquiries')
    .insert({
      collector_id: collector.id,
      artwork_handle: p.artwork_handle || null,
      artwork_title: p.artwork_title || p.artwork || null,
      artist: p.artist || p.artist_interest || null,
      price_band: p.price_band || null,
      purpose: p.purpose || 'acquire',
      outlet: p.outlet || null,
      budget_range: p.budget_range || null,
      timeframe: p.timeframe || null,
      message: p.body || p.message || null,
      source: p.source || null,
      page_journey: p.page_journey || null,
      referrer: p.referrer || null,
      utm: p.utm || null,
      seconds_on_page: parseInt(p.seconds_on_page) || null,
      device: p.device || null,
      visitor_id: /^v-[a-z0-9]{8,40}$/.test(p.visitor_id || '') ? p.visitor_id : null,
      owner: 'Sara',
    })
    .select()
    .single();
  if (iErr || !inquiry) throw new Error(iErr?.message || 'inquiry insert failed');

  // identity moment: stitch this browser's anonymous trail to the collector —
  // past AND future page views from this visitor land on their record
  if (inquiry.visitor_id) {
    await db.from('visitor_links').upsert({
      visitor_id: inquiry.visitor_id, collector_id: collector.id, linked_via: 'inquiry',
    }, { onConflict: 'visitor_id' });
    await db.from('site_events').update({ collector_id: collector.id })
      .eq('visitor_id', inquiry.visitor_id).is('collector_id', null);
  }

  await db.from('activities').insert({
    entity_type: 'inquiry', entity_id: inquiry.id,
    kind: 'inquiry_received',
    body: `${p.first_name || ''} ${p.last_name || ''} · ${inquiry.artwork_title || inquiry.purpose}`,
  });

  return { collector, inquiry };
}

