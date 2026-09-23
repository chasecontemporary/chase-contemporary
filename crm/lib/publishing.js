import { db } from './db';
import { listingGaps, probeImageWidth, MIN_IMAGE_PX } from './readiness';
import { pushProduct, setProductStatus, shopifyReady } from './shopify';

// Getting the inventory in front of people.
//
// The gallery has 1,440 works for sale and the public can see 187 of them. The rest go up
// through here. Two rules shape everything:
//
//   Bernie approves before anything is public. A work is pushed to Shopify as a DRAFT, which
//   means the product exists and the page does not resolve, and only an approval makes it
//   active. Nothing reaches a collector because a script decided it was ready.
//
//   Editions can be bought. Originals never can. An edition goes up with its price, so the
//   site shows ACQUIRE. An original goes up with no purchasable price, so the site shows
//   INQUIRE and a rep is always in the room.
//
// Talking to Shopify is slow, a couple of works a second, so nothing here happens inside the
// request that asks for it. Choosing works is a database write and is instant; the pushing is
// drained in batches afterwards by /api/cron/publish.

export const STATES = ['queued', 'staged', 'approved', 'live', 'held', 'sold'];

// What a work must have before it may be seen at all. Blocking stops it; a warning goes up
// anyway, because a missing medium makes a thinner page, not a broken one, and 141 works
// should not sit in a drawer over it.
export function publishReadiness(a) {
  const blocking = [];
  const warnings = [];
  const isEdition = !!a.is_edition;

  if (!a.image_url) blocking.push('no image');
  if (!a.artist) blocking.push('no artist');
  if (!a.title) blocking.push('no title');
  if (isEdition && !(a.price_cents > 0)) blocking.push('an edition needs a price');
  if (!a.available) blocking.push('not available');

  if (!a.medium) warnings.push('no medium');
  if (!(a.dims_h_in > 0 && a.dims_w_in > 0)) warnings.push('no dimensions');
  if (!isEdition && a.price_cents > 0) warnings.push('an original with a public price, it will show as buyable');

  return { blocking, warnings, ok: blocking.length === 0, kind: isEdition ? 'edition' : 'original' };
}

// The image is the product. A thumbnail blown up to a gallery wall is worse than no listing,
// so the width is checked against the same floor the tear sheets use. Unreachable counts as
// unknown and is allowed through with a warning rather than blocking the queue on a slow CDN.
export async function imageCheck(url) {
  const w = await probeImageWidth(url);
  if (w === null) return { ok: true, width: null, note: 'could not read the image size' };
  return { ok: w >= MIN_IMAGE_PX, width: w, note: w >= MIN_IMAGE_PX ? null : `only ${w}px wide, the floor is ${MIN_IMAGE_PX}` };
}

// Everything the approvals page and the inventory chips need, counted in one place so two
// screens can never disagree about how much is waiting.
export async function publishCounts() {
  const counts = {};
  for (const s of [...STATES, 'none']) {
    const q = db.from('artworks').select('id', { count: 'exact', head: true }).eq('available', true);
    const { count } = await (s === 'none' ? q.is('site_status', null) : q.eq('site_status', s));
    counts[s] = count || 0;
  }
  return counts;
}

// A work goes up as an original unless it is an edition. `pushProduct` already writes the
// draft status and the price rule, so this is only about recording the outcome and never
// pushing the same work twice.
export async function pushOne(a) {
  if (a.shopify_product_id) {
    // already on the site in some form: move it along rather than creating a duplicate
    return { productId: a.shopify_product_id, reused: true };
  }
  const { productId, handle } = await pushProduct({
    ...a,
    // an original must not be purchasable, whatever the internal price says
    price_cents: a.is_edition ? a.price_cents : 0,
  });
  return { productId, handle, reused: false };
}

/**
 * Drain the queue. Called by the cron and by the "push the next batch" button, never inside
 * a page render. Two jobs, both idempotent:
 *   queued   -> push a draft to Shopify -> staged
 *   approved -> switch the product active -> live
 * A failure is recorded on the work and the work stays where it is, so the next run retries
 * it and a person can see why on the approvals page.
 */
export async function drain({ limit = 20 } = {}) {
  if (!shopifyReady()) return { ok: false, reason: 'Shopify is not connected yet.' };
  const done = { staged: 0, live: 0, failed: 0 };

  const { data: queued } = await db.from('artworks').select('*')
    .eq('site_status', 'queued').order('queued_at').limit(limit);
  for (const a of queued || []) {
    try {
      // The photo is the product. A probe of every unpublished image found 417 of 1,231 under
      // the 1200px floor, some of them 126px thumbnails. Those must not reach a gallery wall on
      // the site, so a small image is held with the reason written on the work, where Bernie
      // sees it, rather than pushed and hoped for.
      const img = await imageCheck(a.image_url);
      if (!img.ok) {
        await db.from('artworks').update({ site_status: 'held', publish_error: null,
          review_note: `Photo is ${img.note}. Needs a better image before it goes up.` }).eq('id', a.id);
        done.failed++;
        continue;
      }
      const { productId, handle } = await pushOne(a);
      await db.from('artworks').update({
        shopify_product_id: String(productId), handle: handle || a.handle,
        site_status: 'staged', staged_at: new Date().toISOString(), publish_error: null,
      }).eq('id', a.id);
      done.staged++;
    } catch (e) {
      await db.from('artworks').update({ publish_error: String(e?.message || e).slice(0, 300) }).eq('id', a.id);
      done.failed++;
    }
  }

  const { data: approved } = await db.from('artworks').select('*')
    .eq('site_status', 'approved').order('approved_at').limit(limit);
  for (const a of approved || []) {
    try {
      if (!a.shopify_product_id) throw new Error('no product on the site to switch on');
      await setProductStatus(a.shopify_product_id, 'active');
      await db.from('artworks').update({ site_status: 'live', publish_error: null }).eq('id', a.id);
      await db.from('activities').insert({ entity_type: 'artwork', entity_id: a.id,
        kind: 'published', body: 'live on chasecontemporary.com', actor: a.approved_by || 'system' });
      done.live++;
    } catch (e) {
      await db.from('artworks').update({ publish_error: String(e?.message || e).slice(0, 300) }).eq('id', a.id);
      done.failed++;
    }
  }
  return { ok: true, ...done };
}
