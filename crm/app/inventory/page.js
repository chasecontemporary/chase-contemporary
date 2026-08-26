import Shell from '../../components/Shell';
import { db } from '../../lib/db';
export const dynamic = 'force-dynamic';
const usd = (c) => '$' + Math.round((c || 0) / 100).toLocaleString();
const PAGE = 96;

export default async function Inventory({ searchParams }) {
  const sp = (await searchParams) || {};
  const q = sp.q || '';
  const loc = sp.loc || '';
  const view = sp.view || 'available';       // available | sold | all
  const page = Math.max(1, Number(sp.page) || 1);

  let query = db.from('artworks').select('*', { count: 'exact' });
  if (view === 'available') query = query.eq('available', true);
  if (view === 'sold') query = query.eq('available', false);
  if (q) query = query.or(`title.ilike.%${q}%,artist.ilike.%${q}%,medium.ilike.%${q}%`);
  if (loc === 'Unassigned') query = query.or('location.is.null,location.eq.');
  else if (loc) query = query.eq('location', loc);
  query = query.order('image_url', { ascending: false, nullsFirst: false })
    .order('price_cents', { ascending: false, nullsFirst: false })
    .range((page - 1) * PAGE, page * PAGE - 1);

  const [{ data: rows, count: matchCount }, { count: availableCount }, { count: soldCount }, { data: valAgg }, { data: byLoc }] = await Promise.all([
    query,
    db.from('artworks').select('id', { count: 'exact', head: true }).eq('available', true),
    db.from('artworks').select('id', { count: 'exact', head: true }).eq('available', false),
    db.from('artworks').select('price_cents.sum()').eq('available', true),
    db.from('inventory_by_location').select('*').order('value_cents', { ascending: false }),
  ]);
  const works = rows || [];
  const onHandValue = valAgg?.[0]?.sum || 0;
  const locs = (byLoc || []).filter(l => l.available > 0);
  const pages = Math.max(1, Math.ceil((matchCount || 0) / PAGE));
  const href = (over) => {
    const p = new URLSearchParams({ view, ...(q && { q }), ...(loc && { loc }), ...over });
    return '/inventory?' + p.toString();
  };
  const VIEWS = [['available', `On hand · ${Number(availableCount || 0).toLocaleString()}`],
                 ['sold', `Sold · ${Number(soldCount || 0).toLocaleString()}`],
                 ['all', 'Everything']];
  return <Shell active="inventory">
    <div className="h1">Inventory</div>
    <div className="sub">{view === 'available' ? 'What the gallery can sell right now' : view === 'sold' ? 'The sold archive' : 'The full book'}{loc ? ` · at ${loc}` : ''}{q ? ` · "${q}"` : ''}</div>
    <div className="stats">
      <div className="stat"><div className="n">{Number(availableCount || 0).toLocaleString()}</div><div className="l">Works on hand</div></div>
      <div className="stat"><div className="n">{usd(onHandValue)}</div><div className="l">On-hand value (priced retail)</div></div>
      <div className="stat"><div className="n">{locs.length}</div><div className="l">Locations holding work</div></div>
      <div className="stat"><div className="n">{Number(soldCount || 0).toLocaleString()}</div><div className="l">Sold, all time</div></div>
    </div>

    <div style={{display:'flex', gap:8, marginTop:20, alignItems:'center', flexWrap:'wrap'}}>
      {VIEWS.map(([k, label]) => <a key={k} href={href({ view: k, page: 1 })} className="pill"
        style={view === k ? {background:'#1d1d1f', color:'#fff'} : {background:'#fff', border:'1px solid #e8e8ed'}}>{label}</a>)}
      <form style={{display:'inline'}}>
        <input type="hidden" name="view" value={view}/>{q && <input type="hidden" name="q" value={q}/>}
        <select name="loc" defaultValue={loc} style={{background:'#fff', border:'1px solid #e8e8ed', borderRadius:99,
          fontFamily:'inherit', fontSize:12.5, padding:'6px 12px'}} onChange={undefined}>
          <option value="">All locations</option>
          {locs.map(l => <option key={l.location} value={l.location}>{l.location}</option>)}
        </select>
        <button className="btn mini" style={{marginLeft:6}}>Go</button>
      </form>
      <form style={{marginLeft:'auto', flex:1, maxWidth:340}}>
        <input type="hidden" name="view" value={view}/>{loc && <input type="hidden" name="loc" value={loc}/>}
        <input className="search" style={{marginTop:0}} name="q" defaultValue={q} placeholder="Search title, artist, medium" />
      </form>
    </div>

    <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:14, marginTop:18}}>
      {works.map(a => <a key={a.id} href={'/inventory/' + a.id} className="card"
        style={{padding:10, display:'block', textDecoration:'none', color:'inherit'}}>
        <div style={{aspectRatio:'1', background:'#fafafa', borderRadius:8, overflow:'hidden',
          display:'flex', alignItems:'center', justifyContent:'center'}}>
          {a.image_url
            ? <img src={a.image_url + (a.image_url.includes('?') ? '&' : '?') + 'width=480'} alt=""
                style={{width:'100%', height:'100%', objectFit:'contain'}} loading="lazy"/>
            : <span style={{fontSize:10.5, letterSpacing:'.08em', color:'#c7c7cc'}}>NO IMAGE</span>}
        </div>
        <div style={{marginTop:10, minHeight:64}}>
          <div style={{fontSize:11, fontWeight:650, letterSpacing:'.05em', textTransform:'uppercase'}}>{a.artist || 'Unknown artist'}</div>
          <div style={{fontSize:12.5, fontStyle:'italic', color:'#3a3a3c', marginTop:2, overflow:'hidden',
            display:'-webkit-box', WebkitLineClamp:1, WebkitBoxOrient:'vertical'}}>{a.title}</div>
          <div style={{fontSize:12, marginTop:4, fontVariantNumeric:'tabular-nums', fontWeight:600}}>
            {(a.price_cents || 0) > 0 ? usd(a.price_cents) : 'POR'}
            {!a.available && <span className="pill" style={{marginLeft:8}}>Sold</span>}
          </div>
          <div style={{fontSize:11, color:'#86868b', marginTop:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
            {a.location || (a.shopify_product_id ? 'Site' : '')}{a.dims_h_in ? ` · ${a.dims_h_in} × ${a.dims_w_in} in` : ''}
          </div>
        </div>
      </a>)}
      {!works.length && <div className="empty" style={{gridColumn:'1/-1'}}>Nothing matches.</div>}
    </div>
    {pages > 1 && <div style={{display:'flex', gap:8, justifyContent:'center', marginTop:22, alignItems:'center'}}>
      {page > 1 && <a className="pill" style={{background:'#fff', border:'1px solid #e8e8ed'}} href={href({ page: page - 1 })}>← Prev</a>}
      <span style={{fontSize:12.5, color:'#86868b'}}>{page} of {pages} · {Number(matchCount || 0).toLocaleString()} works</span>
      {page < pages && <a className="pill" style={{background:'#fff', border:'1px solid #e8e8ed'}} href={href({ page: page + 1 })}>Next →</a>}
    </div>}

    <div className="h1" style={{fontSize:16, marginTop:34}}>Where the value sits</div>
    <div className="tblcard"><table className="tbl"><thead><tr>
      <th>Location</th><th>On hand</th><th>On-hand value</th><th></th>
    </tr></thead><tbody>
      {locs.slice(0, 12).map(l => <tr key={l.location}>
        <td style={{fontWeight:600}}>{l.location}</td>
        <td>{l.available}</td>
        <td style={{fontVariantNumeric:'tabular-nums', fontWeight:700}}>{usd(l.value_cents)}</td>
        <td><a className="pill" style={{background:'#fff', border:'1px solid #e8e8ed'}}
          href={`/inventory?view=available&loc=${encodeURIComponent(l.location)}`}>View</a></td>
      </tr>)}
    </tbody></table></div>
  </Shell>;
}
