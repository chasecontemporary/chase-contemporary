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
  const allIds = [...new Set((camps || []).flatMap(x => (x.artwork_ids || []).slice(0, 3)))];
  const { data: thumbRows } = allIds.length
    ? await db.from('artworks').select('id, image_url').in('id', allIds) : { data: [] };
  const thumbOf = {}; (thumbRows || []).forEach(t => thumbOf[t.id] = t.image_url);
  const klaviyo = !!process.env.KLAVIYO_API_KEY;
  const KIND = { drop: 'Drop', newsletter: 'Newsletter', oneoff: 'One-off' };
  const ACTIVE = '/campaigns';
  return <Shell active="audiences">
    <div className="h1">Email</div>
    <div style={{display:'flex', gap:8, alignItems:'center', marginBottom:4}}>
      {[['/audiences','Audiences'],['/campaigns','Campaigns']].map(([href, label]) => <a key={href} href={href}
        className="pill" style={ACTIVE === href ? {background:'#1d1d1f', color:'#fff'} : {background:'#fff', border:'1px solid #e8e8ed'}}>{label}</a>)}
      <span style={{fontSize:12, color:'#86868b'}}>Audiences decide who · Campaigns decide what · Klaviyo delivers</span>
    </div>
    <div className="h1" style={{fontSize:18, marginTop:8}}>Campaigns</div>
    <div className="sub">Drops, releases, and letters — drafted here, designed in the site&apos;s language, sent only on explicit approval</div>

    <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:12, marginTop:14}}>
      {(camps || []).map(x => <a key={x.id} href={'/campaigns/' + x.id} className="card"
        style={{padding:14, display:'block', textDecoration:'none', color:'inherit'}}>
        <div style={{display:'flex', gap:6, marginBottom:10}}>
          {(x.artwork_ids || []).slice(0, 3).map(aid => thumbOf[aid]
            ? <img key={aid} src={thumbOf[aid] + (thumbOf[aid].includes('?') ? '&' : '?') + 'width=200'} alt=""
                style={{width:'33%', aspectRatio:'1', objectFit:'cover', borderRadius:8, background:'#fafafa'}}/>
            : <span key={aid} style={{width:'33%', aspectRatio:'1', borderRadius:8, background:'#f0f0f2'}}/>)}
          {!(x.artwork_ids || []).length && <span style={{width:'100%', aspectRatio:'3', borderRadius:8, background:'#fafafa',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:10.5, letterSpacing:'.08em', color:'#c7c7cc'}}>NEWSLETTER</span>}
        </div>
        <div style={{display:'flex', gap:8, alignItems:'center'}}>
          <span style={{fontWeight:650, fontSize:14, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{x.name}</span>
          {x.klaviyo_campaign_id ? <span className="pill green" style={{fontSize:9.5, fontWeight:700}}>IN KLAVIYO</span>
            : x.status === 'approved' ? <span className="pill" style={{background:'#e4f7e9', color:'#1d7a3d', fontSize:9.5, fontWeight:700}}>APPROVED</span>
            : <span className="pill blue" style={{fontSize:9.5, fontWeight:700}}>DRAFT</span>}
        </div>
        <div style={{fontSize:12, color:'#86868b', marginTop:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{x.subject}</div>
        <div style={{fontSize:11.5, color:'#86868b', marginTop:6}}>
          {KIND[x.kind] || x.kind} · {x.audiences?.name || 'no audience'} · {(x.artwork_ids || []).length || 'no'} works</div>
      </a>)}
      {!(camps || []).length && <div className="empty" style={{gridColumn:'1/-1'}}>No campaigns yet — draft the first drop below.</div>}
    </div>

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
