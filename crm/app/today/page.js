import Shell from '../../components/Shell';
import Sla from '../../components/Sla';
import { db } from '../../lib/db';
export const dynamic = 'force-dynamic';

export default async function Today() {
  const { data: rows } = await db.from('inquiries')
    .select('*, collectors(first_name, last_name, email, phone, city, budget_range, trade)')
    .in('status', ['new', 'contacted'])
    .order('created_at', { ascending: false }).limit(60);
  const open = (rows || []).filter(r => r.status === 'new');
  return <Shell active="today" counts={{ today: open.length }}>
    <div className="h1">Today</div>
    <div className="sub">{open.length} awaiting first response · {(rows||[]).length - open.length} in progress</div>
    <div className="stack">
      {(rows || []).map(r => {
        const c = r.collectors || {};
        return <div className="card row" key={r.id}>
          <Sla createdAt={r.created_at} contactedAt={r.contacted_at} />
          <div className="who">{c.first_name} {c.last_name}{c.trade ? ' · Trade' : ''}
            <small>{[c.email, c.phone, c.city].filter(Boolean).join(' · ')}</small></div>
          <div className="what">{r.artwork_title || r.purpose}
            <small>{[r.artist, r.price_band].filter(Boolean).join(' · ')}</small></div>
          <div className="meta">{[r.budget_range, r.timeframe, r.source].filter(Boolean).join(' · ')}<br/>
            {r.owner ? 'Owner: ' + r.owner : 'Unclaimed'}</div>
          <div style={{display:'flex', gap:8}}>
            {!r.contacted_at && <form method="POST" action="/api/act">
              <input type="hidden" name="action" value="contacted"/><input type="hidden" name="id" value={r.id}/>
              <button className="btn mini">Mark answered</button></form>}
            <a className="btn ghost mini" href={'/collectors/' + r.collector_id}>Open card</a>
          </div>
        </div>;
      })}
    </div>
    {!rows?.length && <div className="empty">No open inquiries. The floor is clear.</div>}
  </Shell>;
}
