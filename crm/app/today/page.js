import Shell from '../../components/Shell';
import Sla from '../../components/Sla';
import { db } from '../../lib/db';
export const dynamic = 'force-dynamic';

const usdM = (c) => '$' + Math.round((c || 0) / 100).toLocaleString();
export default async function Today() {
  const cutoff = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
  const { data: dueBacks } = await db.from('holds')
    .select('id, out_to, expires_at, collector_id, artworks(id, title, artist, image_url)')
    .eq('kind', 'approval').eq('status', 'active').order('expires_at');
  const { data: agingRows } = await db.from('artworks')
    .select('id, title, artist, price_cents, internal_value_cents, image_url, acquired_at, location')
    .eq('available', true).lt('acquired_at', cutoff)
    .order('price_cents', { ascending: false, nullsFirst: false }).limit(6);
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
            {!r.first_called_at && <form method="POST" action="/api/act">
              <input type="hidden" name="action" value="called"/><input type="hidden" name="id" value={r.id}/>
              <button className="btn mini">Log call</button></form>}
            {!r.contacted_at && <form method="POST" action="/api/act">
              <input type="hidden" name="action" value="contacted"/><input type="hidden" name="id" value={r.id}/>
              <button className="btn ghost mini">Answered</button></form>}
            <a className="btn ghost mini" href={'/collectors/' + r.collector_id}>Open card</a>
          </div>
        </div>;
      })}
    </div>
    {!rows?.length && <div className="empty">No open inquiries. The floor is clear.</div>}
  
    {(dueBacks || []).length > 0 && <>
    <div className="h1" style={{fontSize:18, marginTop:34}}>Out on approval</div>
    <div className="sub">Works outside the gallery — chase the due dates</div>
    <div className="tblcard" style={{marginTop:12}}>
      {(dueBacks || []).map(h => {
        const overdue = h.expires_at && new Date(h.expires_at) < new Date();
        return <a key={h.id} href={'/inventory/' + h.artworks?.id} style={{display:'flex', gap:12, alignItems:'center',
          padding:'11px 16px', borderBottom:'1px solid #f5f5f7', textDecoration:'none', color:'inherit'}}>
          {h.artworks?.image_url ? <img src={h.artworks.image_url + (h.artworks.image_url.includes('?') ? '&' : '?') + 'width=72'}
            alt="" style={{width:36, height:36, objectFit:'cover', borderRadius:6}}/> : <span style={{width:36, height:36, borderRadius:6, background:'#f0f0f2'}}/>}
          <span style={{flex:1}}>
            <span style={{fontWeight:600, fontSize:13.5}}>{h.artworks?.title}</span>
            <span style={{color:'#86868b', fontSize:12.5}}> · {h.artworks?.artist} · with {h.out_to}</span>
          </span>
          <span className="pill" style={overdue ? {background:'#ffefdc', color:'#b25a00', fontWeight:700, fontSize:10.5}
            : {background:'#f0f0f2', fontSize:10.5, fontWeight:700}}>
            {overdue ? 'OVERDUE · ' : 'DUE '}{h.expires_at ? new Date(h.expires_at).toLocaleDateString() : '—'}</span>
        </a>; })}
    </div></>}
    {(agingRows || []).length > 0 && <>
    <div className="h1" style={{fontSize:18, marginTop:34}}>Move list</div>
    <div className="sub">Highest-value works sitting over a year — feature in a drop, reprice, or place</div>
    <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(150px, 1fr))', gap:12, marginTop:14}}>
      {(agingRows || []).map(w => {
        const mo = Math.floor((Date.now() - new Date(w.acquired_at)) / 2629800000);
        return <a key={w.id} href={'/inventory/' + w.id} className="card" style={{padding:8, display:'block', textDecoration:'none', color:'inherit'}}>
          <div style={{aspectRatio:'1', background:'#fafafa', borderRadius:6, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center'}}>
            {w.image_url ? <img src={w.image_url + (w.image_url.includes('?') ? '&' : '?') + 'width=300'} alt="" style={{width:'100%', height:'100%', objectFit:'contain'}}/> : <span style={{fontSize:10, color:'#c7c7cc'}}>NO IMAGE</span>}
          </div>
          <div style={{fontSize:11, fontWeight:650, marginTop:6, textTransform:'uppercase', letterSpacing:'.04em'}}>{w.artist}</div>
          <div style={{fontSize:12, fontStyle:'italic', color:'#3a3a3c', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{w.title}</div>
          <div style={{fontSize:11.5, marginTop:3, fontWeight:600}}>{(w.price_cents || w.internal_value_cents) > 0 ? usdM(w.price_cents || w.internal_value_cents) : 'POR'}
            <span className="pill" style={{marginLeft:6, fontSize:9.5, fontWeight:700, background:'#ffefdc', color:'#b25a00'}}>{mo} MO</span></div>
        </a>; })}
    </div></>}
  </Shell>;
}
