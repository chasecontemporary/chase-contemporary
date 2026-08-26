import Shell from '../../components/Shell';
import Kanban from '../../components/Kanban';
import { db } from '../../lib/db';
export const dynamic = 'force-dynamic';

export default async function Pipeline() {
  const { data: rows } = await db.from('inquiries')
    .select('*, collectors(id, first_name, last_name, email, phone, city, timezone, budget_range, trade, source)')
    .neq('status', 'closed').order('created_at', { ascending: false }).limit(300);
  const handles = [...new Set((rows || []).map(r => r.artwork_handle).filter(Boolean))];
  let artMap = {};
  if (handles.length) {
    const { data: arts } = await db.from('artworks')
      .select('id, handle, title, artist, price_cents, image_url, medium, dims_h_in, dims_w_in, available')
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
  const counts = {};
  (rows || []).forEach(r => { counts[r.collector_id] = (counts[r.collector_id] || 0) + 1; });
  const leads = (rows || []).map(r => ({ ...r, artwork: artMap[r.artwork_handle] || null,
    openSale: saleMap[r.collector_id] || null, inquiryCount: counts[r.collector_id] || 1 }));
  return <Shell active="pipeline">
    <div className="h1">Pipeline</div>
    <div className="sub">{leads.length} open · drag between stages · click a lead for the full picture</div>
    <Kanban initial={leads} />
  </Shell>;
}
