import Shell from '../../../components/Shell';
import { db } from '../../../lib/db';
import { renderCampaignEmail } from '../../../lib/email';
import ConfirmButton from '../../../components/ConfirmButton';
export const dynamic = 'force-dynamic';

export default async function Campaign({ params }) {
  const { id } = await params;
  const { data: c } = await db.from('campaigns').select('*, audiences(id, name, definition)').eq('id', id).single();
  if (!c) return <Shell active="campaigns"><div className="empty">Not found</div></Shell>;
  const [{ data: works }, { data: reach }] = await Promise.all([
    (c.artwork_ids || []).length
      ? db.from('artworks').select('*').in('id', c.artwork_ids)
      : Promise.resolve({ data: [] }),
    c.audiences ? db.rpc('audience_count', { def: c.audiences.definition }) : Promise.resolve({ data: 0 }),
  ]);
  const ordered = (c.artwork_ids || []).map(aid => (works || []).find(w => w.id === aid)).filter(Boolean);
  const html = renderCampaignEmail({ campaign: c, artworks: ordered });
  return <Shell active="campaigns">
    <div className="h1">{c.name}</div>
    <div className="sub">{c.kind === 'drop' ? 'Drop / release' : c.kind === 'newsletter' ? 'Newsletter' : 'One-off'} ·
      audience: {c.audiences?.name || '—'} · reaches {Number(reach || 0).toLocaleString()} collectors today</div>

    <div className="stats" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
      <div className="stat"><div className="n" style={{fontSize:17, paddingTop:6}}>{c.status === 'approved' ? 'Approved' : c.status === 'sent' ? 'Sent' : 'Draft'}</div><div className="l">Status{c.approved_by ? ' · by ' + c.approved_by : ''}</div></div>
      <div className="stat"><div className="n">{ordered.length}</div><div className="l">Works featured</div></div>
      <div className="stat"><div className="n">{Number(reach || 0).toLocaleString()}</div><div className="l">Recipients (live count)</div></div>
    </div>

    <div style={{display:'flex', gap:8, marginTop:16}}>
      {c.status === 'draft' && <form method="POST" action="/api/act">
        <input type="hidden" name="action" value="campaign_approve"/>
        <input type="hidden" name="id" value={c.id}/>
        <input type="hidden" name="back" value={'/campaigns/' + c.id}/>
        <button className="btn">Approve this draft</button>
      </form>}
      {c.status === 'approved' && !c.klaviyo_campaign_id && (process.env.KLAVIYO_API_KEY
        ? (c.audiences?.klaviyo_list_id
          ? <form method="POST" action="/api/act">
              <input type="hidden" name="action" value="campaign_push"/>
              <input type="hidden" name="id" value={c.id}/>
              <input type="hidden" name="back" value={'/campaigns/' + c.id}/>
              <button className="btn">Push to Klaviyo</button>
            </form>
          : <span className="pill" style={{background:'#f3e8d5', color:'#9a551a', fontSize:10.5, fontWeight:700}}>SYNC THE AUDIENCE TO KLAVIYO FIRST</span>)
        : <span className="pill" style={{background:'#f3e8d5', color:'#9a551a', fontSize:10.5, fontWeight:700}}>PUSH · AWAITING KLAVIYO KEY</span>)}
      {c.klaviyo_campaign_id && <span className="pill green" style={{fontSize:10.5, fontWeight:700}}>IN KLAVIYO · SEND FROM THERE</span>}
      <form method="POST" action="/api/act">
        <input type="hidden" name="action" value="campaign_del"/>
        <input type="hidden" name="id" value={c.id}/>
        <input type="hidden" name="back" value="/campaigns"/>
        <ConfirmButton className="btn mini" style={{color:'#c02d23'}}
          message={`Delete the campaign "${c.name}"? This cannot be undone.`}>Delete</ConfirmButton>
      </form>
    </div>
    <div style={{fontSize:12.5, color:'#73736c', marginTop:10}}>
      Approval marks the draft ready. Push then creates the campaign in Klaviyo — brand template, synced audience —
      and the actual send is scheduled inside Klaviyo, always a human decision.
    </div>

    <div className="h1" style={{fontSize:18, marginTop:30}}>Email preview</div>
    <div className="sub">Exactly what lands in the inbox — the website&apos;s design language, email-safe</div>
    <div className="card" style={{padding:0, marginTop:12, overflow:'hidden'}}>
      <iframe srcDoc={html} title="preview" style={{width:'100%', height:760, border:0, background:'#fff'}}/>
    </div>
  </Shell>;
}
