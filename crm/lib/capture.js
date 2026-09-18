import { db } from './db';
import { applyRouting } from './routing';

// The real write. Throws on any failure so the caller can fall back to the spill store.
// Unauthenticated callers reach this. Cap every stored string and refuse non-strings, so
// a script cannot bury the real book under oversized junk or force a spill write via a
// type error.
// Not every message is a sales lead. Someone offering to sell us a work, or press asking
// a question, should never sit on the sales board inflating the pipeline.
export const classify = (purpose) => {
  const t = String(purpose || '').toLowerCase();
  if (/sell|consign|offer(ing)? (you|the gallery)|have a (work|piece|painting)/.test(t)) return 'selling';
  if (/press|media|journalist|interview/.test(t)) return 'press';
  if (/general/.test(t)) return 'other';
  return 'buying';
};

const cap = (v, n) => (typeof v === 'string' ? v.slice(0, n) : v == null ? null : null);

// A phone with no email is still a lead. Mint a synthetic address so the record exists and
// the drawer says "no email on file"; the composer then offers Text only.
export const emailFor = (p) => {
  const e = String(p.email || '').trim().toLowerCase();
  if (e) return e;
  const d = String(p.phone || '').replace(/\D/g, '');
  return d.length >= 7 ? `phone+${d}@import.chasecontemporary.com` : null;
};

// Which piece of inventory is this about. The site sends the product handle, and since every
// work the engine publishes carries that same handle, the lead can be tied to the actual work
// rather than to a title someone might rename. Falls back to an exact title match for anything
// that reached us another way. Never throws: an unmatched inquiry is still a lead.
async function resolveArtwork(p) {
  const handle = cap(p.artwork_handle, 200);
  const title = p.artwork_title || p.artwork || null;
  try {
    if (handle) {
      const { data } = await db.from('artworks').select('id').eq('handle', handle).limit(1).maybeSingle();
      if (data) return data.id;
    }
    if (title) {
      let q = db.from('artworks').select('id').eq('title', title);
      if (p.artist) q = q.eq('artist', p.artist);
      const { data } = await q.limit(1).maybeSingle();
      if (data) return data.id;
    }
  } catch { /* the lead matters more than the link */ }
  return null;
}

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

  // The same person sending the same form again within half an hour (a double tap, a
  // browser retry, a script hammering Submit) is one inquiry, not six. It is noted on the
  // first one and nothing new is announced.
  const handle = cap(p.artwork_handle, 200) || null;
  const msg = cap(p.body || p.message, 5000) || null;
  let dupQ = db.from('inquiries').select('id, status, owner, kind, created_at')
    .eq('collector_id', collector.id)
    .gte('created_at', new Date(Date.now() - 30 * 60000).toISOString())
    .order('created_at', { ascending: false }).limit(1);
  dupQ = handle ? dupQ.eq('artwork_handle', handle) : dupQ.is('artwork_handle', null);
  dupQ = msg ? dupQ.eq('message', msg) : dupQ.is('message', null);
  const { data: prev } = await dupQ.maybeSingle();
  if (prev) {
    await db.from('activities').insert({ entity_type: 'inquiry', entity_id: prev.id,
      kind: 'inquiry_repeated', body: 'the same form was submitted again', actor: 'system' });
    return { collector, inquiry: prev, repeated: true };
  }

  const { data: inquiry, error: iErr } = await db
    .from('inquiries')
    .insert({
      collector_id: collector.id,
      artwork_id: await resolveArtwork(p),
      artwork_handle: handle,
      artwork_title: p.artwork_title || p.artwork || null,
      artist: cap(p.artist || p.artist_interest, 200),
      price_band: cap(p.price_band, 60),
      purpose: cap(p.purpose, 40) || 'acquire',
      kind: classify(p.purpose),
      outlet: cap(p.outlet, 80),
      budget_range: cap(p.budget_range, 60),
      timeframe: cap(p.timeframe, 80),
      message: msg,
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

  // Routing rules (Team page) may hand the lead to a rep straight away; with no matching
  // rule it stays unclaimed for the floor. The announcement then goes to the right person.
  const routed = await applyRouting({ inquiry, collector });
  if (routed?.owner) inquiry.owner = routed.owner;

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

