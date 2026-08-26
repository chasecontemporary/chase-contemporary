import Shell from '../../../components/Shell';
import { db } from '../../../lib/db';
export const dynamic = 'force-dynamic';
const usd = (c) => '$' + Math.round((c || 0) / 100).toLocaleString();

export default async function Unit({ params }) {
  const { id } = await params;
  const { data: a } = await db.from('artworks').select('*').eq('id', id).single();
  if (!a) return <Shell active="inventory"><div className="empty">Not found</div></Shell>;
  const [{ data: inqs }, { data: buys }] = await Promise.all([
    a.handle ? db.from('inquiries').select('*, collectors(id, first_name, last_name, budget_range)')
      .eq('artwork_handle', a.handle).order('created_at', { ascending: false }) : { data: [] },
    db.from('purchases').select('*, collectors(id, first_name, last_name)').eq('artwork_id', a.id),
  ]);
  return <Shell active="inventory">
    <div style={{display:'grid', gridTemplateColumns:'minmax(0,480px) 1fr', gap:28, alignItems:'start'}}>
      <div className="card" style={{padding:12}}>
        {a.image_url && <img src={a.image_url + (a.image_url.includes('?') ? '&' : '?') + 'width=1200'}
          alt="" style={{width:'100%', borderRadius:8}}/>}
      </div>
      <div>
        <div className="h1">{a.title}</div>
        <div className="sub">{a.artist}</div>
        <div className="stats" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
          <div className="stat"><div className="n" style={{fontSize:22}}>{(a.price_cents||0) > 0 ? usd(a.price_cents) : 'POR'}</div><div className="l">List price</div></div>
          <div className="stat"><div className="n" style={{fontSize:22}}>{(inqs||[]).length}</div><div className="l">Total inquiries</div></div>
          <div className="stat"><div className="n" style={{fontSize:17,paddingTop:5}}>{a.available ? 'Available' : 'Sold'}</div><div className="l">Status</div></div>
        </div>
        <div className="card" style={{marginTop:14}}>
          <dl className="kv" style={{marginTop:0}}>
            {a.medium && <><dt>Medium</dt><dd>{a.medium}</dd></>}
            {a.dims_h_in && <><dt>Size</dt><dd>{a.dims_h_in} × {a.dims_w_in} in</dd></>}
            <dt>Type</dt><dd>{a.product_type || '—'}</dd>
            {a.handle && <><dt>On site</dt><dd><a style={{color:'#0071e3'}} href={'https://www.chasecontemporary.com/products/' + a.handle} target="_blank">View product page ↗</a></dd></>}
          </dl>
        </div>
        {(buys||[]).length > 0 && <div className="card" style={{marginTop:14}}>
          <div style={{fontSize:13, fontWeight:650, marginBottom:6}}>Sold to</div>
          {(buys||[]).map(b => <div key={b.id} style={{fontSize:13.5}}>
            <a style={{fontWeight:600}} href={'/collectors/' + b.collectors?.id}>{b.collectors?.first_name} {b.collectors?.last_name}</a>
            {' · '}{usd(b.amount_cents)} · {new Date(b.purchased_at).toLocaleDateString()}</div>)}
        </div>}
      </div>
    </div>
    <div className="h1" style={{fontSize:18, marginTop:30}}>Interest history</div>
    <div className="sub">Every inquiry on this work — the demand signal</div>
    <div className="tblcard"><table className="tbl"><thead><tr>
      <th>When</th><th>Collector</th><th>Budget</th><th>Status</th><th>Owner</th></tr></thead><tbody>
      {(inqs||[]).map(r => <tr key={r.id}>
        <td>{new Date(r.created_at).toLocaleDateString()}</td>
        <td><a style={{fontWeight:600}} href={'/collectors/' + r.collector_id}>{r.collectors?.first_name} {r.collectors?.last_name}</a></td>
        <td>{r.budget_range || r.collectors?.budget_range || '—'}</td>
        <td><span className="pill">{(r.status||'').replace('_',' ')}</span></td>
        <td>{r.owner || '—'}</td>
      </tr>)}
    </tbody></table>
    {!(inqs||[]).length && <div style={{padding:'14px 18px', fontSize:13, color:'#86868b'}}>No inquiries yet on this work.</div>}
    </div>
  </Shell>;
}
