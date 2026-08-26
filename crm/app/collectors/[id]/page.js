import Shell from '../../../components/Shell';
import { db } from '../../../lib/db';
export const dynamic = 'force-dynamic';

export default async function Card({ params }) {
  const { id } = await params;
  const { data: c } = await db.from('collectors').select('*').eq('id', id).single();
  if (!c) return <Shell active="collectors"><div className="empty">Not found</div></Shell>;
  const { data: inqs } = await db.from('inquiries').select('*').eq('collector_id', id).order('created_at', { ascending: false });
  const { data: acts } = await db.from('activities').select('*').eq('entity_id', id).order('created_at', { ascending: false }).limit(30);
  return <Shell active="collectors">
    <div className="h1">{c.first_name} {c.last_name}{c.trade ? ' · Trade' : ''}</div>
    <div className="sub">{[c.email, c.phone, c.city, c.timezone].filter(Boolean).join(' · ')}</div>
    <div className="stats">
      <div className="stat"><div className="n">{inqs?.length || 0}</div><div className="l">Inquiries</div></div>
      <div className="stat"><div className="n" style={{fontSize:17,paddingTop:6}}>{c.budget_range || '—'}</div><div className="l">Stated range</div></div>
      <div className="stat"><div className="n" style={{fontSize:17,paddingTop:6}}>{c.source || '—'}</div><div className="l">First touch</div></div>
      <div className="stat"><div className="n" style={{fontSize:17,paddingTop:6}}>{new Date(c.created_at).toLocaleDateString()}</div><div className="l">Since</div></div>
    </div>
    <div className="tblcard"><table className="tbl"><thead><tr>
      <th>When</th><th>Work</th><th>Artist</th><th>Status</th><th>Journey</th></tr></thead><tbody>
      {(inqs||[]).map(r => <tr key={r.id}>
        <td>{new Date(r.created_at).toLocaleDateString()}</td>
        <td style={{fontWeight:600}}>{r.artwork_title || r.purpose}</td>
        <td>{r.artist}</td>
        <td><span className="pill">{(r.status||'').replace('_',' ')}</span></td>
        <td style={{fontSize:11.5, color:'#86868b'}}>{r.page_journey}</td>
      </tr>)}
    </tbody></table></div>
    <form method="POST" action="/api/act" className="inline-form" style={{marginTop:22}}>
      <input type="hidden" name="action" value="note"/>
      <input type="hidden" name="id" value={c.id}/>
      <input type="hidden" name="entity_type" value="collector"/>
      <input type="hidden" name="back" value={'/collectors/' + c.id}/>
      <input name="body" placeholder="Add a note" style={{flex:1}}/>
      <button className="btn mini">Save</button>
    </form>
    <div className="tblcard"><table className="tbl"><tbody>
      {(acts||[]).map(a => <tr key={a.id}>
        <td style={{color:'#86868b', width:190}}>{new Date(a.created_at).toLocaleString()}</td>
        <td><span className="pill">{a.kind.replace('_',' ')}</span></td>
        <td>{a.body}</td><td style={{color:'#86868b'}}>{a.actor}</td>
      </tr>)}
    </tbody></table></div>
  </Shell>;
}
