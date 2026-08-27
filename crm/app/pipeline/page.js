import Shell from '../../components/Shell';
import Kanban from '../../components/Kanban';
import { db } from '../../lib/db';
export const dynamic = 'force-dynamic';

export default async function Pipeline() {
  const { data: rows } = await db.from('inquiries')
    .select('*, collectors(id, first_name, last_name, email, phone, city, timezone, budget_range, trade, source, address_line1, state)')
    .neq('status', 'closed').order('created_at', { ascending: false }).limit(300);
  const handles = [...new Set((rows || []).map(r => r.artwork_handle).filter(Boolean))];
  let artMap = {};
  if (handles.length) {
    const { data: arts } = await db.from('artworks')
      .select('id, handle, title, artist, price_cents, internal_value_cents, image_url, medium, dims_h_in, dims_w_in, available')
      .in('handle', handles);
    (arts || []).forEach(a => { artMap[a.handle] = a; });
  }
  const collectorIds = [...new Set((rows || []).map(r => r.collector_id).filter(Boolean))];
  let saleMap = {};
  if (collectorIds.length) {
    const { data: sales } = await db.from('sales')
      .select('*, sale_items(*)').eq('status', 'open').in('collector_id', collectorIds);
    (sales || []).forEach(s => { saleMap[s.collector_id] = s; });
  }
  let ltvMap = {}, invoiceMap = {}, journeyMap = {};
  if (collectorIds.length) {
    const { data: idx } = await db.from('collector_index')
      .select('id, spend_cents, works, tags').in('id', collectorIds);
    (idx || []).forEach(x => ltvMap[x.id] = x);
    const { data: jn } = await db.from('collector_journey')
      .select('*').in('collector_id', collectorIds);
    (jn || []).forEach(j => journeyMap[j.collector_id] = j);
    const { data: openInv } = await db.from('invoices')
      .select('id, invoice_number, amount_cents, tax_cents, shipping_cents, collector_id')
      .eq('status', 'open').in('collector_id', collectorIds);
    (openInv || []).forEach(i => invoiceMap[i.collector_id] = i);
  }
  const counts = {};
  (rows || []).forEach(r => { counts[r.collector_id] = (counts[r.collector_id] || 0) + 1; });
  // competition: other active leads on the same work; and whether the work is committed (hold/invoice/paid)
  const byWork = {};
  (rows || []).forEach(r => {
    const k = r.artwork_handle || r.artwork_title;
    if (!k) return;
    (byWork[k] = byWork[k] || []).push(r);
  });
  const competition = {};
  Object.entries(byWork).forEach(([k, ls]) => {
    ls.forEach(r => {
      const others = ls.filter(o => o.id !== r.id && o.collector_id !== r.collector_id);
      const committed = ls.find(o => o.collector_id !== r.collector_id && ['hold','invoice','paid'].includes(o.status));
      competition[r.id] = { others: others.length,
        committed: committed ? { name: (committed.collectors?.first_name || '') + ' ' + (committed.collectors?.last_name || ''),
          stage: committed.status } : null };
    });
  });
  const missingTitles = [...new Set((rows || [])
    .filter(r => !artMap[r.artwork_handle] && r.artwork_title)
    .map(r => r.artwork_title))];
  let titleMap = {};
  if (missingTitles.length) {
    const { data: byTitle } = await db.from('artworks')
      .select('id, handle, title, artist, price_cents, internal_value_cents, image_url, medium, dims_h_in, dims_w_in, available')
      .in('title', missingTitles);
    (byTitle || []).forEach(a => { titleMap[a.title] = a; });
  }
  const leads = (rows || []).map(r => ({ ...r,
    artwork: artMap[r.artwork_handle] || titleMap[r.artwork_title] || null,
    openSale: saleMap[r.collector_id] || null, inquiryCount: counts[r.collector_id] || 1,
    ltv: Number(ltvMap[r.collector_id]?.spend_cents || 0), worksOwned: Number(ltvMap[r.collector_id]?.works || 0),
    vip: (ltvMap[r.collector_id]?.tags || []).includes('VIP list'),
    openInvoice: invoiceMap[r.collector_id] || null,
    journey: journeyMap[r.collector_id] || null,
    competition: competition[r.id] || { others: 0, committed: null } }));
  const { data: team } = await db.from('team_members').select('name').eq('active', true).order('name');
  return <Shell active="pipeline">
    <div className="h1">Pipeline</div>
    <div className="sub">{leads.length} open · drag between stages · click a lead for the full picture</div>
    <Kanban initial={leads} team={(team || []).map(t => t.name)} />
  </Shell>;
}
