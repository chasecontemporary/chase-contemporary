import Shell from '../../components/Shell';
import BrandSelect from '../../components/BrandSelect';
import { db } from '../../lib/db';
export const dynamic = 'force-dynamic';

export default async function Campaigns() {
  const [{ data: camps }, { data: auds }, { data: works }] = await Promise.all([
    db.from('campaigns').select('*, audiences(name)').order('created_at', { ascending: false }),
    db.from('audiences').select('id, name').order('name'),
    db.from('artworks').select('id, title, artist, price_cents, image_url')
      .eq('available', true).not('image_url', 'is', null).not('handle', 'is', null)
      .order('created_at', { ascending: false }).limit(24),
  ]);
  const KIND = { drop: 'Drop', newsletter: 'Newsletter', oneoff: 'One-off' };
  return <Shell active="campaigns">
    <div className="h1">Campaigns</div>
    <div className="sub">Drops, releases, and letters — drafted here, designed in the site&apos;s language, sent only on explicit approval</div>

    <div className="tblcard"><table className="tbl"><thead><tr>
      <th>Campaign</th><th>Kind</th><th>Audience</th><th>Works</th><th>Status</th><th>Created</th>
    </tr></thead><tbody>
      {(camps || []).map(c => <tr key={c.id}>
        <td><a href={'/campaigns/' + c.id} style={{fontWeight:600}}>{c.name}</a>
          <div style={{fontSize:12, color:'#86868b'}}>{c.subject}</div></td>
        <td><span className="pill">{KIND[c.kind] || c.kind}</span></td>
        <td style={{fontSize:12.5}}>{c.audiences?.name || '—'}</td>
        <td>{(c.artwork_ids || []).length || '—'}</td>
        <td>{c.status === 'approved' ? <span className="pill green">Approved</span>
          : c.status === 'sent' ? <span className="pill green">Sent</span>
          : <span className="pill blue">Draft</span>}</td>
        <td style={{fontSize:12.5, color:'#86868b'}}>{new Date(c.created_at).toLocaleDateString()}</td>
      </tr>)}
      {!(camps || []).length && <tr><td colSpan={6} style={{color:'#86868b'}}>No campaigns yet — draft the first drop below.</td></tr>}
    </tbody></table></div>

    <div className="h1" style={{fontSize:18, marginTop:34}}>Draft a campaign</div>
    <div className="sub">Pick the works, write the story, choose the audience — preview renders in the website&apos;s design</div>
    <form method="POST" action="/api/act" style={{marginTop:12}}>
      <input type="hidden" name="action" value="campaign_add"/>
      <input type="hidden" name="back" value="/campaigns"/>
      <div className="inline-form" style={{flexWrap:'wrap'}}>
        <input name="name" placeholder="Internal name (e.g. Pelé Drop 09/26)" required style={{minWidth:230}}/>
        <BrandSelect name="kind" defaultValue="drop"
          options={[['drop','Drop / release'],['newsletter','Newsletter'],['oneoff','One-off']]}/>
        <BrandSelect name="audience_id" placeholder="Audience…"
          options={(auds || []).map(a => [a.id, a.name])}/>
      </div>
      <div className="inline-form" style={{marginTop:10, flexWrap:'wrap'}}>
        <input name="subject" placeholder="Subject line" required style={{flex:1, minWidth:280}}/>
        <input name="preheader" placeholder="Preheader (inbox preview text)" style={{flex:1, minWidth:280}}/>
      </div>
      <textarea name="body" placeholder="The story. Short paragraphs. This renders in the chunky editorial style above the works." rows={4}
        style={{width:'100%', marginTop:10, background:'#fff', border:'1px solid #e8e8ed', borderRadius:10, fontFamily:'inherit', fontSize:13.5, padding:'10px 12px', resize:'vertical'}}/>
      <div style={{fontSize:13, fontWeight:650, margin:'16px 0 8px'}}>Works in this campaign</div>
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(130px, 1fr))', gap:10}}>
        {(works || []).map(w => <label key={w.id} className="card" style={{padding:8, cursor:'pointer', display:'block'}}>
          <input type="checkbox" name="artwork_ids" value={w.id} style={{marginBottom:6}}/>
          {w.image_url && <img src={w.image_url + (w.image_url.includes('?') ? '&' : '?') + 'width=300'} alt=""
            style={{width:'100%', aspectRatio:'1', objectFit:'cover', borderRadius:6}}/>}
          <div style={{fontSize:11.5, fontWeight:600, marginTop:6, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{w.title}</div>
          <div style={{fontSize:11, color:'#86868b'}}>{w.artist}</div>
        </label>)}
      </div>
      <button className="btn" style={{marginTop:16}}>Save draft</button>
    </form>
  </Shell>;
}
