import Shell from '../../components/Shell';
import { db } from '../../lib/db';
export const dynamic = 'force-dynamic';
const usd = (c) => '$' + (Math.round((c || 0)) / 100).toLocaleString(undefined, {minimumFractionDigits: 2});

export default async function Commissions() {
  const { data: rules } = await db.from('commission_rules').select('*').order('created_at');
  const { data: splits } = await db.from('commissions').select('*').order('created_at', { ascending: false }).limit(50);
  const totals = {};
  (splits || []).forEach(s => { totals[s.person] = (totals[s.person] || 0) + s.amount_cents; });
  const activePct = (rules || []).filter(r => r.active).reduce((s, r) => s + Number(r.pct), 0);
  return <Shell active="commissions">
    <div className="h1">Commissions</div>
    <div className="sub">The pool. Agreed once, split automatically on every settled payment.</div>
    <div className="stats">
      <div className="stat"><div className="n">{(rules||[]).filter(r=>r.active).length}</div><div className="l">People in the pool</div></div>
      <div className="stat"><div className="n">{activePct}%</div><div className="l">Total allocated</div></div>
      <div className="stat"><div className="n">{(splits||[]).length}</div><div className="l">Splits computed</div></div>
      <div className="stat"><div className="n">{usd((splits||[]).reduce((s,x)=>s+x.amount_cents,0))}</div><div className="l">Total distributed</div></div>
    </div>

    <div className="tblcard"><table className="tbl"><thead><tr>
      <th>Person</th><th>Share</th><th>Status</th><th>Running total</th><th></th>
    </tr></thead><tbody>
      {(rules||[]).map(r => <tr key={r.id}>
        <td style={{fontWeight:600}}>{r.person}</td>
        <td style={{fontVariantNumeric:'tabular-nums'}}>{r.pct}%</td>
        <td>{r.active ? <span className="pill green">Active</span> : <span className="pill">Paused</span>}</td>
        <td style={{fontVariantNumeric:'tabular-nums'}}>{usd(totals[r.person] || 0)}</td>
        <td><form method="POST" action="/api/act">
          <input type="hidden" name="action" value="rule_toggle"/>
          <input type="hidden" name="id" value={r.id}/>
          <input type="hidden" name="active" value={r.active ? '0' : '1'}/>
          <input type="hidden" name="back" value="/commissions"/>
          <button className="btn ghost mini">{r.active ? 'Pause' : 'Activate'}</button>
        </form></td>
      </tr>)}
    </tbody></table></div>

    <form method="POST" action="/api/act" className="inline-form" style={{marginTop:22}}>
      <input type="hidden" name="action" value="rule_add"/>
      <input type="hidden" name="back" value="/commissions"/>
      <input name="person" placeholder="Name (e.g. Devyn)" required/>
      <input name="pct" placeholder="Share %" type="number" step="0.1" min="0" max="100" required style={{width:110}}/>
      <button className="btn mini">Add to pool</button>
    </form>

    <div className="tblcard"><table className="tbl"><thead><tr>
      <th>When</th><th>Person</th><th>Share</th><th>Amount</th><th>Settled</th>
    </tr></thead><tbody>
      {(splits||[]).map(s => <tr key={s.id}>
        <td>{new Date(s.created_at).toLocaleDateString()}</td>
        <td style={{fontWeight:600}}>{s.person}</td>
        <td>{s.pct}%</td>
        <td style={{fontVariantNumeric:'tabular-nums'}}>{usd(s.amount_cents)}</td>
        <td>{s.settled ? <span className="pill green">Paid out</span> : <span className="pill">Accruing</span>}</td>
      </tr>)}
    </tbody></table></div>
    {!splits?.length && <div className="empty">Splits appear here automatically the moment a payment settles.</div>}
  </Shell>;
}
