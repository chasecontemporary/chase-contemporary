import Shell from '../../components/Shell';
import Sel from '../../components/Sel';
import { db } from '../../lib/db';
export const dynamic = 'force-dynamic';
const usd = (c) => '$' + Math.round((c || 0) / 100).toLocaleString();
const ago = (d) => {
  if (!d) return null;
  const days = Math.floor((Date.now() - new Date(d)) / 86400000);
  if (days < 1) return 'today';
  if (days < 30) return days + 'd ago';
  if (days < 365) return Math.floor(days / 30) + ' mo ago';
  return Math.floor(days / 365) + ' yr ago';
};
const initials = (c) => ((c.first_name || c.email || '?')[0] + (c.last_name?.[0] || '')).toUpperCase();

export default async function Collectors({ searchParams }) {
  const sp = (await searchParams) || {};
  const q = sp.q || '';
  const seg = sp.seg || 'all';
  const artist = sp.artist || '';
  const min = sp.min || '';
  const def = { seg, q: q || null, artist: artist || null, min_spend: min || null };

  const [{ data: list }, { data: bookStats }, { data: topArtists }] = await Promise.all([
    db.rpc('collector_list', { def, lim: 200 }),
    db.from('book_stats').select('*').single(),
    db.from('artist_stats').select('artist, sold').gt('sold', 0).order('sold', { ascending: false }).limit(40),
  ]);
  const rows = list || [];
  const ids = rows.map(r => r.id);
  const pins = {}, boughtArtists = {};
  if (ids.length) {
    const [{ data: pinRows }, { data: buys }] = await Promise.all([
      db.from('collector_interests').select('collector_id, label').in('collector_id', ids),
      db.from('purchases').select('collector_id, artist, amount_cents').in('collector_id', ids),
    ]);
    (pinRows || []).forEach(p => (pins[p.collector_id] = pins[p.collector_id] || []).push(p.label));
    (buys || []).forEach(b => { if (b.artist) {
      const t = boughtArtists[b.collector_id] = boughtArtists[b.collector_id] || {};
      t[b.artist] = (t[b.artist] || 0) + b.amount_cents; } });
  }
  const s = bookStats || {};
  const segs = [['all','All'],['buyers','Buyers'],['active','Active pipeline'],['vip','VIP'],['trade','Trade'],['news','Newsletter']];
  const MINS = [['','Any lifetime'],['10000','$10k+'],['50000','$50k+'],['100000','$100k+'],['250000','$250k+']];
  const href = (over) => {
    const p = new URLSearchParams();
    const merged = { seg, q, artist, min, ...over };
    Object.entries(merged).forEach(([k, v]) => { if (v && v !== 'all') p.set(k, v); });
    const str = p.toString();
    return '/collectors' + (str ? '?' + str : '');
  };
  const filtered = seg !== 'all' || artist || min || q;
  return <Shell active="collectors">
    <div className="h1">Collectors</div>
    <div className="sub">{Number(s.collectors || 0).toLocaleString()} in the book · ranked by lifetime value</div>
    <div className="stats">
      <div className="stat"><div className="n">{Number(s.collectors || 0).toLocaleString()}</div><div className="l">Collectors</div></div>
      <div className="stat"><div className="n">{Number(s.buyers || 0).toLocaleString()}</div><div className="l">Buyers</div></div>
      <div className="stat"><div className="n">{usd(s.ltv_cents)}</div><div className="l">Total lifetime value</div></div>
      <div className="stat"><div className="n">{s.buyers ? usd(s.ltv_cents / s.buyers) : '—'}</div><div className="l">Avg LTV per buyer</div></div>
    </div>

    <div className="card" style={{marginTop:20, padding:'14px 16px'}}>
      <div style={{display:'flex', gap:7, alignItems:'center', flexWrap:'wrap'}}>
        {segs.map(([k, label]) => <a key={k} href={href({ seg: k })} className="pill"
          style={seg === k ? {background:'#1d1d1f', color:'#fff'} : {background:'#f5f5f7'}}>{label}</a>)}
      </div>
      <div style={{display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', marginTop:12}}>
        <form style={{display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}>
          {seg !== 'all' && <input type="hidden" name="seg" value={seg}/>}
          <Sel submit name="artist" defaultValue={artist}>
            <option value="">Any artist interest</option>
            {(topArtists || []).map(a => <option key={a.artist} value={a.artist}>{a.artist}</option>)}
          </Sel>
          <Sel submit name="min" defaultValue={min}>
            {MINS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Sel>
          <input className="search" style={{marginTop:0, width:240}} name="q" defaultValue={q} placeholder="Search name, email, city, company"/>
          <button className="btn mini">Apply</button>
          {filtered && <a href="/collectors" style={{fontSize:12.5, color:'#86868b'}}>Clear</a>}
        </form>
        <form method="POST" action="/api/act" style={{marginLeft:'auto', display:'flex', gap:6, alignItems:'center'}}>
          <input type="hidden" name="action" value="audience_add"/>
          <input type="hidden" name="back" value="/audiences"/>
          <input type="hidden" name="seg" value={seg}/>
          <input type="hidden" name="artist" value={artist}/>
          <input type="hidden" name="min_spend" value={min}/>
          <input type="hidden" name="consented" value="true"/>
          <input name="name" placeholder="Save view as audience…" required
            style={{border:'1px solid #e8e8ed', borderRadius:99, fontFamily:'inherit', fontSize:12.5, padding:'6px 12px', width:190}}/>
          <button className="btn mini">Save segment</button>
        </form>
      </div>
    </div>

    <div className="tblcard" style={{marginTop:14}}>
      <div style={{padding:'10px 18px', fontSize:12, color:'#86868b', borderBottom:'1px solid #f0f0f2'}}>
        {rows.length} shown{filtered ? ' · filtered' : ' · top of the book'} · the save box turns this exact view into an email audience</div>
      {rows.map(c => {
        const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email;
        const synthetic = c.email?.endsWith('import.chasecontemporary.com');
        const vip = (c.tags || []).includes('VIP list');
        const fav = boughtArtists[c.id]
          ? Object.entries(boughtArtists[c.id]).sort((a, b) => b[1] - a[1])[0][0] : null;
        const ints = [...new Set([...(fav ? [fav] : []), ...(pins[c.id] || [])])].slice(0, 2);
        const lastAct = [c.last_buy, c.last_inq].filter(Boolean).sort().pop();
        return <a key={c.id} href={'/collectors/' + c.id} style={{display:'grid',
          gridTemplateColumns:'44px minmax(220px,1.4fr) minmax(180px,1fr) 150px', gap:16, alignItems:'center',
          padding:'13px 18px', borderBottom:'1px solid #f5f5f7', textDecoration:'none', color:'inherit'}}>
          <div style={{width:40, height:40, borderRadius:'50%', background:'#f0f0f2', display:'flex',
            alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'#6e6e73'}}>{initials(c)}</div>
          <div>
            <div style={{display:'flex', gap:6, alignItems:'center', flexWrap:'wrap'}}>
              <span style={{fontWeight:650, fontSize:14}}>{name}</span>
              {vip && <span className="pill" style={{fontSize:10, fontWeight:700, background:'#1d1d1f', color:'#fff'}}>VIP</span>}
              {c.trade && <span className="pill blue" style={{fontSize:10, fontWeight:700}}>TRADE</span>}
              {c.open_inq > 0 && <span className="pill blue" style={{fontSize:10, fontWeight:700}}>{c.open_inq} OPEN</span>}
            </div>
            <div style={{fontSize:12, color:'#86868b', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
              {[[c.city, c.state].filter(Boolean).join(', '), c.company, synthetic ? null : c.email].filter(Boolean).join(' · ') || '—'}
            </div>
          </div>
          <div>
            <div style={{display:'flex', gap:5, flexWrap:'wrap'}}>
              {ints.map(i => <span key={i} className="pill" style={{fontSize:10.5, background:'#f5f5f7'}}>{i}</span>)}
              {!ints.length && <span style={{fontSize:12, color:'#c7c7cc'}}>no signals yet</span>}
            </div>
            {lastAct && <div style={{fontSize:11.5, color:'#86868b', marginTop:4}}>active {ago(lastAct)}</div>}
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:15, fontWeight:700, fontVariantNumeric:'tabular-nums'}}>
              {c.spend_cents > 0 ? usd(c.spend_cents) : '—'}</div>
            <div style={{fontSize:11.5, color:'#86868b', marginTop:2}}>
              {c.works > 0 ? `${c.works} work${c.works > 1 ? 's' : ''}${c.last_buy ? ' · last ' + ago(c.last_buy) : ''}` : 'no purchases'}</div>
          </div>
        </a>; })}
      {!rows.length && <div className="empty">No collectors match.</div>}
    </div>

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
