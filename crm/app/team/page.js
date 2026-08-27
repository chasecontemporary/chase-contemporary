import Shell from '../../components/Shell';
import BrandSelect from '../../components/BrandSelect';
import { db } from '../../lib/db';
export const dynamic = 'force-dynamic';

export default async function Team() {
  const { data: members } = await db.from('team_members').select('*').order('created_at');
  const { data: inqs } = await db.from('inquiries').select('owner, status, first_called_at, created_at');
  const stats = {};
  (inqs || []).forEach(r => {
    if (!r.owner) return;
    const s = stats[r.owner] = stats[r.owner] || { open: 0, closed: 0, calls: [] };
    if (['new','contacted','in_conversation','hold','invoice'].includes(r.status)) s.open++;
    if (r.status === 'paid') s.closed++;
    if (r.first_called_at) s.calls.push((new Date(r.first_called_at) - new Date(r.created_at)) / 60000);
  });
  const fmt = (mins) => !mins.length ? '—'
    : (() => { const m = Math.round(mins.reduce((a,b)=>a+b,0)/mins.length);
        return m < 60 ? m + 'm' : Math.round(m/60) + 'h'; })();
  return <Shell active="team">
    <div className="h1">Team</div>
    <div className="sub">The sales force. Assignment, load, and speed.</div>
    <div className="tblcard"><table className="tbl"><thead><tr>
      <th>Name</th><th>Role</th><th>Open leads</th><th>Closed</th><th>Avg speed to call</th><th>Status</th><th></th>
    </tr></thead><tbody>
      {(members||[]).map(m => <tr key={m.id}>
        <td style={{fontWeight:600}}>{m.name}<div style={{fontSize:12,color:'#73736c',fontWeight:400}}>{m.email}</div></td>
        <td style={{textTransform:'capitalize'}}>{m.role}</td>
        <td>{stats[m.name]?.open || 0}</td>
        <td>{stats[m.name]?.closed || 0}</td>
        <td>{fmt(stats[m.name]?.calls || [])}</td>
        <td>{m.active ? <span className="pill green">Active</span> : <span className="pill">Inactive</span>}</td>
        <td><form method="POST" action="/api/act">
          <input type="hidden" name="action" value="team_toggle"/>
          <input type="hidden" name="id" value={m.id}/>
          <input type="hidden" name="active" value={m.active ? '0' : '1'}/>
          <input type="hidden" name="back" value="/team"/>
          <button className="btn ghost mini">{m.active ? 'Deactivate' : 'Activate'}</button>
        </form></td>
      </tr>)}
    </tbody></table></div>
    <form method="POST" action="/api/act" className="inline-form" style={{marginTop:20}}>
      <input type="hidden" name="action" value="team_add"/>
      <input type="hidden" name="back" value="/team"/>
      <input name="name" placeholder="Name" required/>
      <input name="email" placeholder="Email" type="email"/>
      <BrandSelect name="role" options={[['rep','Rep'],['owner','Owner'],['ops','Ops']]} defaultValue="rep"/>
      <button className="btn mini">Add to team</button>
    </form>
  </Shell>;
}
