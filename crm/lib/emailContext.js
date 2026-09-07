import { db } from './db';
import { whoami } from './identity';

// Shared by preview and send: everything a template might want to mention.
export async function buildContext({ inquiryId, collectorId, invoiceId, note, extraLinks = {} }) {
  const me = await whoami();
  let inquiry = null, collector = null, artwork = null, invoice = null;
  if (inquiryId) ({ data: inquiry } = await db.from('inquiries').select('*, collectors(*)').eq('id', inquiryId).single());
  if (invoiceId) ({ data: invoice } = await db.from('invoices').select('*, collectors(*)').eq('id', invoiceId).single());
  collector = inquiry?.collectors || invoice?.collectors || null;
  if (!collector && collectorId) ({ data: collector } = await db.from('collectors').select('*').eq('id', collectorId).single());
  if (inquiry?.artwork_handle) ({ data: artwork } = await db.from('artworks').select('*').eq('handle', inquiry.artwork_handle).maybeSingle());
  if (!artwork && inquiry?.artwork_title) ({ data: artwork } = await db.from('artworks').select('*').eq('title', inquiry.artwork_title).limit(1).maybeSingle());
  if (!artwork && invoice?.sale_id) {
    const { data: it } = await db.from('sale_items').select('artwork_id').eq('sale_id', invoice.sale_id).limit(1).maybeSingle();
    if (it?.artwork_id) ({ data: artwork } = await db.from('artworks').select('*').eq('id', it.artwork_id).single());
  }
  const { data: repRow } = me.name ? await db.from('team_members').select('name, email, phone').eq('name', me.name).maybeSingle() : { data: null };
  const rep = repRow || { name: me.name };
  const links = { ...extraLinks };
  if (artwork?.tearsheet_url) links.tearsheet = artwork.tearsheet_url;
  if (invoice?.pay_url) links.pay = invoice.pay_url;
  if (invoice?.pdf_url) links.pdf = invoice.pdf_url;
  if (collector?.id) {
    const { data: off } = await db.from('offers').select('token, expires_at').eq('collector_id', collector.id).eq('status', 'active')
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (off && (!off.expires_at || new Date(off.expires_at) > new Date()))
      links.selection = (process.env.APP_URL || 'https://chase-engine.vercel.app') + '/o/' + off.token;
    if (collector.details_token && !collector.details_completed_at)
      links.details = (process.env.APP_URL || 'https://chase-engine.vercel.app') + '/d/' + collector.details_token;
  }
  return { inquiry, collector, artwork, invoice, rep, links, note };
}
