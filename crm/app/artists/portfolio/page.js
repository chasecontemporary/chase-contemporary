import Shell from '../../../components/Shell';
import { db } from '../../../lib/db';
export const dynamic = 'force-dynamic';
const usd = (c) => '$' + Math.round((c || 0) / 100).toLocaleString();
const ago = (d) => {
  if (!d) return null;
  const days = Math.floor((Date.now() - new Date(d)) / 86400000);
  if (days < 30) return days + 'd ago';
  if (days < 365) return Math.floor(days / 30) + ' mo ago';
  return Math.floor(days / 365) + ' yr ago';
};

export default async function Portfolio({ searchParams }) {
  const sp = (await searchParams) || {};
  const name = sp.name;
  const v = sp.v || 'onhand';
  if (!name) return <Shell active="artists"><div className="empty">No artist given.</div></Shell>;
  const [{ data: perf }, { data: comps }, { data: bio }, { data: works }, { data: buys }] = await Promise.all([
    db.from('artist_performance').select('*').eq('artist', name).single().then(r => r),
    db.from('artist_comps').select('*').eq('artist', name).single().then(r => r),
    db.from('artist_bios').select('bio').eq('artist', name).single().then(r => r),
    db.from('artworks').select('*').eq('artist', name)
      .order('available', { ascending: false })
      .order('image_url', { ascending: false, nullsFirst: false })
      .order('price_cents', { ascending: false, nullsFirst: false }).limit(400),
    db.from('purchases').select('collector_id, amount_cents, purchased_at, collectors(id, first_name, last_name, email)')
      .eq('artist', name).order('purchased_at', { ascending: false }).limit(500),
  ]);
  if (!perf) return <Shell active="artists"><div className="empty">No record of {name}.</div></Shell>;
  const all = works || [];
  const onHand = all.filter(w => w.available);
  const soldW = all.filter(w => !w.available);
  const shown = v === 'sold' ? soldW : v === 'all' ? all : onHand;
  const portfolioValue = onHand.reduce((s, w) => s + Number(w.price_cents || w.internal_value_cents || 0), 0);
  const unpriced = onHand.filter(w => !(w.price_cents > 0 || w.internal_value_cents > 0)).length;
  const supply = Number(perf.sold_12mo) > 0 ? Math.round(Number(perf.on_hand) / (Number(perf.sold_12mo) / 12)) : null;
  const trend = comps && comps.n_recent >= 3 && comps.recent_ppsi_cents && Number(comps.median_ppsi_cents) > 0
    ? Math.round(100 * (Number(comps.recent_ppsi_cents) - Number(comps.median_ppsi_cents)) / Number(comps.median_ppsi_cents)) : null;

  const byCollector = {};
  (buys || []).forEach(b => {
    if (!b.collectors) return;
    const k = b.collectors.id;
    byCollector[k] = byCollector[k] || { c: b.collectors, n: 0, spent: 0, last: b.purchased_at };
    byCollector[k].n += 1; byCollector[k].spent += Number(b.amount_cents || 0);
    if (b.purchased_at > byCollector[k].last) byCollector[k].last = b.purchased_at;
  });
  const topBuyers = Object.values(byCollector).sort((a, b) => b.spent - a.spent).slice(0, 8);

  const VIEWS = [['onhand', `On hand · ${onHand.length}`], ['sold', `Sold · ${soldW.length}`], ['all', 'Everything']];
  return <Shell active="artists">
    <div style={{display:'flex', gap:14, alignItems:'center', fontSize:12.5, marginBottom:14}}>
      <a href="/artists" style={{color:'#6e6e73', textDecoration:'none', fontWeight:600}}>← Artists</a>
      <a href={'/inventory?view=all&artist=' + encodeURIComponent(name)}
        style={{color:'#6e6e73', textDecoration:'none'}}>View in full inventory →</a>
    </div>
    <div style={{display:'flex', gap:10, alignItems:'baseline', flexWrap:'wrap'}}>
      <div className="h1">{name}</div>
      <span style={{fontSize:13, color:'#86868b'}}>portfolio · {perf.total_works} works all time</span>
    </div>

    <div className="stats">
      <div className="stat"><div className="n">{usd(portfolioValue)}</div>
        <div className="l">Portfolio value (retail + estimates)</div></div>
      <div className="stat"><div className="n">{Number(perf.on_hand).toLocaleString()}</div>
        <div className="l">Units on hand{unpriced ? ` · ${unpriced} unvalued` : ''}</div></div>
      <div className="stat"><div className="n">{supply === null
          ? (Number(perf.on_hand) > 0 ? 'No velocity' : '—')
          : supply <= 24 ? supply + ' mo' : (supply / 12).toFixed(supply <= 36 ? 1 : 0) + ' yr'}</div>
        <div className="l">Supply at current velocity · {perf.sold_12mo} sold last 12 mo</div></div>
      <div className="stat"><div className="n">{perf.sell_through === null ? '—' : perf.sell_through + '%'}</div>
        <div className="l">Sell-through · {perf.sold} sold all time</div></div>
    </div>
    <div className="stats">
      <div className="stat"><div className="n" style={{fontSize:19}}>{usd(perf.revenue_cents)}</div>
        <div className="l">Lifetime revenue{perf.last_sale ? ` · last sale ${ago(perf.last_sale)}` : ''}</div></div>
      <div className="stat"><div className="n" style={{fontSize:19}}>{perf.avg_sale_cents > 0 ? usd(perf.avg_sale_cents) : '—'}</div>
        <div className="l">Average sale</div></div>
      <div className="stat"><div className="n" style={{fontSize:19}}>{comps ? '$' + (Number((comps.n_recent >= 5 && comps.recent_ppsi_cents) || comps.median_ppsi_cents) / 100).toFixed(0) + '/sq in' : '—'}</div>
        <div className="l">Realized price per square inch</div></div>
      <div className="stat"><div className="n" style={{fontSize:19, color: trend === null ? undefined : trend >= 0 ? '#1d7a3d' : '#b25a00'}}>
        {trend === null ? '—' : trend >= 100 ? ((1 + trend / 100).toFixed(trend >= 400 ? 0 : 1)) + '\u00d7' : (trend >= 0 ? '+' : '\u2212') + Math.abs(trend) + '%'}</div>
        <div className="l">Price trend · last 3 years vs all time</div></div>
    </div>

    {bio?.bio && <details className="edit" style={{marginTop:14}}>
      <summary>About {name}</summary>
      <div style={{fontSize:13.5, lineHeight:1.7, whiteSpace:'pre-line', marginTop:12}}>{bio.bio}</div>
    </details>}

    <div style={{display:'flex', gap:8, marginTop:22, alignItems:'center'}}>
      {VIEWS.map(([k, label]) => <a key={k} href={'/artists/portfolio?name=' + encodeURIComponent(name) + '&v=' + k}
        className="pill" style={v === k ? {background:'#1d1d1f', color:'#fff'} : {background:'#fff', border:'1px solid #e8e8ed'}}>{label}</a>)}
    </div>
    <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(190px, 1fr))', gap:14, marginTop:16}}>
      {shown.map(a => <a key={a.id} href={'/inventory/' + a.id} className="card"
        style={{padding:10, display:'block', textDecoration:'none', color:'inherit'}}>
        <div style={{aspectRatio:'1', background:'#fafafa', borderRadius:8, overflow:'hidden',
          display:'flex', alignItems:'center', justifyContent:'center'}}>
          {a.image_url
            ? <img src={a.image_url + (a.image_url.includes('?') ? '&' : '?') + 'width=480'} alt=""
                style={{width:'100%', height:'100%', objectFit:'contain'}} loading="lazy"/>
            : <span style={{fontSize:10.5, letterSpacing:'.08em', color:'#c7c7cc'}}>NO IMAGE</span>}
        </div>
        <div style={{marginTop:9}}>
          <div style={{fontSize:12.5, fontStyle:'italic', color:'#3a3a3c', overflow:'hidden',
            textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{a.title}</div>
          <div style={{fontSize:12, marginTop:3, fontVariantNumeric:'tabular-nums', fontWeight:600}}>
            {(a.price_cents || 0) > 0 ? usd(a.price_cents)
              : a.internal_value_cents > 0 ? <>POR <span style={{color:'#86868b', fontWeight:500}}>· est {usd(a.internal_value_cents)}</span></>
              : 'POR'}
            {!a.available && <span className="pill" style={{marginLeft:7, fontSize:9.5}}>Sold</span>}
          </div>
          <div style={{fontSize:11, color:'#86868b', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
            {a.location || (a.shopify_product_id ? 'Site' : '')}</div>
        </div>
      </a>)}
      {!shown.length && <div className="empty" style={{gridColumn:'1/-1'}}>Nothing in this view.</div>}
    </div>

    {topBuyers.length > 0 && <>
      <div className="h1" style={{fontSize:18, marginTop:34}}>Who buys {name}</div>
      <div className="sub">The collectors behind the revenue — the outreach list for the next {name} drop</div>
      <div className="tblcard"><table className="tbl"><thead><tr>
        <th>Collector</th><th>Works</th><th>Spent on {name}</th><th>Last purchase</th>
      </tr></thead><tbody>
        {topBuyers.map(({ c, n, spent, last }) => <tr key={c.id}>
          <td><a style={{fontWeight:600}} href={'/collectors/' + c.id}>
            {[c.first_name, c.last_name].filter(Boolean).join(' ') || c.email}</a></td>
          <td>{n}</td>
          <td style={{fontVariantNumeric:'tabular-nums', fontWeight:650}}>{usd(spent)}</td>
          <td style={{fontSize:12.5, color:'#86868b'}}>{ago(last)}</td>
        </tr>)}
      </tbody></table></div>
    </>}
  </Shell>;
}
