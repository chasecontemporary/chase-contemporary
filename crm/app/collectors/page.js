import Shell from '../../components/Shell';
import { db } from '../../lib/db';
export const dynamic = 'force-dynamic';
const usd = (c) => '$' + Math.round((c || 0) / 100).toLocaleString();

export default async function Collectors({ searchParams }) {
  const sp = (await searchParams) || {};
  const q = sp.q || '';
  const seg = sp.seg || 'all';
  let query = db.from('collector_index').select('*')
    .order('spend_cents', { ascending: false })
    .order('last_inq', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(500);
  if (q) query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,city.ilike.%${q}%,company.ilike.%${q}%`);
  if (seg === 'buyers') query = query.gt('spend_cents', 0);
  if (seg === 'trade') query = query.eq('trade', true);
  if (seg === 'news') query = query.eq('newsletter', true);
  if (seg === 'vip') query = query.contains('tags', ['VIP list']);
  if (seg === 'active') query = query.gt('open_inq', 0);
  const [{ data: rows }, { count: totalCollectors }, { count: totalBuyers }, { data: ltvAgg }] = await Promise.all([
    query,
    db.from('collectors').select('id', { count: 'exact', head: true }),
    db.from('collector_index').select('id', { count: 'exact', head: true }).gt('spend_cents', 0),
    db.from('purchases').select('amount_cents.sum()'),
  ]);
  const totalLtv = ltvAgg?.[0]?.sum || 0;
  const list = rows || [];
  const ids = list.map(r => r.id);
  const topArtist = {}, interests = {}, pins = {};
  if (ids.length) {
    const [{ data: buys }, { data: inqs }, { data: pinRows }] = await Promise.all([
      db.from('purchases').select('collector_id, amount_cents, artist').in('collector_id', ids),
      db.from('inquiries').select('collector_id, artist').in('collector_id', ids),
      db.from('collector_interests').select('collector_id, label').in('collector_id', ids),
    ]);
    (buys || []).forEach(b => { if (b.artist) {
      const t = topArtist[b.collector_id] = topArtist[b.collector_id] || {};
      t[b.artist] = (t[b.artist] || 0) + b.amount_cents; } });
    (inqs || []).forEach(i => { if (i.artist)
      (interests[i.collector_id] = interests[i.collector_id] || new Set()).add(i.artist); });
    (pinRows || []).forEach(p => (pins[p.collector_id] = pins[p.collector_id] || []).push(p.label));
  }
  const segs = [['all','All'],['buyers','Buyers'],['active','Active pipeline'],['vip','VIP'],['trade','Trade'],['news','Newsletter']];
  return <Shell active="collectors">
    <div className="h1">Collectors</div>
    <div className="sub">{totalCollectors?.toLocaleString()} in the book · showing top {list.length}{q ? ` for "${q}"` : ''} by lifetime value</div>
    <div className="stats">
      <div className="stat"><div className="n">{(totalCollectors || 0).toLocaleString()}</div><div className="l">Collectors</div></div>
      <div className="stat"><div className="n">{(totalBuyers || 0).toLocaleString()}</div><div className="l">Buyers</div></div>
      <div className="stat"><div className="n">{usd(totalLtv)}</div><div className="l">Total lifetime value</div></div>
      <div className="stat"><div className="n">{totalBuyers ? usd(totalLtv / totalBuyers) : '—'}</div><div className="l">Avg LTV per buyer</div></div>
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
        const lastAct = [c.last_buy, c.last_inq].filter(Boolean).sort().pop();
        return <tr key={c.id}>
        <td><a href={'/collectors/'+c.id} style={{fontWeight:600}}>{[c.first_name, c.last_name].filter(Boolean).join(' ') || c.email}</a>
          <div style={{fontSize:12, color:'#86868b'}}>{c.email?.endsWith('import.chasecontemporary.com') ? 'no email on file' : c.email}{c.company ? ' · ' + c.company : ''}</div></td>
        <td style={{fontVariantNumeric:'tabular-nums', fontWeight:700}}>{c.spend_cents ? usd(c.spend_cents) : '—'}</td>
        <td>{c.works || '—'}</td>
        <td>{c.open_inq ? <span className="pill blue">{c.open_inq}</span> : '—'}</td>
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
