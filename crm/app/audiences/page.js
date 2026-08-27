import Shell from '../../components/Shell';
import BrandSelect from '../../components/BrandSelect';
import { db } from '../../lib/db';
export const dynamic = 'force-dynamic';

const SEGS = [['all','Everyone'],['buyers','Buyers'],['active','Active pipeline'],['trade','Trade'],['vip','VIP list']];

export default async function Audiences() {
  const { data: auds } = await db.from('audiences').select('*').order('created_at', { ascending: false });
  const counts = await Promise.all((auds || []).map(a =>
    db.rpc('audience_count', { def: a.definition }).then(r => r.data ?? 0)));
  const { data: mailable } = await db.rpc('audience_count', { def: {} });
  const ACTIVE = '/audiences';
  return <Shell active="audiences">
    <div className="h1">Email</div>
    <div style={{display:'flex', gap:8, alignItems:'center', marginBottom:4}}>
      {[['/audiences','Audiences'],['/campaigns','Campaigns']].map(([href, label]) => <a key={href} href={href}
        className="pill" style={ACTIVE === href ? {background:'#1d1d1f', color:'#fff'} : {background:'#fff', border:'1px solid #e8e8ed'}}>{label}</a>)}
      <span style={{fontSize:12, color:'#86868b'}}>Audiences decide who · Campaigns decide what · Klaviyo delivers</span>
    </div>
    <div className="h1" style={{fontSize:18, marginTop:8}}>Audiences</div>
    <div className="sub">Saved segments of the book · every campaign sends to an audience · {Number(mailable || 0).toLocaleString()} mailable collectors total</div>

    <div className="tblcard"><table className="tbl"><thead><tr>
      <th>Audience</th><th>Definition</th><th>Members today</th><th></th>
    </tr></thead><tbody>
      {(auds || []).map((a, i) => {
        const d = a.definition || {};
        const parts = [
          SEGS.find(([k]) => k === (d.seg || 'all'))?.[1],
          d.artist ? `interested in ${d.artist}` : null,
          d.min_spend ? `lifetime ≥ $${Number(d.min_spend).toLocaleString()}` : null,
          d.q ? `matching "${d.q}"` : null,
          d.consented === false ? 'includes non-subscribed' : 'newsletter-consented',
        ].filter(Boolean).join(' · ');
        return <tr key={a.id}>
          <td style={{fontWeight:600}}>{a.name}</td>
          <td style={{fontSize:12.5, color:'#6e6e73'}}>{parts}</td>
          <td style={{fontVariantNumeric:'tabular-nums', fontWeight:700}}>{Number(counts[i]).toLocaleString()}</td>
          <td><form method="POST" action="/api/act">
            <input type="hidden" name="action" value="audience_del"/>
            <input type="hidden" name="id" value={a.id}/>
            <input type="hidden" name="back" value="/audiences"/>
            <button className="btn mini" style={{color:'#ff3b30'}}>Delete</button></form></td>
        </tr>; })}
      {!(auds || []).length && <tr><td colSpan={4} style={{color:'#86868b'}}>No audiences yet — save the first one below.</td></tr>}
    </tbody></table></div>

    <div className="h1" style={{fontSize:18, marginTop:34}}>New audience</div>
    <div className="sub">Membership is evaluated live at send time, so audiences never go stale</div>
    <form method="POST" action="/api/act" className="inline-form" style={{marginTop:10, flexWrap:'wrap'}}>
      <input type="hidden" name="action" value="audience_add"/>
      <input type="hidden" name="back" value="/audiences"/>
      <input name="name" placeholder="Name (e.g. Hambleton buyers $50k+)" required style={{minWidth:250}}/>
      <BrandSelect name="seg" options={SEGS} defaultValue="all"/>
      <input name="artist" placeholder="Interested in artist…" style={{width:180}}/>
      <input name="min_spend" placeholder="Min lifetime $" type="number" style={{width:130}}/>
      <label style={{display:'flex', alignItems:'center', gap:6, fontSize:13}}>
        <input type="checkbox" name="consented" value="true" defaultChecked/> Newsletter-consented only
      </label>
      <button className="btn mini">Save audience</button>
    </form>
  </Shell>;
}
