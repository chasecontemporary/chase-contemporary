import Shell from '../../components/Shell';
import Kanban from '../../components/Kanban';
import { db } from '../../lib/db';
export const dynamic = 'force-dynamic';

export default async function Pipeline() {
  // Three waves instead of nine sequential round trips. Everything in wave two depends
  // only on the inquiry rows, so it all goes at once; only the reserves need artwork ids.
  const INQ_FIELDS = 'id, status, collector_id, artwork_handle, artwork_title, purpose, ' +
    'budget_range, timeframe, source, owner, message, page_journey, created_at, ' +
    'stage_changed_at, contacted_at, first_called_at';
  const ART_FIELDS = 'id, handle, title, artist, price_cents, internal_value_cents, ' +
    'image_url, medium, dims_h_in, dims_w_in, available';

  const [{ data: rows }, { data: team }] = await Promise.all([
    db.from('inquiries')
      .select(`${INQ_FIELDS}, collectors(id, first_name, last_name, email, phone, city, timezone, budget_range, trade, source, address_line1, state)`)
      .neq('status', 'closed').order('created_at', { ascending: false }).limit(300),
    db.from('team_members').select('name').eq('active', true).order('name'),
  ]);

  const handles = [...new Set((rows || []).map(r => r.artwork_handle).filter(Boolean))];
  const titles = [...new Set((rows || []).map(r => r.artwork_title).filter(Boolean))];
  const collectorIds = [...new Set((rows || []).map(r => r.collector_id).filter(Boolean))];
  const none = Promise.resolve({ data: [] });

  const [{ data: byHandle }, { data: byTitle }, { data: sales }, { data: idx },
         { data: jn }, { data: openInv }] = await Promise.all([
    handles.length ? db.from('artworks').select(ART_FIELDS).in('handle', handles) : none,
    titles.length  ? db.from('artworks').select(ART_FIELDS).in('title', titles)  : none,
    collectorIds.length ? db.from('sales').select('*, sale_items(*)').eq('status', 'open').in('collector_id', collectorIds) : none,
    collectorIds.length ? db.from('collector_index').select('id, spend_cents, works, tags').in('id', collectorIds) : none,
    collectorIds.length ? db.from('collector_journey').select('*').in('collector_id', collectorIds) : none,
    collectorIds.length ? db.from('invoices')
      .select('id, invoice_number, amount_cents, tax_cents, shipping_cents, collector_id, pdf_url')
      .eq('status', 'open').in('collector_id', collectorIds) : none,
  ]);

  const artMap = {}, titleMap = {}, saleMap = {}, ltvMap = {}, journeyMap = {}, invoiceMap = {};
  (byHandle || []).forEach(a => { artMap[a.handle] = a; });
  (byTitle  || []).forEach(a => { titleMap[a.title] = a; });
  (sales    || []).forEach(x => { saleMap[x.collector_id] = x; });
  (idx      || []).forEach(x => { ltvMap[x.id] = x; });
  (jn       || []).forEach(j => { journeyMap[j.collector_id] = j; });
  (openInv  || []).forEach(i => { invoiceMap[i.collector_id] = i; });

  // reserves are the only thing that needs the artwork ids
  const artIds = [...new Set([...Object.values(artMap), ...Object.values(titleMap)].map(a => a.id))];
  const reserveMap = {};
  if (artIds.length) {
    const { data: res } = await db.from('artwork_reserves').select('*').in('artwork_id', artIds);
    (res || []).forEach(r => { if (!r.lapsed) reserveMap[r.artwork_id] = r; });
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
  const leads = (rows || []).map(r => ({ ...r,
    artwork: artMap[r.artwork_handle] || titleMap[r.artwork_title] || null,
    openSale: saleMap[r.collector_id] || null, inquiryCount: counts[r.collector_id] || 1,
    ltv: Number(ltvMap[r.collector_id]?.spend_cents || 0), worksOwned: Number(ltvMap[r.collector_id]?.works || 0),
    vip: (ltvMap[r.collector_id]?.tags || []).includes('VIP list'),
    openInvoice: invoiceMap[r.collector_id] || null,
    journey: journeyMap[r.collector_id] || null,
    reserve: (artMap[r.artwork_handle] || titleMap[r.artwork_title])
      ? reserveMap[(artMap[r.artwork_handle] || titleMap[r.artwork_title]).id] || null : null,
    competition: competition[r.id] || { others: 0, committed: null } }));

  // the owner's read of the board, in four numbers
  const BUDGET_MID = { 'Under $10,000': 500000, '$10,000-25,000': 1750000, '$25,000-50,000': 3750000,
    '$50,000-100,000': 7500000, '$100,000+': 10000000 };
  const worth = (l) => (l.artwork?.price_cents > 0 ? l.artwork.price_cents
    : l.artwork?.internal_value_cents > 0 ? l.artwork.internal_value_cents : (BUDGET_MID[l.budget_range] || 0));
  const usd = (c) => '$' + Math.round((c || 0) / 100).toLocaleString();
  const ACTIVE = ['new', 'contacted', 'in_conversation', 'hold'];
  const inPlay = leads.filter(l => ACTIVE.includes(l.status));
  const invoiced = leads.filter(l => l.status === 'invoice');
  const awaiting = leads.filter(l => l.status === 'new').length;

  return <Shell active="pipeline">
    <div className="h1">Sales pipeline</div>
    <div className="sub">{leads.length} open · drag between stages · click a lead for the full picture</div>
    <div className="stats" style={{marginTop:18}}>
      <div className="stat"><div className="n">{usd(inPlay.reduce((s, l) => s + worth(l), 0))}</div>
        <div className="l">Value in play</div></div>
      <div className="stat"><div className="n">{inPlay.length}</div>
        <div className="l">Conversations in motion</div></div>
      <div className="stat"><div className="n" style={awaiting > 0 ? {color:'#c02d23'} : {}}>{awaiting}</div>
        <div className="l">Awaiting first response</div></div>
      <div className="stat"><div className="n">{usd(invoiced.reduce((s, l) => s + worth(l), 0))}</div>
        <div className="l">Invoiced · awaiting payment</div></div>
    </div>
    <Kanban initial={leads} team={(team || []).map(t => t.name)} />
  </Shell>;
}
