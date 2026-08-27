import Shell from '../../components/Shell';
import { db } from '../../lib/db';
export const dynamic = 'force-dynamic';
const usd = (c) => '$' + Math.round((c || 0) / 100).toLocaleString();
const ago = (d) => {
  if (!d) return null;
  const days = Math.floor((Date.now() - new Date(d)) / 86400000);
  if (days < 30) return days + 'd ago';
  if (days < 365) return Math.floor(days / 30) + ' mo ago';
  return Math.floor(days / 365) + ' yr ago';
};

export default async function Artists({ searchParams }) {
  const sp = (await searchParams) || {};
  const q = (sp.q || '').toLowerCase();
  const v = sp.v || 'all';
  const sort = sp.sort || 'onhand';
  const dir = sp.dir === 'asc' ? 1 : -1;
  const { data: rows } = await db.from('artist_performance').select('*')
    .order('revenue_cents', { ascending: false }).limit(160);
  const verdict = (r) => {
    const st = Number(r.sell_through);
    if (r.sold >= 10 && st >= 70) return ['DOUBLE DOWN', {background:'#e4f7e9', color:'#1d7a3d'}];
    if (Number(r.on_hand_value_cents) > 10000000 && (st < 40 || !r.sold)) return ['MOVE STOCK', {background:'#ffefdc', color:'#b25a00'}];
    return null;
  };
  let list = (rows || []).filter(r => r.sold > 0 || r.on_hand > 0);
  const totRev = list.reduce((s, r) => s + Number(r.revenue_cents || 0), 0);
  const totHold = list.reduce((s, r) => s + Number(r.on_hand_value_cents || 0), 0);
  const flagged = list.filter(r => verdict(r)?.[0] === 'MOVE STOCK').length;
  const doubled = list.filter(r => verdict(r)?.[0] === 'DOUBLE DOWN').length;
  if (q) list = list.filter(r => r.artist.toLowerCase().includes(q));
  if (v === 'double') list = list.filter(r => verdict(r)?.[0] === 'DOUBLE DOWN');
  if (v === 'move') list = list.filter(r => verdict(r)?.[0] === 'MOVE STOCK');
  const supply = (r) => Number(r.sold_12mo) > 0 ? Number(r.on_hand) / (Number(r.sold_12mo) / 12)
    : (Number(r.on_hand) > 0 ? Infinity : null);
  const KEYS = {
    artist: (r) => r.artist.toLowerCase(),
    sellthrough: (r) => r.sell_through === null ? -1 : Number(r.sell_through),
    velocity: (r) => Number(r.sold_12mo || 0),
    supply: (r) => supply(r) === null ? -1 : supply(r),
    onhand: (r) => Number(r.on_hand || 0) * 1e12 + Number(r.on_hand_value_cents || 0),
    revenue: (r) => Number(r.revenue_cents || 0),
  };
  const keyFn = KEYS[sort] || KEYS.onhand;
  list = [...list].sort((a, b) => {
    const x = keyFn(a), y = keyFn(b);
    return (x < y ? -1 : x > y ? 1 : 0) * dir;
  });
  const maxRev = Math.max(...list.map(r => Number(r.revenue_cents || 0)), 1);
  const { data: compRows } = await db.from('artist_comps').select('artist, median_ppsi_cents, recent_ppsi_cents, n_recent');
  const trend = {};
  (compRows || []).forEach(c => {
    if (c.n_recent >= 3 && c.recent_ppsi_cents && Number(c.median_ppsi_cents) > 0)
      trend[c.artist] = Math.round(100 * (Number(c.recent_ppsi_cents) - Number(c.median_ppsi_cents)) / Number(c.median_ppsi_cents));
  });

  // one representative image per artist (their priciest photographed work)
  const names = list.map(r => r.artist);
  const thumb = {};
  if (names.length) {
    const { data: arts } = await db.from('artworks')
      .select('artist, image_url, price_cents').in('artist', names)
      .not('image_url', 'is', null).order('price_cents', { ascending: false, nullsFirst: false }).limit(600);
    (arts || []).forEach(a => { if (!thumb[a.artist]) thumb[a.artist] = a.image_url; });
  }
  const CHIPS = [['all', 'All'], ['double', `Double down · ${doubled}`], ['move', `Move stock · ${flagged}`]];
  const href = (over) => {
    const p = new URLSearchParams();
    const m = { q: sp.q || '', v, sort, dir: sp.dir || '', ...over };
    Object.entries(m).forEach(([k, val]) => { if (val && val !== 'all') p.set(k, val); });
    const s = p.toString();
    return '/artists' + (s ? '?' + s : '');
  };
  const sortHref = (key) => href({ sort: key, dir: sort === key && dir === -1 ? 'asc' : '' });
  const arrow = (key) => sort === key ? (dir === -1 ? ' ↓' : ' ↑') : '';
  return <Shell active="artists">
    <div className="h1">Artists</div>
    <div className="sub">Capital allocation from realized sales — buy deeper into velocity, move what sits</div>
    {(() => {
      const all = (rows || []).filter(r => r.sold > 0 || r.on_hand > 0);
      const units = all.reduce((s, r) => s + Number(r.on_hand || 0), 0);
      const rate12 = all.reduce((s, r) => s + Number(r.sold_12mo || 0), 0);
      const bookSupply = rate12 > 0 ? Math.round(units / (rate12 / 12)) : null;
      return <div className="stats">
        <div className="stat"><div className="n">{units.toLocaleString()}</div><div className="l">Units on hand · {all.length} artists</div></div>
        <div className="stat"><div className="n">{usd(totHold)}</div><div className="l">Capital on hand (priced retail)</div></div>
        <div className="stat"><div className="n">{rate12}</div><div className="l">Works sold, last 12 months</div></div>
        <div className="stat"><div className="n">{bookSupply === null ? '—' : bookSupply + ' mo'}</div><div className="l">Months of supply at current velocity</div></div>
      </div>; })()}

    <div style={{display:'flex', gap:8, marginTop:20, alignItems:'center', flexWrap:'wrap'}}>
      {CHIPS.map(([k, label]) => <a key={k} href={href({ v: k })} className="pill"
        style={v === k ? {background:'#1d1d1f', color:'#fff'} : {background:'#fff', border:'1px solid #e8e8ed'}}>{label}</a>)}
      <form style={{marginLeft:'auto'}}>{v !== 'all' && <input type="hidden" name="v" value={v}/>}
        <input className="search" style={{marginTop:0, width:240}} name="q" defaultValue={sp.q || ''} placeholder="Search artists"/></form>
    </div>

    <div className="tblcard" style={{marginTop:14}}>
      <div style={{display:'grid', gridTemplateColumns:'minmax(220px,1.4fr) 120px 105px 95px 100px 80px 145px', gap:14,
        padding:'10px 18px', borderBottom:'1px solid #f0f0f2'}}>
        {[['artist','Artist'],['onhand','On hand'],['supply','Supply'],['velocity','Sold 12 mo'],['sellthrough','Sell-through'],['trend','Trend'],['revenue','Lifetime revenue']].map(([k, h], i) =>
          <a key={k} href={k === 'trend' ? '#' : sortHref(k)} style={{fontSize:11, fontWeight:650, letterSpacing:'.04em', textTransform:'uppercase',
            color: sort === k ? '#1d1d1f' : '#86868b', textAlign:i >= 1 && i !== 4 ? 'right' : 'left', textDecoration:'none'}}>{h}{arrow(k)}</a>)}
      </div>
      {list.map(r => {
        const st = r.sell_through === null ? null : Number(r.sell_through);
        const vd = verdict(r);
        const share = Number(r.revenue_cents || 0) / maxRev;
        const sup = supply(r);
        const tr = trend[r.artist];
        return <a key={r.artist} href={'/inventory?view=all&artist=' + encodeURIComponent(r.artist)}
          style={{display:'grid', gridTemplateColumns:'minmax(220px,1.4fr) 120px 105px 95px 100px 80px 145px', gap:14,
            alignItems:'center', padding:'12px 18px', borderBottom:'1px solid #f5f5f7',
            textDecoration:'none', color:'inherit'}}>
          <span style={{display:'flex', gap:12, alignItems:'center', minWidth:0}}>
            {thumb[r.artist]
              ? <img src={thumb[r.artist] + (thumb[r.artist].includes('?') ? '&' : '?') + 'width=88'} alt=""
                  style={{width:40, height:40, objectFit:'cover', borderRadius:8, flex:'0 0 auto', background:'#fafafa'}}/>
              : <span style={{width:40, height:40, borderRadius:8, background:'#f0f0f2', flex:'0 0 auto'}}/>}
            <span style={{minWidth:0}}>
              <span style={{display:'flex', gap:8, alignItems:'center'}}>
                <span style={{fontWeight:650, fontSize:14, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{r.artist}</span>
                {vd && <span className="pill" style={{fontSize:9.5, fontWeight:700, ...vd[1], flex:'0 0 auto'}}>{vd[0]}</span>}
              </span>
              <span style={{display:'block', fontSize:11.5, color:'#86868b', marginTop:2}}>
                {r.last_sale ? 'last sale ' + ago(r.last_sale) : 'no sales yet'}</span>
            </span>
          </span>
          <span style={{textAlign:'right'}}>
            <span style={{fontVariantNumeric:'tabular-nums', fontWeight:700, fontSize:14}}>{r.on_hand > 0 ? Number(r.on_hand).toLocaleString() : '—'}</span>
            <span style={{display:'block', fontSize:11.5, color:'#86868b'}}>{r.on_hand_value_cents > 0 ? usd(r.on_hand_value_cents) : r.on_hand > 0 ? 'unpriced' : ''}</span>
          </span>
          <span style={{textAlign:'right'}}>{sup === null ? <span style={{color:'#c7c7cc'}}>—</span>
            : sup === Infinity ? <span className="pill" style={{background:'#ffefdc', color:'#b25a00', fontWeight:700, fontSize:10}}>NO VELOCITY</span>
            : <span className="pill" style={{fontSize:10.5, fontWeight:700, fontVariantNumeric:'tabular-nums',
                ...(sup <= 12 ? {background:'#e4f7e9', color:'#1d7a3d'} : sup <= 24 ? {background:'#f0f0f2'}
                  : {background:'#ffefdc', color:'#b25a00'})}}>{Math.round(sup)} MO</span>}</span>
          <span style={{textAlign:'right', fontVariantNumeric:'tabular-nums'}}>{Number(r.sold_12mo) > 0 ? r.sold_12mo : '—'}</span>
          <span>{st === null ? <span style={{color:'#c7c7cc'}}>—</span>
            : <span className="pill" style={{fontSize:10.5, fontWeight:700,
                ...(st >= 70 ? {background:'#e4f7e9', color:'#1d7a3d'} : st >= 40 ? {background:'#f0f0f2'}
                  : {background:'#ffefdc', color:'#b25a00'})}}>{st}%</span>}</span>
          <span style={{textAlign:'right', fontVariantNumeric:'tabular-nums', fontWeight:600,
            color: tr === undefined ? '#c7c7cc' : tr >= 0 ? '#1d7a3d' : '#b25a00'}}>
            {tr === undefined ? '—' : (tr >= 0 ? '+' : '') + tr + '%'}</span>
          <span style={{textAlign:'right'}}>
            <span style={{fontVariantNumeric:'tabular-nums', fontWeight:700, fontSize:14}}>{r.revenue_cents > 0 ? usd(r.revenue_cents) : '—'}</span>
            <span className="meter" style={{marginTop:5, marginLeft:'auto', width:'100%'}}>
              <i style={{width: Math.max(2, Math.round(share * 100)) + '%'}}/></span>
          </span>
        </a>; })}
      {!list.length && <div className="empty">No artists match.</div>}
    </div>
  </Shell>;
}
