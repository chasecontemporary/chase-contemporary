import Shell from '../../components/Shell';
import { db } from '../../lib/db';
import AudienceBuilder from '../../components/AudienceBuilder';
export const dynamic = 'force-dynamic';
const SEGS = { all: 'Everyone', buyers: 'Buyers', active: 'Active pipeline', trade: 'Trade', vip: 'VIP list' };
const ago = (d) => {
  const days = Math.floor((Date.now() - new Date(d)) / 86400000);
  return days < 1 ? 'today' : days < 30 ? days + 'd ago' : Math.floor(days / 30) + ' mo ago';
};

export default async function Audiences() {
  const klaviyo = !!process.env.KLAVIYO_API_KEY;
  const [{ data: auds }, { data: mailable }, { data: artistsRows }] = await Promise.all([
    db.from('audiences').select('*').order('created_at', { ascending: false }),
    db.rpc('audience_count', { def: {} }),
    db.from('artist_stats').select('artist, sold').gt('sold', 0).order('sold', { ascending: false }).limit(40),
  ]);
  const counts = await Promise.all((auds || []).map(a =>
    db.rpc('audience_count', { def: a.definition }).then(r => Number(r.data ?? 0))));
  return <Shell active="audiences">
    <div className="h1">Email</div>
    <div style={{display:'flex', gap:8, alignItems:'center', marginBottom:4}}>
      {[['/audiences','Audiences'],['/campaigns','Campaigns']].map(([href, label]) => <a key={href} href={href}
        className="pill" style={href === '/audiences' ? {background:'#1d1d1f', color:'#fff'} : {background:'#fff', border:'1px solid #e8e8ed'}}>{label}</a>)}
      <span style={{fontSize:12, color:'#86868b'}}>Audiences decide who · Campaigns decide what · Klaviyo delivers</span>
    </div>

    <div className="stats">
      <div className="stat"><div className="n">{Number(mailable || 0).toLocaleString()}</div><div className="l">Mailable collectors (consented)</div></div>
      <div className="stat"><div className="n">{(auds || []).length}</div><div className="l">Audiences built</div></div>
      <div className="stat"><div className="n">{(auds || []).filter(a => a.klaviyo_list_id).length}</div><div className="l">Synced to Klaviyo</div></div>
      <div className="stat"><div className="n" style={{fontSize:17, paddingTop:5, color: klaviyo ? '#1d7a3d' : '#b25a00'}}>{klaviyo ? 'Connected' : 'Awaiting key'}</div>
        <div className="l">Klaviyo</div></div>
    </div>

    {!klaviyo && <div className="card" style={{marginTop:16, background:'#fffdf5'}}>
      <div style={{fontSize:13.5, fontWeight:650}}>Klaviyo not connected yet</div>
      <div style={{fontSize:12.5, color:'#6e6e73', marginTop:4}}>
        Audiences work now — build and refine them here. The moment the Klaviyo API key lands, each
        audience syncs as a Klaviyo List with one click, membership refreshed before every send.</div>
    </div>}

    <AudienceBuilder artists={(artistsRows || []).map(a => a.artist)}/>

    <div style={{display:'flex', flexDirection:'column', gap:10, marginTop:16}}>
      {(auds || []).map((a, i) => {
        const d = a.definition || {};
        return <div key={a.id} className="card" style={{display:'flex', gap:14, alignItems:'center', padding:'14px 18px'}}>
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontWeight:650, fontSize:14}}>{a.name}</div>
            <div style={{display:'flex', gap:5, marginTop:6, flexWrap:'wrap'}}>
              <span className="pill" style={{background:'#f0f0f2', fontSize:10.5, fontWeight:700}}>{SEGS[d.seg || 'all']}</span>
              {d.artist && <span className="pill" style={{background:'#f0f0f2', fontSize:10.5, fontWeight:700}}>{d.artist}</span>}
              {d.min_spend && <span className="pill" style={{background:'#f0f0f2', fontSize:10.5, fontWeight:700}}>${Number(d.min_spend).toLocaleString()}+</span>}
              {d.consented !== false && <span className="pill" style={{background:'#e4f7e9', color:'#1d7a3d', fontSize:10.5, fontWeight:700}}>CONSENTED</span>}
            </div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontWeight:700, fontSize:15, fontVariantNumeric:'tabular-nums'}}>{counts[i].toLocaleString()}</div>
            <div style={{fontSize:11, color:'#86868b'}}>members today</div>
          </div>
          <div style={{textAlign:'right', minWidth:150}}>
            {a.klaviyo_list_id
              ? <><span className="pill green" style={{fontSize:10, fontWeight:700}}>IN KLAVIYO{a.synced_count ? ' · ' + Number(a.synced_count).toLocaleString() : ''}</span>
                  <div style={{fontSize:11, color:'#86868b', marginTop:3}}>synced {a.synced_at ? ago(a.synced_at) : ''}</div></>
              : <span className="pill" style={{background:'#f0f0f2', fontSize:10, fontWeight:700}}>NOT SYNCED</span>}
          </div>
          <div style={{display:'flex', gap:6, alignItems:'center'}}>
            {klaviyo
              ? <form method="POST" action="/api/act">
                  <input type="hidden" name="action" value="audience_sync"/>
                  <input type="hidden" name="id" value={a.id}/>
                  <input type="hidden" name="back" value="/audiences"/>
                  <button className="btn mini quiet">{a.klaviyo_list_id ? 'Re-sync' : 'Sync to Klaviyo'}</button>
                </form>
              : <span className="pill" style={{background:'#ffefdc', color:'#b25a00', fontSize:10, fontWeight:700}}>SYNC · AWAITING KEY</span>}
            <form method="POST" action="/api/act">
              <input type="hidden" name="action" value="audience_del"/>
              <input type="hidden" name="id" value={a.id}/>
              <input type="hidden" name="back" value="/audiences"/>
              <button style={{background:'none', border:0, color:'#b8231a', fontSize:12.5, fontWeight:600, fontFamily:'inherit', cursor:'pointer'}}>Delete</button>
            </form>
          </div>
        </div>; })}
      {!(auds || []).length && <div className="empty">No audiences yet — build the first one above. Membership is evaluated live, so audiences never go stale.</div>}
    </div>
  </Shell>;
}
