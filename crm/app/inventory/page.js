import Shell from '../../components/Shell';
import { db } from '../../lib/db';
export const dynamic = 'force-dynamic';
const usd = (c) => '$' + Math.round((c || 0) / 100).toLocaleString();

export default async function Inventory({ searchParams }) {
  const q = (await searchParams)?.q || '';
  let query = db.from('artworks').select('*').order('artist').order('title').limit(400);
  if (q) query = query.or(`title.ilike.%${q}%,artist.ilike.%${q}%,product_type.ilike.%${q}%`);
  const { data: rows } = await query;
  const all = rows || [];
  const avail = all.filter(a => a.available);
  const liveValue = avail.reduce((s, a) => s + (a.price_cents || 0), 0);
  const priced = avail.filter(a => (a.price_cents || 0) > 0);
  return <Shell active="inventory">
    <div className="h1">Inventory</div>
    <div className="sub">The book · live from the store{q ? ` · filtered: "${q}"` : ''}</div>
    <div className="stats">
      <div className="stat"><div className="n">{all.length}</div><div className="l">Works in the book</div></div>
      <div className="stat"><div className="n">{avail.length}</div><div className="l">Available</div></div>
      <div className="stat"><div className="n">{usd(liveValue)}</div><div className="l">Live inventory value (priced retail)</div></div>
      <div className="stat"><div className="n">{avail.length - priced.length}</div><div className="l">Available, price on request</div></div>
    </div>
    <form><input className="search" name="q" defaultValue={q} placeholder="Search title, artist, type" /></form>
    <div className="tblcard"><table className="tbl"><thead><tr>
      <th></th><th>Work</th><th>Artist</th><th>Type</th><th>Size</th><th>Price</th><th>Status</th>
    </tr></thead><tbody>
      {all.map(a => <tr key={a.id}>
        <td style={{width:56}}>{a.image_url ? <img className="thumb" src={a.image_url + (a.image_url.includes('?') ? '&' : '?') + 'width=88'} alt=""/> : <span className="thumb"/>}</td>
        <td style={{fontWeight:600}}>{a.title}</td>
        <td>{a.artist}</td>
        <td>{a.product_type || '—'}</td>
        <td style={{color:'#86868b'}}>{a.dims_h_in ? `${a.dims_h_in} × ${a.dims_w_in} in` : '—'}</td>
        <td style={{fontVariantNumeric:'tabular-nums'}}>{(a.price_cents || 0) > 0 ? usd(a.price_cents) : 'POR'}</td>
        <td>{a.available ? <span className="pill green">Available</span> : <span className="pill">Sold</span>}</td>
      </tr>)}
    </tbody></table></div>
    <div className="empty">Cost basis, editions, consignments, and storage locations activate with the Artcloud import.</div>
  </Shell>;
}
