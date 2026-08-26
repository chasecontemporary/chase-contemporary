import Shell from '../../components/Shell';
import { db } from '../../lib/db';
export const dynamic = 'force-dynamic';
const usd = (c) => '$' + Math.round((c || 0) / 100).toLocaleString();

export default async function Inventory({ searchParams }) {
  const sp = (await searchParams) || {};
  const q = sp.q || '';
  const loc = sp.loc || '';
  let query = db.from('artworks').select('*')
    .order('available', { ascending: false }).order('price_cents', { ascending: false, nullsFirst: false })
    .limit(300);
  if (q) query = query.or(`title.ilike.%${q}%,artist.ilike.%${q}%,product_type.ilike.%${q}%,medium.ilike.%${q}%`);
  if (loc === 'Unassigned') query = query.or('location.is.null,location.eq.');
  else if (loc) query = query.eq('location', loc);
  const [{ data: rows }, { count: total }, { count: availableCount }, { data: valAgg }, { data: byLoc }] = await Promise.all([
    query,
    db.from('artworks').select('id', { count: 'exact', head: true }),
    db.from('artworks').select('id', { count: 'exact', head: true }).eq('available', true),
    db.from('artworks').select('price_cents.sum()').eq('available', true),
    db.from('inventory_by_location').select('*').order('value_cents', { ascending: false }),
  ]);
  const all = rows || [];
  const liveValue = valAgg?.[0]?.sum || 0;
  const locs = (byLoc || []).filter(l => l.works > 0);
  return <Shell active="inventory">
    <div className="h1">Inventory</div>
    <div className="sub">{Number(total || 0).toLocaleString()} works in the book{loc ? ` · at ${loc}` : ''}{q ? ` · "${q}"` : ''}</div>
    <div className="stats">
      <div className="stat"><div className="n">{Number(total || 0).toLocaleString()}</div><div className="l">Works in the book</div></div>
      <div className="stat"><div className="n">{Number(availableCount || 0).toLocaleString()}</div><div className="l">Available</div></div>
      <div className="stat"><div className="n">{usd(liveValue)}</div><div className="l">Live inventory value (priced retail)</div></div>
      <div className="stat"><div className="n">{locs.length}</div><div className="l">Locations</div></div>
    </div>

    <div className="h1" style={{fontSize:16, marginTop:26}}>Where the value sits</div>
    <div className="tblcard"><table className="tbl"><thead><tr>
      <th>Location</th><th>Available</th><th>Total works</th><th>Available value</th><th></th>
    </tr></thead><tbody>
      {locs.slice(0, 12).map(l => <tr key={l.location}>
        <td style={{fontWeight:600}}>{l.location}</td>
        <td>{l.available}</td>
        <td style={{color:'#86868b'}}>{l.works}</td>
        <td style={{fontVariantNumeric:'tabular-nums', fontWeight:700}}>{usd(l.value_cents)}</td>
        <td><a className="pill" style={{background:'#fff', border:'1px solid #e8e8ed'}}
          href={`/inventory?loc=${encodeURIComponent(l.location)}`}>View</a></td>
      </tr>)}
    </tbody></table></div>

    <div style={{display:'flex', gap:10, marginTop:22, alignItems:'center'}}>
      {loc && <a className="pill" style={{background:'#1d1d1f', color:'#fff'}} href="/inventory">✕ {loc}</a>}
      <form style={{flex:1}}>{loc && <input type="hidden" name="loc" value={loc}/>}
        <input className="search" style={{marginTop:0}} name="q" defaultValue={q} placeholder="Search title, artist, medium, type" /></form>
    </div>
    <div className="tblcard"><table className="tbl"><thead><tr>
      <th></th><th>Work</th><th>Artist</th><th>Location</th><th>Size</th><th>Price</th><th>Status</th>
    </tr></thead><tbody>
      {all.map(a => <tr key={a.id}>
        <td style={{width:56}}>{a.image_url ? <img className="thumb" src={a.image_url + (a.image_url.includes('?') ? '&' : '?') + 'width=88'} alt=""/> : <span className="thumb"/>}</td>
        <td style={{fontWeight:600}}><a href={'/inventory/' + a.id}>{a.title}</a></td>
        <td>{a.artist}</td>
        <td style={{fontSize:12.5, color:'#6e6e73'}}>{a.location || (a.shopify_product_id ? 'Site' : '—')}</td>
        <td style={{color:'#86868b'}}>{a.dims_h_in ? `${a.dims_h_in} × ${a.dims_w_in} in` : '—'}</td>
        <td style={{fontVariantNumeric:'tabular-nums'}}>{(a.price_cents || 0) > 0 ? usd(a.price_cents) : 'POR'}</td>
        <td>{a.available ? <span className="pill green">Available</span> : <span className="pill">Sold</span>}</td>
      </tr>)}
    </tbody></table></div>
  </Shell>;
}
