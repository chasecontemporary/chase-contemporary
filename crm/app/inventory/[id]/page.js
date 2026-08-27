import Shell from '../../../components/Shell';
import { db } from '../../../lib/db';
import { listingGaps } from '../../../lib/readiness';
import DocPreview from '../../../components/DocPreview';
export const dynamic = 'force-dynamic';
const usd = (c) => '$' + Math.round((c || 0) / 100).toLocaleString();

const Row = ({ k, children }) => children ? <div className="kv2row">
  <div className="kv2k">{k}</div><div className="kv2v">{children}</div>
</div> : null;

export default async function Unit({ params, searchParams }) {
  const { id } = await params;
  const pusherr = (await searchParams)?.pusherr;
  const { data: a } = await db.from('artworks').select('*').eq('id', id).single();
  if (!a) return <Shell active="inventory"><div className="empty">Not found</div></Shell>;
  const { data: comps } = a.artist ? await db.from('artist_comps').select('*').eq('artist', a.artist).single()
    .then(r => r) : { data: null };
  const { data: astat } = a.artist ? await db.from('artist_stats').select('*').eq('artist', a.artist).single()
    .then(r => r) : { data: null };
  const area = a.dims_h_in > 0 && a.dims_w_in > 0 ? a.dims_h_in * a.dims_w_in : 0;
  const ppsi = comps ? Number((comps.n_recent >= 5 && comps.recent_ppsi_cents) || comps.median_ppsi_cents) : 0;
  const suggested = area && ppsi ? Math.round((ppsi * area) / 10000) * 100 : 0;   // dollars, nearest $100
  const [{ data: inqs }, { data: buys }, { data: appr }] = await Promise.all([
    a.handle ? db.from('inquiries').select('*, collectors(id, first_name, last_name, budget_range)')
      .eq('artwork_handle', a.handle).order('created_at', { ascending: false }) : { data: [] },
    db.from('purchases').select('*, collectors(id, first_name, last_name)').eq('artwork_id', a.id),
    db.from('holds').select('*').eq('artwork_id', a.id).eq('kind', 'approval').eq('status', 'active'),
  ]);
  const out = (appr || [])[0];
  let compRows = [];
  if (a.artist) {
    const { data: cr } = await db.from('purchases')
      .select('id, amount_cents, purchased_at, artcloud_key, source, collectors(id, first_name, last_name), artworks!inner(id, title, artist, dims_h_in, dims_w_in, medium, image_url)')
      .eq('artworks.artist', a.artist).gt('amount_cents', 50000)
      .not('artworks.dims_h_in', 'is', null).order('purchased_at', { ascending: false }).limit(400);
    const withPpsi = (cr || []).filter(r => r.artworks?.dims_h_in > 0 && r.artworks?.dims_w_in > 0)
      .map(r => ({ ...r, sqin: r.artworks.dims_h_in * r.artworks.dims_w_in,
        ppsi: r.amount_cents / (r.artworks.dims_h_in * r.artworks.dims_w_in) }));
    compRows = area
      ? withPpsi.sort((x, y) => Math.abs(x.sqin - area) - Math.abs(y.sqin - area)).slice(0, 8)
          .sort((x, y) => new Date(y.purchased_at) - new Date(x.purchased_at))
      : withPpsi.slice(0, 8);
  }
  const { data: bio } = a.artist ? await db.from('artist_bios').select('bio').eq('artist', a.artist).single()
    .then(r => r) : { data: null };
  const gaps = a.available && !a.shopify_product_id ? listingGaps(a) : [];
  const back = '/inventory/' + a.id;
  const priced = (a.price_cents || 0) > 0;

  return <Shell active="inventory">
    {pusherr && <div style={{background:'#ffefdc', color:'#b25a00', borderRadius:12, marginBottom:16,
      padding:'11px 16px', fontSize:13, fontWeight:600}}>Push blocked — still missing: {pusherr}</div>}
    <div style={{display:'grid', gridTemplateColumns:'minmax(0,460px) 1fr', gap:32, alignItems:'start'}}>

      <div style={{position:'sticky', top:24}}>
        <div className="card" style={{padding:14}}>
          {a.image_url
            ? <img src={a.image_url + (a.image_url.includes('?') ? '&' : '?') + 'width=1200'}
                alt="" style={{width:'100%', borderRadius:8, display:'block'}}/>
            : <div style={{aspectRatio:'1', display:'flex', alignItems:'center', justifyContent:'center',
                background:'#fafafa', borderRadius:8, fontSize:11, letterSpacing:'.08em', color:'#c7c7cc'}}>NO IMAGE</div>}
        </div>
      </div>

      <div style={{display:'flex', flexDirection:'column', gap:14}}>
        <div>
          <div style={{display:'flex', gap:10, alignItems:'center'}}>
            <span style={{fontSize:11.5, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase'}}>{a.artist || 'Unknown artist'}</span>
            {out ? <span className="pill" style={{background:'#ff9500', color:'#fff', fontSize:10, fontWeight:700}}>ON APPROVAL</span>
              : a.available ? <span className="pill green" style={{fontSize:10, fontWeight:700}}>AVAILABLE</span>
              : <span className="pill" style={{fontSize:10, fontWeight:700}}>SOLD</span>}
          </div>
          <div className="h1" style={{fontSize:27, marginTop:4, letterSpacing:'-.02em'}}>{a.title}</div>
          <div style={{fontSize:13, color:'#86868b', marginTop:5, overflow:'hidden',
            textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:640}}>
            {[a.medium, a.dims_h_in ? `${a.dims_h_in} × ${a.dims_w_in} in` : null].filter(Boolean).join(' · ') || 'Details incomplete'}
          </div>
        </div>

        <div className="stats" style={{gridTemplateColumns:'repeat(3,1fr)', marginTop:2}}>
          <div className="stat"><div className="n" style={{fontSize:21}}>{priced ? usd(a.price_cents)
            : a.internal_value_cents > 0 ? usd(a.internal_value_cents) : 'POR'}</div>
            <div className="l">{priced ? 'List price' : a.internal_value_cents > 0 ? 'Internal estimate' : 'Price on request'}</div></div>
          <div className="stat"><div className="n" style={{fontSize:21}}>{(inqs||[]).length}</div><div className="l">Inquiries on this work</div></div>
          <div className="stat"><div className="n" style={{fontSize:21}}>{astat?.sold > 0 ? astat.sell_through + '%' : '—'}</div>
            <div className="l">{astat?.sold > 0 ? `Artist sell-through · ${astat.sold} sold` : 'Artist sell-through'}</div></div>
        </div>

        <div className="card" style={{padding:'4px 18px'}}>
          <Row k="Medium">{a.medium}</Row>
          <Row k="Size">{a.dims_h_in ? `${a.dims_h_in} × ${a.dims_w_in} in` : null}</Row>
          <Row k="Type">{a.product_type}</Row>
          <Row k="Location">{out ? `On approval with ${out.out_to}` : (a.location || (a.shopify_product_id ? 'Site' : null))}</Row>
          <Row k="Inventory №">{a.artcloud_id && !a.artcloud_id.includes(':') ? a.artcloud_id : null}</Row>
          <Row k="Acquired">{a.acquired_at ? new Date(a.acquired_at).toLocaleDateString('en-US', { month:'long', year:'numeric' }) : null}</Row>
          <Row k="Collateral"><span style={{display:'inline-flex', gap:12, alignItems:'flex-start', flexWrap:'wrap'}}>
            {a.tearsheet_url && <DocPreview url={a.tearsheet_url} label="Tear sheet"/>}
            {a.coa_url && <DocPreview url={a.coa_url} label="Certificate of Authenticity"/>}
            <span style={{display:'inline-flex', gap:8, flexWrap:'wrap', paddingTop:a.tearsheet_url || a.coa_url ? 4 : 0}}>
              {[['tearsheet','tear sheet'],['coa','COA']].map(([kind, label]) => <form key={kind} method="POST" action="/api/act" style={{display:'inline'}}>
                <input type="hidden" name="action" value="artwork_collateral"/>
                <input type="hidden" name="id" value={a.id}/>
                <input type="hidden" name="kind" value={kind}/>
                <input type="hidden" name="back" value={back}/>
                <button className="btn mini" style={(kind === 'coa' ? a.coa_url : a.tearsheet_url)
                  ? {background:'#f0f0f2', color:'#1d1d1f'} : {}}>
                  {(kind === 'coa' ? a.coa_url : a.tearsheet_url) ? 'Re-issue ' + label : 'Generate ' + label}</button>
              </form>)}
            </span>
          </span></Row>
          <Row k="Website">{a.handle
            ? <a style={{color:'#0071e3', fontWeight:500}} href={'https://www.chasecontemporary.com/products/' + a.handle} target="_blank">On the site — view product ↗</a>
            : a.available
              ? gaps.length
                ? <span className="pill" style={{background:'#ffefdc', color:'#b25a00', fontWeight:700, fontSize:10.5}}>NOT READY · {gaps.join(' · ').toUpperCase()}</span>
                : <span style={{display:'inline-flex', gap:10, alignItems:'center', flexWrap:'wrap'}}>
                    <form method="POST" action="/api/act" style={{display:'inline'}}>
                      <input type="hidden" name="action" value="artwork_push"/>
                      <input type="hidden" name="id" value={a.id}/>
                      <input type="hidden" name="back" value={back}/>
                      <button className="btn mini">Push to site as draft</button>
                    </form>
                    <span style={{fontSize:11.5, color:'#86868b'}}>Lands unpublished · resolution checked at push</span>
                  </span>
              : <span style={{color:'#86868b'}}>Not listed</span>}</Row>
        </div>

        {(() => {
          const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
          const d = norm(a.description), m = norm(a.medium);
          const size = a.dims_h_in ? norm(`${a.dims_h_in} x ${a.dims_w_in} in`) : '';
          const residue = d.replace(m, '').replace(size, '').trim();
          const useful = a.description && residue.length > 24;
          return (useful || a.provenance) ? <div className="card">
            <div style={{fontSize:13.5, fontWeight:650, marginBottom:8}}>About this work</div>
            {useful && <div style={{fontSize:13.5, lineHeight:1.65, whiteSpace:'pre-line'}}>{a.description}</div>}
            {a.provenance && <div style={{marginTop:useful ? 12 : 0}}>
              <div style={{fontSize:11, fontWeight:600, letterSpacing:'.04em', textTransform:'uppercase', color:'#86868b', marginBottom:4}}>Provenance</div>
              <div style={{fontSize:13, lineHeight:1.6, color:'#3a3a3c', whiteSpace:'pre-line'}}>{a.provenance}</div>
            </div>}
          </div> : null;
        })()}
        {false && (a.description || a.provenance) && <div className="card">
          <div style={{fontSize:13.5, fontWeight:650, marginBottom:8}}>About this work</div>
          {a.description && <div style={{fontSize:13.5, lineHeight:1.65, whiteSpace:'pre-line'}}>{a.description}</div>}
          {a.provenance && <div style={{marginTop:a.description ? 12 : 0}}>
            <div style={{fontSize:11, fontWeight:600, letterSpacing:'.04em', textTransform:'uppercase', color:'#86868b', marginBottom:4}}>Provenance</div>
            <div style={{fontSize:13, lineHeight:1.6, color:'#3a3a3c', whiteSpace:'pre-line'}}>{a.provenance}</div>
          </div>}
        </div>}
        {bio?.bio && <details className="edit">
          <summary>About {a.artist}</summary>
          <div style={{fontSize:13.5, lineHeight:1.7, whiteSpace:'pre-line', marginTop:12, color:'#1d1d1f'}}>{bio.bio}</div>
        </details>}
        {!priced && <div className="card">
          <div style={{fontSize:13.5, fontWeight:650}}>Internal estimate</div>
          <div style={{fontSize:12, color:'#86868b', marginTop:3, marginBottom:12}}>
            What the gallery holds this work at — never shown to collectors. Range bids in the pipeline read as a percentage of this.</div>
          {suggested > 0 && <div style={{display:'flex', gap:10, alignItems:'center', flexWrap:'wrap',
            background:'#f5f5f7', borderRadius:10, padding:'10px 12px', marginBottom:12}}>
            <div style={{flex:1, minWidth:220}}>
              <div style={{fontSize:13, fontWeight:700, fontVariantNumeric:'tabular-nums'}}>{usd(suggested * 100)} suggested</div>
              <div style={{fontSize:11.5, color:'#86868b', marginTop:2}}>
                {comps.n_comps} realized {a.artist} sales · median ${(ppsi / 100).toFixed(0)}/sq in{comps.n_recent >= 5 ? ', recency-weighted' : ''}</div>
            </div>
            <form method="POST" action="/api/act">
              <input type="hidden" name="action" value="artwork_value"/>
              <input type="hidden" name="id" value={a.id}/>
              <input type="hidden" name="value" value={suggested}/>
              <input type="hidden" name="back" value={back}/>
              <button className="btn mini">Use suggestion</button>
            </form>
          </div>}
          <form method="POST" action="/api/act" className="inline-form" style={{margin:0}}>
            <input type="hidden" name="action" value="artwork_value"/>
            <input type="hidden" name="id" value={a.id}/>
            <input type="hidden" name="back" value={back}/>
            <label className="money"><span>$</span>
              <input name="value" inputMode="numeric" defaultValue={a.internal_value_cents ? (a.internal_value_cents / 100).toLocaleString() : ''} placeholder="Estimate"/>
            </label>
            <button className="btn mini">Save</button>
          </form>
        </div>}

        {a.available && <div className="card">
          <div style={{fontSize:13.5, fontWeight:650, marginBottom:out ? 10 : 3}}>{out ? 'Out on approval' : 'Send out on approval'}</div>
          {!out && <div style={{fontSize:12, color:'#86868b', marginBottom:12}}>Release the work to a client, designer, or partner with a return date.</div>}
          {out ? <div style={{display:'flex', gap:10, alignItems:'center', flexWrap:'wrap', fontSize:13.5}}>
            <span>With <b>{out.out_to}</b>{out.expires_at ? ` · due back ${new Date(out.expires_at).toLocaleDateString()}` : ''}</span>
            {['returned','converted'].map(o => <form key={o} method="POST" action="/api/act">
              <input type="hidden" name="action" value="approval_close"/>
              <input type="hidden" name="id" value={a.id}/>
              <input type="hidden" name="hold_id" value={out.id}/>
              <input type="hidden" name="outcome" value={o}/>
              <input type="hidden" name="back" value={back}/>
              <button className="btn mini">{o === 'returned' ? 'Mark returned' : 'Converted to sale'}</button>
            </form>)}
          </div> : <form method="POST" action="/api/act" className="inline-form" style={{margin:0}}>
            <input type="hidden" name="action" value="approval_out"/>
            <input type="hidden" name="id" value={a.id}/>
            <input type="hidden" name="back" value={back}/>
            <input name="out_to" placeholder="With whom" required style={{flex:1, minWidth:180}}/>
            <input name="due" type="date" style={{width:150}}/>
            <button className="btn mini">Send out</button>
          </form>}
        </div>}

        {(buys||[]).length > 0 && <div className="card">
          <div style={{fontSize:13.5, fontWeight:650, marginBottom:8}}>Sold to</div>
          {(buys||[]).map(b => <div key={b.id} style={{fontSize:13.5, padding:'4px 0'}}>
            <a style={{fontWeight:600}} href={'/collectors/' + b.collectors?.id}>{b.collectors?.first_name} {b.collectors?.last_name}</a>
            <span style={{color:'#86868b'}}> · {usd(b.amount_cents)} · {new Date(b.purchased_at).toLocaleDateString()}</span></div>)}
        </div>}

        {!a.shopify_product_id && a.available && <details className="edit">
          <summary>Edit work details{gaps.length ? ` — ${gaps.length} listing gap${gaps.length > 1 ? 's' : ''} to close` : ''}</summary>
          <form method="POST" action="/api/act" style={{marginTop:14}}>
            <input type="hidden" name="action" value="artwork_update"/>
            <input type="hidden" name="id" value={a.id}/>
            <input type="hidden" name="back" value={back}/>
            <div className="fgrid">
              <label>Title<input name="title" defaultValue={a.title || ''}/></label>
              <label>Artist<input name="artist" defaultValue={a.artist || ''}/></label>
              <label>Medium<input name="medium" defaultValue={a.medium || ''}/></label>
              <label>Height (in)<input name="h" type="number" step="0.01" defaultValue={a.dims_h_in || ''}/></label>
              <label>Width (in)<input name="w" type="number" step="0.01" defaultValue={a.dims_w_in || ''}/></label>
            </div>
            <button className="btn mini" style={{marginTop:12}}>Save details</button>
          </form>
        </details>}
      </div>
    </div>

    {comps && <>
    <div className="h1" style={{fontSize:18, marginTop:34}}>Valuation &amp; comparable sales</div>
    <div className="sub">The gallery&apos;s own realized sales of {a.artist} — every figure cites its invoice, verifiable in the sales records</div>
    <div className="stats" style={{marginTop:14}}>
      <div className="stat"><div className="n" style={{fontSize:19}}>{area
        ? usd(Number(comps.p25_ppsi_cents) * area) + ' – ' + usd(Number(comps.p75_ppsi_cents) * area)
        : usd(comps.avg_sale_cents)}</div>
        <div className="l">{area ? 'Comp range at this size (25th–75th pct)' : 'Average realized sale'}</div></div>
      <div className="stat"><div className="n" style={{fontSize:19}}>${(Number(comps.median_ppsi_cents) / 100).toFixed(0)}/sq in</div>
        <div className="l">Median realized · {comps.n_comps} sales</div></div>
      <div className="stat"><div className="n" style={{fontSize:19}}>{comps.recent_ppsi_cents && comps.n_recent >= 3
        ? (Number(comps.recent_ppsi_cents) >= Number(comps.median_ppsi_cents) ? '+' : '−') +
          Math.abs(Math.round(100 * (Number(comps.recent_ppsi_cents) - Number(comps.median_ppsi_cents)) / Number(comps.median_ppsi_cents))) + '%'
        : '—'}</div>
        <div className="l">Last-3-years vs all-time $/sq in{comps.n_recent >= 3 ? ` · ${comps.n_recent} recent` : ''}</div></div>
      <div className="stat"><div className="n" style={{fontSize:19}}>{usd(comps.total_revenue_cents)}</div>
        <div className="l">Lifetime {a.artist} revenue · last sale {comps.last_sale ? new Date(comps.last_sale).toLocaleDateString() : '—'}</div></div>
    </div>
    <div className="tblcard"><table className="tbl"><thead><tr>
      <th>Comparable work{area ? ' (nearest in size)' : ''}</th><th>Size</th><th>Sold</th><th>Price</th><th>$/sq in</th><th>Buyer</th><th>Source</th>
    </tr></thead><tbody>
      {compRows.map(r => {
        const invNo = r.artcloud_key ? r.artcloud_key.split('|')[0] : null;
        return <tr key={r.id}>
        <td><div style={{display:'flex', gap:10, alignItems:'center'}}>
          {r.artworks.image_url
            ? <img src={r.artworks.image_url + (r.artworks.image_url.includes('?') ? '&' : '?') + 'width=72'} alt=""
                style={{width:36, height:36, objectFit:'cover', borderRadius:6, flex:'0 0 auto', background:'#fafafa'}}/>
            : <span style={{width:36, height:36, borderRadius:6, background:'#f0f0f2', flex:'0 0 auto'}}/>}
          <a style={{fontWeight:600}} href={'/inventory/' + r.artworks.id}>{r.artworks.title}</a>
        </div></td>
        <td style={{color:'#86868b', fontSize:12.5}}>{r.artworks.dims_h_in} × {r.artworks.dims_w_in} in</td>
        <td style={{fontSize:12.5}}>{new Date(r.purchased_at).toLocaleDateString()}</td>
        <td style={{fontVariantNumeric:'tabular-nums', fontWeight:650}}>{usd(r.amount_cents)}</td>
        <td style={{fontVariantNumeric:'tabular-nums'}}>${(r.ppsi / 100).toFixed(0)}</td>
        <td style={{fontSize:12.5}}>{r.collectors ? <a href={'/collectors/' + r.collectors.id}>{[r.collectors.first_name, r.collectors.last_name].filter(Boolean).join(' ')}</a> : '—'}</td>
        <td style={{fontSize:12}}><span className="pill" style={{fontSize:10, fontWeight:700}}>{invNo ? 'INV ' + invNo : 'ENGINE'}</span></td>
      </tr>; })}
      {!compRows.length && <tr><td colSpan={7} style={{color:'#86868b'}}>No sized comparable sales for this artist yet.</td></tr>}
    </tbody></table></div>
    </>}

    <div className="h1" style={{fontSize:18, marginTop:34}}>Interest history</div>
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
