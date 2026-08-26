import Shell from '../../components/Shell';
import { db } from '../../lib/db';
export const dynamic = 'force-dynamic';
const usd = (c) => '$' + Math.round((c || 0) / 100).toLocaleString();

export default async function Collectors({ searchParams }) {
  const sp = (await searchParams) || {};
  const q = sp.q || '';
  const seg = sp.seg || 'all';
  let query = db.from('collectors').select('*').order('created_at', { ascending: false }).limit(500);
  if (q) query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,city.ilike.%${q}%,company.ilike.%${q}%`);
  const { data: rows } = await query;
  const ids = (rows || []).map(r => r.id);
  const spend = {}, buysCount = {}, lastBuy = {}, topArtist = {};
  const openInq = {}, lastInq = {}, interests = {}, pins = {};
  if (ids.length) {
    const [{ data: buys }, { data: inqs }, { data: pinRows }] = await Promise.all([
      db.from('purchases').select('collector_id, amount_cents, artist, purchased_at').in('collector_id', ids),
      db.from('inquiries').select('collector_id, status, artist, created_at').in('collector_id', ids),
      db.from('collector_interests').select('collector_id, label').in('collector_id', ids),
    ]);
    (pinRows || []).forEach(p => (pins[p.collector_id] = pins[p.collector_id] || []).push(p.label));
    (buys || []).forEach(b => {
      spend[b.collector_id] = (spend[b.collector_id] || 0) + b.amount_cents;
      buysCount[b.collector_id] = (buysCount[b.collector_id] || 0) + 1;
      if (!lastBuy[b.collector_id] || b.purchased_at > lastBuy[b.collector_id]) lastBuy[b.collector_id] = b.purchased_at;
      if (b.artist) {
        const t = topArtist[b.collector_id] = topArtist[b.collector_id] || {};
        t[b.artist] = (t[b.artist] || 0) + b.amount_cents;
      }
    });
    (inqs || []).forEach(i => {
      if (['new','contacted','in_conversation','hold','invoice'].includes(i.status))
        openInq[i.collector_id] = (openInq[i.collector_id] || 0) + 1;
      if (!lastInq[i.collector_id] || i.created_at > lastInq[i.collector_id]) lastInq[i.collector_id] = i.created_at;
      if (i.artist) (interests[i.collector_id] = interests[i.collector_id] || new Set()).add(i.artist);
    });
  }
  let list = rows || [];
  if (seg === 'buyers') list = list.filter(c => spend[c.id]);
  if (seg === 'trade') list = list.filter(c => c.trade);
  if (seg === 'news') list = list.filter(c => c.newsletter);
  if (seg === 'active') list = list.filter(c => openInq[c.id]);
  list = list.sort((a, b) => (spend[b.id] || 0) - (spend[a.id] || 0) ||
    (lastInq[b.id] || '').localeCompare(lastInq[a.id] || ''));
  const totalLtv = Object.values(spend).reduce((a, b) => a + b, 0);
  const segs = [['all','All'],['buyers','Buyers'],['active','Active pipeline'],['trade','Trade'],['news','Newsletter']];
  return <Shell active="collectors">
    <div className="h1">Collectors</div>
    <div className="sub">{list.length} shown{q ? ` · "${q}"` : ''}</div>
    <div className="stats">
      <div className="stat"><div className="n">{(rows||[]).length}</div><div className="l">Collectors</div></div>
      <div className="stat"><div className="n">{Object.keys(spend).length}</div><div className="l">Buyers</div></div>
      <div className="stat"><div className="n">{usd(totalLtv)}</div><div className="l">Total lifetime value</div></div>
      <div className="stat"><div className="n">{Object.keys(spend).length ? usd(totalLtv / Object.keys(spend).length) : '—'}</div><div className="l">Avg LTV per buyer</div></div>
    </div>
    <div style={{display:'flex', gap:8, marginTop:20, alignItems:'center', flexWrap:'wrap'}}>
      {segs.map(([k, label]) => <a key={k} href={`/collectors?seg=${k}${q ? '&q=' + q : ''}`}
        className="pill" style={seg === k ? {background:'#1d1d1f', color:'#fff'} : {background:'#fff', border:'1px solid #e8e8ed'}}>{label}</a>)}
      <form style={{marginLeft:'auto'}}><input type="hidden" name="seg" value={seg}/>
        <input className="search" style={{marginTop:0}} name="q" defaultValue={q} placeholder="Search name, email, city, company" /></form>
    </div>
    <div className="tblcard"><table className="tbl"><thead><tr>
      <th>Collector</th><th>Lifetime</th><th>Works</th><th>Open</th><th>Interests</th><th>Last activity</th><th>Location</th><th>Flags</th>
    </tr></thead><tbody>
      {list.map(c => {
        const fav = topArtist[c.id] ? Object.entries(topArtist[c.id]).sort((a,b)=>b[1]-a[1])[0][0] : null;
        const ints = [...new Set([...(pins[c.id] || []), ...(fav ? [fav] : []), ...(interests[c.id] || [])])].slice(0, 3);
        const lastAct = [lastBuy[c.id], lastInq[c.id]].filter(Boolean).sort().pop();
        return <tr key={c.id}>
        <td><a href={'/collectors/'+c.id} style={{fontWeight:600}}>{c.first_name} {c.last_name}</a>
          <div style={{fontSize:12, color:'#86868b'}}>{c.email}{c.company ? ' · ' + c.company : ''}</div></td>
        <td style={{fontVariantNumeric:'tabular-nums', fontWeight:700}}>{spend[c.id] ? usd(spend[c.id]) : '—'}</td>
        <td>{buysCount[c.id] || 0}</td>
        <td>{openInq[c.id] ? <span className="pill blue">{openInq[c.id]}</span> : '—'}</td>
        <td style={{fontSize:12.5}}>{ints.join(' · ') || '—'}</td>
        <td style={{fontSize:12.5, color:'#86868b'}}>{lastAct ? new Date(lastAct).toLocaleDateString() : '—'}</td>
        <td style={{fontSize:12.5}}>{[c.city, c.state].filter(Boolean).join(', ') || '—'}</td>
        <td>{c.trade ? <span className="pill blue">Trade</span> : null} {c.newsletter ? <span className="pill">News</span> : null}</td>
      </tr>; })}
    </tbody></table></div>
    <form method="POST" action="/api/act" className="inline-form" style={{marginTop:20, flexWrap:'wrap'}}>
      <input type="hidden" name="action" value="collector_add"/>
      <input type="hidden" name="back" value="/collectors"/>
      <input name="first_name" placeholder="First name" required/>
      <input name="last_name" placeholder="Last name"/>
      <input name="email" placeholder="Email" type="email"/>
      <input name="phone" placeholder="Phone"/>
      <input name="city" placeholder="City"/>
      <input name="source" placeholder="Met at… (source)"/>
      <button className="btn mini">Add collector</button>
    </form>
  </Shell>;
}
