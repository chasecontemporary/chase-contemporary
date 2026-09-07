import { db } from './db';

// The real write. Throws on any failure so the caller can fall back to the spill store.
// Unauthenticated callers reach this. Cap every stored string and refuse non-strings, so
// a script cannot bury the real book under oversized junk or force a spill write via a
// type error.
const cap = (v, n) => (typeof v === 'string' ? v.slice(0, n) : v == null ? null : null);

export async function persist(p, email) {
  const { data: collector, error: cErr } = await db
    .from('collectors')
    .upsert({
      email,
      first_name: cap(p.first_name, 80),
      last_name: cap(p.last_name, 80),
      phone: cap(p.phone, 40),
      city: cap(p.city, 80),
      timezone: cap(p.timezone, 60),
      locale: cap(p.locale, 20),
      source: cap(p.source, 80),
      trade: p.trade === 'yes' || p.trade === true,
      newsletter: p.subscribe === true || p.newsletter_opt_in === 'yes' || p.newsletter_opt_in === true,
      budget_range: cap(p.budget_range, 60),
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
      artwork_handle: cap(p.artwork_handle, 200),
      artwork_title: p.artwork_title || p.artwork || null,
      artist: cap(p.artist || p.artist_interest, 200),
      price_band: cap(p.price_band, 60),
      purpose: cap(p.purpose, 40) || 'acquire',
      outlet: cap(p.outlet, 80),
      budget_range: cap(p.budget_range, 60),
      timeframe: cap(p.timeframe, 80),
      message: cap(p.body || p.message, 5000),
      source: cap(p.source, 80),
      page_journey: cap(p.page_journey, 2000),
      referrer: cap(p.referrer, 500),
      utm: cap(p.utm, 500),
      seconds_on_page: parseInt(p.seconds_on_page) || null,
      device: cap(p.device, 120),
      visitor_id: /^v-[a-z0-9]{8,40}$/.test(p.visitor_id || '') ? p.visitor_id : null,
      // Deliberately unclaimed. A new inquiry belongs to the floor until someone takes it:
      // hard-coding one salesperson made every other rep's personalised views empty and
      // forced them to reassign by hand. "Answer now" on Today shows unclaimed leads to
      // everyone; once a rep is set, it becomes theirs.
      owner: null,
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

