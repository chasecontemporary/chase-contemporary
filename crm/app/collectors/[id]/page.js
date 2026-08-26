import Shell from '../../../components/Shell';
import { db } from '../../../lib/db';
export const dynamic = 'force-dynamic';
const usd = (c) => '$' + Math.round((c || 0) / 100).toLocaleString();

export default async function Card({ params }) {
  const { id } = await params;
  const { data: c } = await db.from('collectors').select('*').eq('id', id).single();
  if (!c) return <Shell active="collectors"><div className="empty">Not found</div></Shell>;
  const [{ data: inqs }, { data: acts }, { data: buys }] = await Promise.all([
    db.from('inquiries').select('*').eq('collector_id', id).order('created_at', { ascending: false }),
    db.from('activities').select('*').eq('entity_id', id).order('created_at', { ascending: false }).limit(30),
    db.from('purchases').select('*, artworks(image_url, handle)').eq('collector_id', id).order('purchased_at', { ascending: false }),
  ]);
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
