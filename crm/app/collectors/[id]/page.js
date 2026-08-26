import Shell from '../../../components/Shell';
import { db } from '../../../lib/db';
export const dynamic = 'force-dynamic';

export default async function Card({ params }) {
  const { id } = await params;
  const { data: c } = await db.from('collectors').select('*').eq('id', id).single();
  if (!c) return <Shell active="collectors"><div className="empty">NOT FOUND</div></Shell>;
  const { data: inqs } = await db.from('inquiries').select('*').eq('collector_id', id).order('created_at', { ascending: false });
  const { data: acts } = await db.from('activities').select('*').eq('entity_id', id).order('created_at', { ascending: false }).limit(30);
  return <Shell active="collectors">
    <div className="h1">{c.first_name} {c.last_name}{c.trade ? ' · TRADE' : ''}</div>
    <div className="sub">{[c.email, c.phone, c.city, c.timezone].filter(Boolean).join(' · ')}</div>
    <div className="stats">
      <div className="stat"><div className="n">{inqs?.length || 0}</div><div className="l">INQUIRIES</div></div>
      <div className="stat"><div className="n" style={{fontSize:16, paddingTop:10}}>{c.budget_range || '—'}</div><div className="l">STATED RANGE</div></div>
      <div className="stat"><div className="n" style={{fontSize:16, paddingTop:10}}>{c.source || '—'}</div><div className="l">FIRST TOUCH</div></div>
      <div className="stat"><div className="n" style={{fontSize:16, paddingTop:10}}>{new Date(c.created_at).toLocaleDateString()}</div><div className="l">SINCE</div></div>
    </div>
    <div className="sub" style={{marginTop:44, color:'#000', fontWeight:600}}>INQUIRY HISTORY</div>
    <table className="tbl"><thead><tr><th>WHEN</th><th>WORK</th><th>ARTIST</th><th>STATUS</th><th>JOURNEY</th></tr></thead><tbody>
      {(inqs||[]).map(r => <tr key={r.id}>
        <td>{new Date(r.created_at).toLocaleDateString()}</td>
        <td style={{fontWeight:600}}>{r.artwork_title || r.purpose}</td>
        <td>{r.artist}</td>
        <td><span className="pill">{r.status}</span></td>
        <td style={{fontSize:9, color:'#757575', textTransform:'none'}}>{r.page_journey}</td>
      </tr>)}
    </tbody></table>
    <div className="sub" style={{marginTop:44, color:'#000', fontWeight:600}}>ADD NOTE</div>
    <form method="POST" action="/api/act" style={{marginTop:14, display:'flex', gap:14}}>
      <input type="hidden" name="action" value="note"/>
      <input type="hidden" name="id" value={c.id}/>
      <input type="hidden" name="entity_type" value="collector"/>
      <input type="hidden" name="back" value={'/collectors/' + c.id}/>
      <input name="body" placeholder="NOTE" style={{flex:1, border:0, borderBottom:'1px solid #000',
        fontFamily:'inherit', fontSize:12, padding:'8px 0', outline:'none'}}/>
      <button className="btn">SAVE</button>
    </form>
    <div className="sub" style={{marginTop:36, color:'#000', fontWeight:600}}>TIMELINE</div>
    <div className="grid-cards">
      {(acts||[]).map(a => <div key={a.id} style={{padding:'12px 0', borderBottom:'1px solid #e8e8e8',
        fontSize:10.5, letterSpacing:'.03em', textTransform:'uppercase'}}>
        <span style={{color:'#757575'}}>{new Date(a.created_at).toLocaleString()} · {a.kind} · {a.actor}</span>
        {a.body ? <span> — {a.body}</span> : null}
      </div>)}
    </div>
  </Shell>;
}
