import Shell from '../../../components/Shell';
import { db } from '../../../lib/db';
import { computeTaste } from '../../../lib/taste';
export const dynamic = 'force-dynamic';
const usd = (c) => '$' + Math.round((c || 0) / 100).toLocaleString();

export default async function Card({ params }) {
  const { id } = await params;
  const { data: c } = await db.from('collectors').select('*').eq('id', id).single();
  if (!c) return <Shell active="collectors"><div className="empty">Not found</div></Shell>;
  const [{ data: inqs }, { data: acts }, { data: buys }, { data: pins }] = await Promise.all([
    db.from('inquiries').select('*').eq('collector_id', id).order('created_at', { ascending: false }),
    db.from('activities').select('*').eq('entity_id', id).order('created_at', { ascending: false }).limit(30),
    db.from('purchases').select('*, artworks(image_url, handle, medium, product_type)').eq('collector_id', id).order('purchased_at', { ascending: false }),
    db.from('collector_interests').select('*').eq('collector_id', id).order('created_at'),
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
    <div className="sub">{[c.email, c.phone, c.company].filter(Boolean).join(' · ')}</div>

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
        {!taste.affinity.length && <tr><td colSpan={4} style={{color:'#86868b'}}>No signals yet — the first inquiry or purchase starts the profile.</td></tr>}
      </tbody></table></div>
      <div className="tblcard" style={{margin:0}}><table className="tbl"><thead><tr>
        <th colSpan="2">Buying habits</th></tr></thead><tbody>
        <tr><td style={{width:110, color:'#86868b'}}>Sweet spot</td><td>{taste.bandList.length
          ? taste.bandList.map(([b, n], i) => <span key={b} className="pill" style={i === 0 ? {background:'#1d1d1f', color:'#fff', marginRight:6} : {marginRight:6}}>{b} · {n}</span>)
          : c.budget_range ? 'Stated: ' + c.budget_range : '—'}</td></tr>
        <tr><td style={{color:'#86868b'}}>Mediums</td><td>{taste.mediumList.map(([m, n]) => `${m} (${n})`).join(' · ') || '—'}</td></tr>
        <tr><td style={{color:'#86868b'}}>Cadence</td><td>{taste.cadence
          ? <>{taste.cadence.avgGap ? (Math.round(taste.cadence.avgGap / 30) <= 1 ? 'Buys about monthly · ' : 'Buys about every ' + Math.round(taste.cadence.avgGap / 30) + ' months · ') : ''}last {Math.round(taste.cadence.daysSince)} days ago
            {taste.cadence.due ? <span className="pill" style={{background:'#ff9500', color:'#fff', marginLeft:8}}>Due for outreach</span> : null}</>
          : '—'}</td></tr>
        <tr><td style={{color:'#86868b'}}>Buys via</td><td>{taste.channelList.map(([s, n]) => `${s} (${n})`).join(' · ') || '—'}</td></tr>
        <tr><td style={{color:'#86868b'}}>Season</td><td>{taste.monthList.slice(0, 2).map(([m]) => m).join(' · ') || '—'}</td></tr>
      </tbody></table></div>
    </div>
    <div style={{display:'flex', gap:8, marginTop:12, alignItems:'center', flexWrap:'wrap'}}>
      {(pins || []).map(pin => <form key={pin.id} method="POST" action="/api/act" style={{display:'inline'}}>
        <input type="hidden" name="action" value="interest_del"/>
        <input type="hidden" name="iid" value={pin.id}/>
        <input type="hidden" name="back" value={'/collectors/' + c.id}/>
        <button className="pill" style={{border:'1px solid #e8e8ed', background:'#fff', cursor:'pointer', fontFamily:'inherit'}}
          title="Remove">{pin.label}<span style={{marginLeft:6, color:'#86868b'}}>×</span></button>
      </form>)}
      <form method="POST" action="/api/act" className="inline-form" style={{margin:0}}>
        <input type="hidden" name="action" value="interest_add"/>
        <input type="hidden" name="id" value={c.id}/>
        <input type="hidden" name="back" value={'/collectors/' + c.id}/>
        <input name="label" placeholder="Pin an interest (artist, style, subject…)" style={{width:250}}/>
        <select name="kind" style={{fontFamily:'inherit', fontSize:13, border:'1px solid #e8e8ed', borderRadius:8, padding:'6px 8px', background:'#fff'}}>
          <option value="custom">Interest</option><option value="artist">Artist</option>
          <option value="medium">Medium</option><option value="style">Style</option><option value="subject">Subject</option>
        </select>
        <button className="btn mini">Pin</button>
      </form>
    </div>

    <div className="tblcard"><table className="tbl"><thead><tr>
      <th colSpan="2">Who they are</th></tr></thead><tbody>
      <tr><td style={{width:170,color:'#86868b'}}>Address</td><td>{address || '—'}</td></tr>
      <tr><td style={{color:'#86868b'}}>Spouse / partner</td><td>{[c.spouse_first_name, c.spouse_last_name].filter(Boolean).join(' ') || '—'}</td></tr>
      <tr><td style={{color:'#86868b'}}>Locale</td><td>{[c.city, c.timezone, c.locale].filter(Boolean).join(' · ') || '—'}</td></tr>
      <tr><td style={{color:'#86868b'}}>Stated range</td><td>{c.budget_range || '—'}</td></tr>
      <tr><td style={{color:'#86868b'}}>First touch</td><td>{[c.source, 'since ' + new Date(c.created_at).toLocaleDateString()].filter(Boolean).join(' · ')}</td></tr>
      <tr><td style={{color:'#86868b'}}>Flags</td><td>{[c.trade && 'Trade', c.newsletter && 'Newsletter'].filter(Boolean).join(' · ') || '—'}</td></tr>
    </tbody></table></div>

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
    {!purchases.length && <div style={{padding:'16px 18px', fontSize:13, color:'#86868b'}}>No recorded purchases yet — history arrives with the Artcloud import, or log one below.</div>}
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
        <td style={{color:'#86868b', width:180}}>{new Date(a.created_at).toLocaleString()}</td>
        <td><span className="pill">{a.kind.replace(/_/g,' ')}</span></td>
        <td>{a.body}</td><td style={{color:'#86868b'}}>{a.actor}</td>
      </tr>)}
    </tbody></table></div>
  </Shell>;
}
