// Choosing what goes on the website, and Bernie saying yes to it.
// Called from the act route; returns true when it handled the action.
//
// Nothing in here talks to Shopify. Choosing a thousand works has to be one instant database
// write, and the talking is drained afterwards by /api/cron/publish. That also means an
// approval is recorded the moment Bernie presses it, even if the site is slow to catch up.
import { publishReadiness } from '../../../lib/publishing';

const MAX_QUEUE = 2000;

export async function handlePublishing({ action, form, id, rep, db, must }) {
  if (action === 'publish_queue') {
    // Queue a filtered set: everything available, optionally one artist, that passes the gate
    // and is not already somewhere in the pipeline.
    const artist = form.get('artist') || null;
    let q = db.from('artworks').select('*').eq('available', true).is('site_status', null).limit(MAX_QUEUE);
    if (artist) q = q.eq('artist', artist);
    const { data: rows } = await q;
    const ready = (rows || []).filter(a => publishReadiness(a).ok);
    if (!ready.length) throw new Error('Nothing in that set is ready for the site yet. Check the gaps in Inventory.');
    const now = new Date().toISOString();
    must(await db.from('artworks').update({ site_status: 'queued', queued_at: now, publish_error: null })
      .in('id', ready.map(a => a.id)));
    await db.from('activities').insert({ entity_type: 'artwork', entity_id: ready[0].id, kind: 'queued_for_site',
      body: `${ready.length} work${ready.length === 1 ? '' : 's'} queued${artist ? ' for ' + artist : ''}`, actor: rep });
    if (form.get('back') === 'json') return Response.json({ ok: true, queued: ready.length });
    return true;
  }

  if (action === 'publish_approve') {
    // One work, or a whole artist at once. Approving 1,400 works one at a time is not a real
    // thing to ask of a person, so the artist form is the one that gets used.
    const artist = form.get('artist') || null;
    let q = db.from('artworks').select('id').eq('site_status', 'staged');
    q = artist ? q.eq('artist', artist) : q.eq('id', id);
    const { data: rows } = await q.limit(MAX_QUEUE);
    if (!rows?.length) throw new Error('There is nothing staged there to approve.');
    must(await db.from('artworks').update({ site_status: 'approved', approved_at: new Date().toISOString(),
      approved_by: rep, review_note: null, publish_error: null }).in('id', rows.map(r => r.id)));
    if (form.get('back') === 'json') return Response.json({ ok: true, approved: rows.length });
    return true;
  }

  if (action === 'publish_hold') {
    // Sent back, with a reason, so it is not a silent no.
    const note = (form.get('note') || '').slice(0, 400) || null;
    must(await db.from('artworks').update({ site_status: 'held', review_note: note, approved_by: rep }).eq('id', id));
    await db.from('activities').insert({ entity_type: 'artwork', entity_id: id, kind: 'held_from_site',
      body: note || 'sent back', actor: rep });
    return true;
  }

  if (action === 'publish_reconsider') {
    // Out of the held pile and back into the queue.
    must(await db.from('artworks').update({ site_status: null, review_note: null, queued_at: null }).eq('id', id));
    return true;
  }

  if (action === 'publish_unpublish') {
    // Taken off the site by hand. The drain only pushes forward, so this hides the product
    // directly and is the one place that is allowed to.
    const { showProduct, hideProduct, shopifyReady } = await import('../../../lib/shopify');
    const { data: a } = await db.from('artworks').select('shopify_product_id').eq('id', id).single();
    if (shopifyReady() && a?.shopify_product_id) await hideProduct(a.shopify_product_id);
    must(await db.from('artworks').update({ site_status: 'staged' }).eq('id', id));
    await db.from('activities').insert({ entity_type: 'artwork', entity_id: id, kind: 'unpublished',
      body: 'taken off the site', actor: rep });
    return true;
  }

  return false;
}
