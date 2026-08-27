import Shell from '../../../components/Shell';
import BrandSelect from '../../../components/BrandSelect';
import OfferComposer from '../../../components/OfferComposer';
import { db } from '../../../lib/db';
import { computeTaste } from '../../../lib/taste';
export const dynamic = 'force-dynamic';
const fmtPhone = (p) => {
  const d = String(p || '').replace(/\D/g, '');
  const n = d.length === 11 && d[0] === '1' ? d.slice(1) : d;
  return n.length === 10 ? `(${n.slice(0,3)}) ${n.slice(3,6)}-${n.slice(6)}` : p;
};
const usd = (c) => '$' + Math.round((c || 0) / 100).toLocaleString();

export default async function Card({ params, searchParams }) {
  const { id } = await params;
  const dlink = (await searchParams)?.dlink;
  const { data: c } = await db.from('collectors').select('*').eq('id', id).single();
  if (!c) return <Shell active="collectors"><div className="empty">Not found</div></Shell>;
  const [{ data: inqs }, { data: acts }, { data: buys }, { data: pins }, { data: offers }] = await Promise.all([
    db.from('inquiries').select('*').eq('collector_id', id).order('created_at', { ascending: false }),
    db.from('activities').select('*').eq('entity_id', id).order('created_at', { ascending: false }).limit(30),
    db.from('purchases').select('*, artworks(image_url, handle, medium, product_type)').eq('collector_id', id).order('purchased_at', { ascending: false }),
    db.from('collector_interests').select('*').eq('collector_id', id).order('created_at'),
    db.from('offers').select('*, offer_responses(artwork_id)').eq('collector_id', id)
      .order('created_at', { ascending: false }).limit(10),
  ]);
  const taste = computeTaste(buys || [], inqs || [], pins || []);
  const purchases = buys || [];
  const lifetime = purchases.reduce((s, p) => s + (p.amount_cents || 0), 0);
  const yr = new Date().getFullYear();
  const ytd = purchases.filter(p => new Date(p.purchased_at).getFullYear() === yr)
    .reduce((s, p) => s + (p.amount_cents || 0), 0);
  const avg = purchases.length ? lifetime / purchases.length : 0;
  const last = purchases[0];
  const daysSince = last ? Math.floor((Date.now() - new Date(last.purchased_at)) / 86400000) : null;
  const first = purchases[purchases.length - 1];
  const tenureYears = first ? Math.max((Date.now() - new Date(first.purchased_at)) / 31557600000, 0.1) : 0;
  const perYear = tenureYears ? lifetime / tenureYears : 0;
  const artists = {};
  purchases.forEach(p => { if (p.artist) artists[p.artist] = (artists[p.artist] || 0) + (p.amount_cents || 0); });
  const favArtist = Object.entries(artists).sort((a, b) => b[1] - a[1])[0];
  const openInqs = (inqs || []).filter(r => !['closed','paid','nurture'].includes(r.status));
  const address = [c.address_line1, c.address_line2, [c.city, c.state, c.zip].filter(Boolean).join(' '), c.country]
    .filter(Boolean).join(', ');

  return <Shell active="collectors">
    <div className="h1">{[c.salutation, c.first_name, c.last_name].filter(Boolean).join(' ')}{c.trade ? ' · Trade' : ''}</div>
    <div className="sub">{[c.email, fmtPhone(c.phone), c.company].filter(Boolean).join(' · ')}</div>

    <div className="stats">
      <div className="stat"><div className="n">{usd(lifetime)}</div><div className="l">Lifetime spend</div></div>
      <div className="stat"><div className="n">{usd(ytd)}</div><div className="l">Spend this year</div></div>
      <div className="stat"><div className="n">{purchases.length}</div><div className="l">Works acquired</div></div>
      <div className="stat"><div className="n">{usd(avg)}</div><div className="l">Avg purchase</div></div>
    </div>
    <div className="stats">
      <div className="stat"><div className="n" style={{fontSize:17,paddingTop:6}}>{daysSince === null ? 'Never' : daysSince + ' days ago'}</div><div className="l">Last purchase</div></div>
      <div className="stat"><div className="n" style={{fontSize:17,paddingTop:6}}>{perYear ? usd(perYear) + '/yr' : '—'}</div><div className="l">Run rate</div></div>
      <div className="stat"><div className="n" style={{fontSize:17,paddingTop:6}}>{favArtist ? favArtist[0] : '—'}</div><div className="l">Top artist{favArtist ? ' · ' + usd(favArtist[1]) : ''}</div></div>
      <div className="stat"><div className="n" style={{fontSize:17,paddingTop:6}}>{openInqs.length}</div><div className="l">Open inquiries</div></div>
    </div>


    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:34}}>
      <div>
        <div className="h1" style={{fontSize:18}}>Private selections</div>
        <div className="sub" style={{marginTop:2}}>Curated works sent just to them — you see when they open it</div>
      </div>
      <OfferComposer collectorId={c.id}
        collectorName={[c.first_name, c.last_name].filter(Boolean).join(' ')}/>
    </div>
    {(offers || []).length > 0 && <div style={{background:'#fff', border:'1px solid #e3e3dd',
      borderRadius:3, boxShadow:'0 1px 2px rgba(0,0,0,.03)', marginTop:12}}>
      {(offers || []).map((o, i) => {
        const expired = o.expires_at && new Date(o.expires_at) < new Date();
        const interested = (o.offer_responses || []).length;
        return <div key={o.id} style={{display:'flex', gap:12, alignItems:'center',
          padding:'11px 16px', borderTop: i ? '1px solid #f0f0eb' : 'none', fontSize:13.5}}>
          <span style={{flex:1, minWidth:0}}>
            <b>{o.title || 'Private selection'}</b>
            <span style={{color:'#73736c'}}> · {(o.items || []).length} work{(o.items || []).length === 1 ? '' : 's'} · sent {new Date(o.created_at).toLocaleDateString()}</span>
          </span>
          {interested > 0 && <span style={{fontSize:12, fontWeight:700, color:'#2e6b3f'}}>
            interested in {interested}</span>}
          <span style={{fontSize:12, fontWeight:650,
            color: expired ? '#73736c' : o.view_count > 0 ? '#2257c5' : '#9a551a'}}>
            {expired ? 'expired' : o.view_count > 0
              ? `opened ${o.view_count}× · last ${new Date(o.last_viewed_at).toLocaleDateString()}`
              : 'not opened yet'}</span>
          <a href={'/o/' + o.token} target="_blank" style={{fontSize:12, color:'#2257c5', fontWeight:650}}>View →</a>
        </div>; })}
    </div>}

    <div className="h1" style={{fontSize:18, marginTop:34}}>Taste profile</div>
    <div className="sub">Computed live from every purchase and inquiry · pin what you learn on calls</div>
    <div style={{display:'grid', gridTemplateColumns:'1.35fr 1fr', gap:14, alignItems:'start'}}>
      <div className="tblcard" style={{margin:0}}><table className="tbl"><thead><tr>
        <th>Artist affinity</th><th>Owns</th><th>Inquired</th><th style={{width:'30%'}}></th>
      </tr></thead><tbody>
        {taste.affinity.slice(0, 8).map(t => <tr key={t.name}>
          <td style={{fontWeight:600}}>{t.name}{t.pinned ? <span className="pill blue" style={{marginLeft:8}}>Pinned</span> : null}</td>
          <td style={{fontVariantNumeric:'tabular-nums'}}>{t.owned ? t.owned + ' · ' + usd(t.spend) : '—'}</td>
          <td>{t.inquired || '—'}</td>
          <td><div className="meter"><i style={{width: Math.max(8, Math.round(100 * t.score / taste.affinity[0].score)) + '%'}}/></div></td>
        </tr>)}
        {!taste.affinity.length && <tr><td colSpan={4} style={{color:'#73736c'}}>No signals yet — the first inquiry or purchase starts the profile.</td></tr>}
      </tbody></table></div>
      <div className="tblcard" style={{margin:0}}><table className="tbl"><thead><tr>
        <th colSpan="2">Buying habits</th></tr></thead><tbody>
        <tr><td style={{width:110, color:'#73736c'}}>Sweet spot</td><td>{taste.bandList.length
          ? taste.bandList.map(([b, n], i) => <span key={b} className="pill" style={i === 0 ? {background:'#1a1a18', color:'#fff', marginRight:6} : {marginRight:6}}>{b} · {n}</span>)
          : c.budget_range ? 'Stated: ' + c.budget_range : '—'}</td></tr>
        <tr><td style={{color:'#73736c'}}>Mediums</td><td>{taste.mediumList.map(([m, n]) => `${m} (${n})`).join(' · ') || '—'}</td></tr>
        <tr><td style={{color:'#73736c'}}>Cadence</td><td>{taste.cadence
          ? <>{taste.cadence.avgGap ? (Math.round(taste.cadence.avgGap / 30) <= 1 ? 'Buys about monthly · ' : 'Buys about every ' + Math.round(taste.cadence.avgGap / 30) + ' months · ') : ''}last {Math.round(taste.cadence.daysSince)} days ago
            {taste.cadence.due ? <span className="pill" style={{background:'#b7791f', color:'#fff', marginLeft:8}}>Due for outreach</span> : null}</>
          : '—'}</td></tr>
        <tr><td style={{color:'#73736c'}}>Buys via</td><td>{taste.channelList.map(([s, n]) => `${s} (${n})`).join(' · ') || '—'}</td></tr>
        <tr><td style={{color:'#73736c'}}>Season</td><td>{taste.monthList.slice(0, 2).map(([m]) => m).join(' · ') || '—'}</td></tr>
      </tbody></table></div>
    </div>
    <div style={{display:'flex', gap:8, marginTop:12, alignItems:'center', flexWrap:'wrap'}}>
      {(pins || []).map(pin => <form key={pin.id} method="POST" action="/api/act" style={{display:'inline'}}>
        <input type="hidden" name="action" value="interest_del"/>
        <input type="hidden" name="iid" value={pin.id}/>
        <input type="hidden" name="back" value={'/collectors/' + c.id}/>
        <button className="pill" style={{border:'1px solid #e3e3dd', background:'#fff', cursor:'pointer', fontFamily:'inherit'}}
          title="Remove">{pin.label}<span style={{marginLeft:6, color:'#73736c'}}>×</span></button>
      </form>)}
      <form method="POST" action="/api/act" className="inline-form" style={{margin:0}}>
        <input type="hidden" name="action" value="interest_add"/>
        <input type="hidden" name="id" value={c.id}/>
        <input type="hidden" name="back" value={'/collectors/' + c.id}/>
        <input name="label" placeholder="Pin an interest (artist, style, subject…)" style={{width:250}}/>
        <BrandSelect name="kind" defaultValue="custom"
          options={[['custom','Interest'],['artist','Artist'],['medium','Medium'],['style','Style'],['subject','Subject']]}/>
        <button className="btn mini">Pin</button>
      </form>
    </div>

    <div className="tblcard"><table className="tbl"><thead><tr>
      <th colSpan="2">Who they are</th></tr></thead><tbody>
      <tr><td style={{width:170,color:'#73736c'}}>Address</td><td>{address || '—'}</td></tr>
      <tr><td style={{color:'#73736c'}}>Spouse / partner</td><td>{[c.spouse_first_name, c.spouse_last_name].filter(Boolean).join(' ') || '—'}</td></tr>
      <tr><td style={{color:'#73736c'}}>Locale</td><td>{[c.city, c.timezone, c.locale].filter(Boolean).join(' · ') || '—'}</td></tr>
      <tr><td style={{color:'#73736c'}}>Stated range</td><td>{c.budget_range || '—'}</td></tr>
      <tr><td style={{color:'#73736c'}}>First touch</td><td>{[c.source, 'since ' + new Date(c.created_at).toLocaleDateString()].filter(Boolean).join(' · ')}</td></tr>
      <tr><td style={{color:'#73736c'}}>Flags</td><td>{[c.trade && 'Trade', c.newsletter && 'Newsletter'].filter(Boolean).join(' · ') || '—'}</td></tr>
    </tbody></table></div>

    <div className="h1" style={{fontSize:18, marginTop:34}}>Invoice &amp; shipping details</div>
    <div className="sub">Everything an invoice needs — gathered on the details call, not the inquiry form</div>
    {(() => {
      const missing = [
        !c.address_line1 && 'billing address',
        !(c.city && c.state) && 'city / state',
        !c.phone && 'phone',
        (!c.email || c.email.endsWith('import.chasecontemporary.com')) && 'email',
      ].filter(Boolean);
      return <div style={{marginTop:8}}>{missing.length
        ? <span className="pill" style={{background:'#f3e8d5', color:'#9a551a', fontWeight:700, fontSize:11}}>MISSING FOR INVOICE: {missing.join(' · ').toUpperCase()}</span>
        : <span className="pill" style={{background:'#e4f7e9', color:'#2e6b3f', fontWeight:700, fontSize:11}}>INVOICE-READY</span>}</div>;
    })()}
    <form method="POST" action="/api/act" className="card" style={{marginTop:12, padding:16}}>
      <input type="hidden" name="action" value="collector_update"/>
      <input type="hidden" name="id" value={c.id}/>
      <input type="hidden" name="back" value={'/collectors/' + c.id}/>
      <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:8}}>
        <input name="salutation" defaultValue={c.salutation || ''} placeholder="Salutation"/>
        <input name="company" defaultValue={c.company || ''} placeholder="Company"/>
        <input name="email" defaultValue={c.email?.endsWith('import.chasecontemporary.com') ? '' : (c.email || '')} placeholder="Email" type="email"/>
        <input name="phone" defaultValue={c.phone || ''} placeholder="Phone"/>
      </div>
      <div style={{fontSize:11.5, fontWeight:650, letterSpacing:'.03em', color:'#73736c', margin:'12px 0 6px'}}>BILLING</div>
      <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8}}>
        <input name="address_line1" defaultValue={c.address_line1 || ''} placeholder="Address line 1"/>
        <input name="address_line2" defaultValue={c.address_line2 || ''} placeholder="Address line 2"/>
        <input name="city" defaultValue={c.city || ''} placeholder="City"/>
        <input name="state" defaultValue={c.state || ''} placeholder="State"/>
        <input name="zip" defaultValue={c.zip || ''} placeholder="Zip"/>
        <input name="country" defaultValue={c.country || ''} placeholder="Country"/>
      </div>
      <div style={{fontSize:11.5, fontWeight:650, letterSpacing:'.03em', color:'#73736c', margin:'12px 0 6px'}}>SHIPPING (drives sales tax + logistics; blank = same as billing)</div>
      <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8}}>
        <input name="shipping_line1" defaultValue={c.shipping_line1 || ''} placeholder="Address line 1"/>
        <input name="shipping_line2" defaultValue={c.shipping_line2 || ''} placeholder="Address line 2"/>
        <input name="shipping_city" defaultValue={c.shipping_city || ''} placeholder="City"/>
        <input name="shipping_state" defaultValue={c.shipping_state || ''} placeholder="State"/>
        <input name="shipping_zip" defaultValue={c.shipping_zip || ''} placeholder="Zip"/>
        <input name="shipping_country" defaultValue={c.shipping_country || ''} placeholder="Country"/>
      </div>
      <button className="btn mini" style={{marginTop:12}}>Save details</button>
    </form>
    <div style={{display:'flex', gap:10, alignItems:'center', marginTop:10, flexWrap:'wrap'}}>
      <form method="POST" action="/api/act">
        <input type="hidden" name="action" value="details_link"/>
        <input type="hidden" name="id" value={c.id}/>
        <input type="hidden" name="back" value={'/collectors/' + c.id}/>
        <button className="btn mini">{c.details_token ? 'Mint a fresh details link' : 'Create details link'}</button>
      </form>
      <span style={{fontSize:12, color:'#73736c'}}>
        {c.details_completed_at ? 'Collector completed their details ' + new Date(c.details_completed_at).toLocaleDateString()
          : c.details_requested_at ? 'Link created ' + new Date(c.details_requested_at).toLocaleDateString() + ' · awaiting the collector'
          : 'Send the collector a branded page to fill these in themselves'}</span>
    </div>
    {dlink && <div className="card" style={{marginTop:10, padding:'10px 14px', display:'flex', gap:10, alignItems:'center'}}>
      <span style={{fontSize:12, fontWeight:650}}>Send this to the collector:</span>
      <input readOnly defaultValue={dlink} onFocus={undefined} style={{flex:1, fontSize:12, border:'1px solid #e3e3dd',
        borderRadius:2, padding:'6px 10px', fontFamily:'inherit', color:'#2257c5'}}/>
    </div>}

    <div className="h1" style={{fontSize:18, marginTop:34}}>Collection</div>
    <div className="sub">What they own — the heart of the record</div>
    <div className="tblcard"><table className="tbl"><thead><tr>
      <th></th><th>Work</th><th>Artist</th><th>Acquired</th><th>Amount</th><th>Source</th>
    </tr></thead><tbody>
      {purchases.map(p => <tr key={p.id}>
        <td style={{width:56}}>{p.artworks?.image_url ? <img className="thumb" src={p.artworks.image_url + '&width=88'} alt=""/> : <span className="thumb"/>}</td>
        <td style={{fontWeight:600}}>{p.title}</td>
        <td>{p.artist}</td>
        <td>{new Date(p.purchased_at).toLocaleDateString()}</td>
        <td style={{fontVariantNumeric:'tabular-nums', fontWeight:600}}>{usd(p.amount_cents)}</td>
        <td><span className="pill">{p.source}</span></td>
      </tr>)}
    </tbody></table>
    {!purchases.length && <div style={{padding:'16px 18px', fontSize:13, color:'#73736c'}}>No recorded purchases yet — history arrives with the Artcloud import, or log one below.</div>}
    </div>
    <form method="POST" action="/api/act" className="inline-form" style={{marginTop:14}}>
      <input type="hidden" name="action" value="purchase_add"/>
      <input type="hidden" name="id" value={c.id}/>
      <input type="hidden" name="back" value={'/collectors/' + c.id}/>
      <input name="title" placeholder="Work title" required style={{flex:1}}/>
      <input name="artist" placeholder="Artist" style={{width:160}}/>
      <input name="amount" placeholder="Amount $" type="number" step="0.01" required style={{width:120}}/>
      <input name="date" type="date" style={{width:150}}/>
      <button className="btn mini">Log purchase</button>
    </form>

    <div className="tblcard"><table className="tbl"><thead><tr>
      <th>When</th><th>Inquired about</th><th>Artist</th><th>Status</th></tr></thead><tbody>
      {(inqs||[]).map(r => <tr key={r.id}>
        <td>{new Date(r.created_at).toLocaleDateString()}</td>
        <td style={{fontWeight:600}}>{r.artwork_title || r.purpose}</td>
        <td>{r.artist}</td>
        <td><span className="pill">{(r.status||'').replace('_',' ')}</span></td>
      </tr>)}
    </tbody></table></div>

    <form method="POST" action="/api/act" className="inline-form" style={{marginTop:18}}>
      <input type="hidden" name="action" value="note"/>
      <input type="hidden" name="id" value={c.id}/>
      <input type="hidden" name="entity_type" value="collector"/>
      <input type="hidden" name="back" value={'/collectors/' + c.id}/>
      <input name="body" placeholder="Add a note" style={{flex:1}}/>
      <button className="btn mini">Save</button>
    </form>
    <div className="tblcard"><table className="tbl"><tbody>
      {(acts||[]).map(a => <tr key={a.id}>
        <td style={{color:'#73736c', width:180}}>{new Date(a.created_at).toLocaleString()}</td>
        <td><span className="pill">{a.kind.replace(/_/g,' ')}</span></td>
        <td>{a.body}</td><td style={{color:'#73736c'}}>{a.actor}</td>
      </tr>)}
    </tbody></table></div>
  </Shell>;
}
