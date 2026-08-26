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
  const working = (rows || []).filter(r => r.status === 'contacted');
  return <Shell active="today">
    <div className="h1">TODAY</div>
    <div className="sub">{open.length} AWAITING FIRST RESPONSE · {working.length} IN PROGRESS</div>
    <div className="grid-cards">
      {(rows || []).map(r => {
        const c = r.collectors || {};
        return <div className="qcard" key={r.id}>
          <Sla createdAt={r.created_at} contactedAt={r.contacted_at} />
          <div className="who">{c.first_name} {c.last_name}{c.trade ? ' · TRADE' : ''}
            <small>{c.email}{c.phone ? ' · ' + c.phone : ''}{c.city ? ' · ' + c.city : ''}</small></div>
          <div className="what">{r.artwork_title || r.purpose}
            <small>{[r.artist, r.price_band].filter(Boolean).join(' · ')}</small></div>
          <div className="meta">{[r.budget_range, r.timeframe, r.source].filter(Boolean).join(' · ')}<br/>
            {r.owner ? 'OWNER: ' + r.owner : 'UNCLAIMED'}</div>
          <div style={{display:'flex', gap:10}}>
            {!r.contacted_at && <form method="POST" action="/api/act">
              <input type="hidden" name="action" value="contacted"/><input type="hidden" name="id" value={r.id}/>
              <button className="btn">MARK ANSWERED</button></form>}
            <a className="btn ghost" href={'/collectors/' + r.collector_id}>CARD</a>
          </div>
        </div>;
      })}
    </div>
    {!rows?.length && <div className="empty">NO OPEN INQUIRIES. THE FLOOR IS CLEAR.</div>}
  </Shell>;
}
