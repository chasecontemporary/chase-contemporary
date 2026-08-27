import Shell from '../../../components/Shell';
import { db } from '../../../lib/db';
import { listingGaps } from '../../../lib/readiness';
export const dynamic = 'force-dynamic';
const usd = (c) => '$' + Math.round((c || 0) / 100).toLocaleString();

export default async function Unit({ params, searchParams }) {
  const { id } = await params;
  const pusherr = (await searchParams)?.pusherr;
  const { data: a } = await db.from('artworks').select('*').eq('id', id).single();
  if (!a) return <Shell active="inventory"><div className="empty">Not found</div></Shell>;
  const { data: comps } = a.artist ? await db.from('artist_comps').select('*').eq('artist', a.artist).single()
    .then(r => r) : { data: null };
  const area = a.dims_h_in > 0 && a.dims_w_in > 0 ? a.dims_h_in * a.dims_w_in : 0;
  const ppsi = comps ? Number((comps.n_recent >= 5 && comps.recent_ppsi_cents) || comps.median_ppsi_cents) : 0;
  const suggested = area && ppsi ? Math.round(ppsi * area / 100) * 100 : 0;
  const [{ data: inqs }, { data: buys }, { data: appr }] = await Promise.all([
    a.handle ? db.from('inquiries').select('*, collectors(id, first_name, last_name, budget_range)')
      .eq('artwork_handle', a.handle).order('created_at', { ascending: false }) : { data: [] },
    db.from('purchases').select('*, collectors(id, first_name, last_name)').eq('artwork_id', a.id),
    db.from('holds').select('*').eq('artwork_id', a.id).eq('kind', 'approval').eq('status', 'active'),
  ]);
  const out = (appr || [])[0];
  return <Shell active="inventory">
    <div style={{display:'grid', gridTemplateColumns:'minmax(0,480px) 1fr', gap:28, alignItems:'start'}}>
      <div className="card" style={{padding:12}}>
        {a.image_url && <img src={a.image_url + (a.image_url.includes('?') ? '&' : '?') + 'width=1200'}
          alt="" style={{width:'100%', borderRadius:8}}/>}
      </div>
      <div>
        {pusherr && <div style={{gridColumn:'1/-1', background:'#ffefdc', color:'#b25a00', borderRadius:12,
      padding:'10px 14px', fontSize:13, fontWeight:600}}>Push blocked — missing: {pusherr}</div>}
    <div className="h1">{a.title}</div>
        <div className="sub">{a.artist}</div>
        <div className="stats" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
          <div className="stat"><div className="n" style={{fontSize:22}}>{(a.price_cents||0) > 0 ? usd(a.price_cents)
            : a.internal_value_cents > 0 ? usd(a.internal_value_cents) : 'POR'}</div>
            <div className="l">{(a.price_cents||0) > 0 ? 'List price' : a.internal_value_cents > 0 ? 'Internal estimate (POR)' : 'List price'}</div></div>
          <div className="stat"><div className="n" style={{fontSize:22}}>{(inqs||[]).length}</div><div className="l">Total inquiries</div></div>
          <div className="stat"><div className="n" style={{fontSize:17,paddingTop:5}}>{a.available ? 'Available' : 'Sold'}</div><div className="l">Status</div></div>
        </div>
        <div className="card" style={{marginTop:14}}>
          <dl className="kv" style={{marginTop:0}}>
            {a.medium && <><dt>Medium</dt><dd>{a.medium}</dd></>}
            {a.dims_h_in && <><dt>Size</dt><dd>{a.dims_h_in} × {a.dims_w_in} in</dd></>}
            <dt>Type</dt><dd>{a.product_type || '—'}</dd>
            <dt>Location</dt><dd>{out ? `On approval with ${out.out_to}` : (a.location || (a.shopify_product_id ? 'Site' : '—'))}</dd>
            {a.handle ? <><dt>On site</dt><dd><a style={{color:'#0071e3'}} href={'https://www.chasecontemporary.com/products/' + a.handle} target="_blank">View product page ↗</a></dd></>
              : a.available ? <><dt>On site</dt><dd>{(() => {
                const gaps = listingGaps(a);
                return gaps.length
                  ? <span className="pill" style={{background:'#ffefdc', color:'#b25a00', fontWeight:700, fontSize:10.5}}>NOT READY: {gaps.join(' · ').toUpperCase()}</span>
                  : <>
                    <form method="POST" action="/api/act" style={{display:'inline'}}>
                      <input type="hidden" name="action" value="artwork_push"/>
                      <input type="hidden" name="id" value={a.id}/>
                      <input type="hidden" name="back" value={'/inventory/' + a.id}/>
                      <button className="btn mini">Push to site (draft)</button>
                    </form>
                    <span style={{fontSize:11.5, color:'#86868b', marginLeft:8}}>Ready · image resolution checked at push · lands unpublished</span>
                  </>;
              })()}</dd></> : null}
          </dl>
        </div>
        {!a.shopify_product_id && a.available && <div className="card" style={{marginTop:14}}>
          <div style={{fontSize:13, fontWeight:650, marginBottom:8}}>Work details <span style={{fontWeight:400, color:'#86868b', fontSize:12}}>· close listing gaps here</span></div>
          <form method="POST" action="/api/act" className="inline-form" style={{margin:0, flexWrap:'wrap'}}>
            <input type="hidden" name="action" value="artwork_update"/>
            <input type="hidden" name="id" value={a.id}/>
            <input type="hidden" name="back" value={'/inventory/' + a.id}/>
            <input name="title" defaultValue={a.title || ''} placeholder="Title" style={{flex:1, minWidth:180}}/>
            <input name="artist" defaultValue={a.artist || ''} placeholder="Artist" style={{width:150}}/>
            <input name="medium" defaultValue={a.medium || ''} placeholder="Medium" style={{width:170}}/>
            <input name="h" type="number" step="0.01" defaultValue={a.dims_h_in || ''} placeholder="H in" style={{width:70}}/>
            <input name="w" type="number" step="0.01" defaultValue={a.dims_w_in || ''} placeholder="W in" style={{width:70}}/>
            <button className="btn mini">Save</button>
          </form>
        </div>}
        {!(a.price_cents > 0) && <div className="card" style={{marginTop:14}}>
          <div style={{fontSize:13, fontWeight:650, marginBottom:4}}>Internal estimate</div>
          <div style={{fontSize:12, color:'#86868b', marginBottom:8}}>What we hold this POR work at. Never shown to collectors — range bids in the pipeline read as a % of this.</div>
          {suggested > 0 && <div style={{display:'flex', gap:8, alignItems:'center', marginBottom:10, flexWrap:'wrap'}}>
            <span className="pill" style={{background:'#f0f0f2', fontSize:11, fontWeight:700}}>
              SUGGESTED {usd(suggested * 100)}</span>
            <span style={{fontSize:11.5, color:'#86868b'}}>
              from {comps.n_comps} realized sales of {a.artist} · median ${(ppsi / 100).toFixed(0)}/sq in
              {comps.n_recent >= 5 ? ' (recency-weighted)' : ''} · {a.dims_h_in} × {a.dims_w_in} in</span>
            <form method="POST" action="/api/act" style={{display:'inline'}}>
              <input type="hidden" name="action" value="artwork_value"/>
              <input type="hidden" name="id" value={a.id}/>
              <input type="hidden" name="value" value={suggested}/>
              <input type="hidden" name="back" value={'/inventory/' + a.id}/>
              <button className="btn mini">Use suggestion</button>
            </form>
          </div>}
          <form method="POST" action="/api/act" className="inline-form" style={{margin:0}}>
            <input type="hidden" name="action" value="artwork_value"/>
            <input type="hidden" name="id" value={a.id}/>
            <input type="hidden" name="back" value={'/inventory/' + a.id}/>
            <input name="value" type="number" step="0.01" defaultValue={a.internal_value_cents ? a.internal_value_cents / 100 : ''} placeholder="Estimate $" style={{width:160}}/>
            <button className="btn mini">Save</button>
          </form>
        </div>}
        {a.available && <div className="card" style={{marginTop:14}}>
          <div style={{fontSize:13, fontWeight:650, marginBottom:8}}>{out ? 'Out on approval' : 'Send out on approval'}</div>
          {out ? <div style={{display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', fontSize:13.5}}>
            <span>With <b>{out.out_to}</b>{out.expires_at ? ` · due back ${new Date(out.expires_at).toLocaleDateString()}` : ''}</span>
            {['returned','converted'].map(o => <form key={o} method="POST" action="/api/act">
              <input type="hidden" name="action" value="approval_close"/>
              <input type="hidden" name="id" value={a.id}/>
              <input type="hidden" name="hold_id" value={out.id}/>
              <input type="hidden" name="outcome" value={o}/>
              <input type="hidden" name="back" value={'/inventory/' + a.id}/>
              <button className="btn mini">{o === 'returned' ? 'Mark returned' : 'Converted to sale'}</button>
            </form>)}
          </div> : <form method="POST" action="/api/act" className="inline-form" style={{margin:0}}>
            <input type="hidden" name="action" value="approval_out"/>
            <input type="hidden" name="id" value={a.id}/>
            <input type="hidden" name="back" value={'/inventory/' + a.id}/>
            <input name="out_to" placeholder="With whom (client, designer, partner)" required style={{flex:1, minWidth:200}}/>
            <input name="due" type="date" style={{width:150}}/>
            <button className="btn mini">Send out</button>
          </form>}
        </div>}
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
