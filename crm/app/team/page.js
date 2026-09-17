import Shell from '../../components/Shell';
import BrandSelect from '../../components/BrandSelect';
import { db } from '../../lib/db';
import ConfirmButton from '../../components/ConfirmButton';
import { RULE_KINDS, describeRule } from '../../lib/routing';
export const dynamic = 'force-dynamic';
const usd = (c) => '$' + Math.round((c || 0) / 100).toLocaleString();
const median = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const fmtMins = (m) => m == null ? '—' : m < 60 ? Math.round(m) + 'm' : m < 1440 ? Math.floor(m / 60) + 'h ' + Math.round(m % 60) + 'm' : Math.round(m / 1440) + 'd';

// The sales force. Who has what, how fast they answer, what they close, what they lose and why.
export default async function Team({ searchParams }) {
  const sp = (await searchParams) || {};
  const days = Number(sp.days) === 90 ? 90 : 30;
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const [{ data: members }, { data: inqs }, { data: holds }, { data: invs }, { data: pays }, { data: sales }, { data: rules }] = await Promise.all([
    db.from('team_members').select('*').order('created_at'),
    db.from('inquiries').select('id, owner, status, kind, created_at, first_called_at, contacted_at, stage_changed_at, lost_reason, lost_at').eq('kind', 'buying').gte('created_at', new Date(Date.now() - 365 * 86400000).toISOString()).limit(2000),
    db.from('holds').select('placed_by, placed_at, status').eq('kind', 'reserve').gte('placed_at', since).limit(1000),
    db.from('invoices').select('id, sale_id, inquiry_id, status, sent_at, issued_at, amount_cents').gte('issued_at', since.slice(0, 10)).limit(1000),
    db.from('payments').select('invoice_id, amount_cents, settled_at').eq('status', 'settled').gte('settled_at', since).limit(2000),
    db.from('sales').select('id, owner').limit(2000),
    db.from('routing_rules').select('*').order('sort').order('created_at'),
  ]);
  const saleOwner = {}; (sales || []).forEach(s => saleOwner[s.id] = s.owner);
  const inqOwner = {}; (inqs || []).forEach(q => inqOwner[q.id] = q.owner);
  const invOwner = (i) => saleOwner[i.sale_id] || inqOwner[i.inquiry_id] || null;
  const invById = {}; (invs || []).forEach(i => invById[i.id] = i);

  const stats = {};
  const S = (n) => stats[n] = stats[n] || { open: 0, claimed: 0, resp: [], holds: 0, invoiced: 0, invoicedCents: 0, collected: 0, won: 0, lost: 0, lostReasons: {}, quiet: 0 };
  const win = (inqs || []).filter(q => q.created_at >= since);
  (inqs || []).forEach(q => { if (!q.owner) return; const s = S(q.owner);
    if (['new', 'contacted', 'in_conversation', 'hold', 'invoice'].includes(q.status)) s.open++;
    if (['contacted', 'in_conversation'].includes(q.status) && (q.stage_changed_at || q.created_at) < new Date(Date.now() - 5 * 86400000).toISOString()) s.quiet++;
  });
  win.forEach(q => { if (!q.owner) return; const s = S(q.owner);
    s.claimed++;
    const t = q.first_called_at || q.contacted_at;
    if (t) s.resp.push((new Date(t) - new Date(q.created_at)) / 60000);
    if (q.status === 'paid') s.won++;
    if (q.status === 'closed') { s.lost++; const r = (q.lost_reason || 'no reason given').toLowerCase(); s.lostReasons[r] = (s.lostReasons[r] || 0) + 1; }
  });
  (holds || []).forEach(h => { if (h.placed_by) S(h.placed_by).holds++; });
  (invs || []).forEach(i => { const o = invOwner(i); if (o && i.status !== 'void') { S(o).invoiced++; S(o).invoicedCents += Number(i.amount_cents || 0); } });
  (pays || []).forEach(p => { const i = invById[p.invoice_id]; const o = i ? invOwner(i) : null; if (o) S(o).collected += Number(p.amount_cents || 0); });
  const unclaimed = win.filter(q => !q.owner && q.status === 'new').length;

  const th = { fontSize:10.5, fontWeight:600, letterSpacing:'.07em', textTransform:'uppercase', color:'#73736c', textAlign:'right', padding:'10px 12px', whiteSpace:'nowrap' };
  const td = { padding:'11px 12px', textAlign:'right', fontVariantNumeric:'tabular-nums', fontSize:13.5 };
  return <Shell active="team">
    <div className="h1">Team</div>
    <div className="sub">The sales force. Who has what, how fast they answer, what they close.</div>
    <div style={{display:'flex', gap:8, marginTop:16, alignItems:'center'}}>
      {[30, 90].map(d => <a key={d} href={'/team?days=' + d} className="pill" style={days === d ? {background:'#1a1a18', color:'#fff'} : {background:'#fff', border:'1px solid #e3e3dd'}}>Last {d} days</a>)}
      {unclaimed > 0 && <span style={{fontSize:12.5, color:'#9a551a', fontWeight:650, marginLeft:8}}>{unclaimed} inquir{unclaimed === 1 ? 'y' : 'ies'} still unclaimed</span>}
    </div>

    <div className="tblcard" style={{marginTop:14, overflowX:'auto'}}><table className="tbl" style={{minWidth:900}}><thead><tr>
      <th>Salesperson</th><th style={th}>Open now</th><th style={th}>Claimed</th><th style={th}>First response</th><th style={th}>Holds</th>
      <th style={th}>Invoiced</th><th style={th}>Collected</th><th style={th}>Won · lost</th><th style={th}>Close rate</th><th style={{...th, textAlign:'left'}}>Why lost</th>
    </tr></thead><tbody>
      {(members || []).map(m => {
        const s = stats[m.name] || S(m.name);
        const decided = s.won + s.lost;
        const reasons = Object.entries(s.lostReasons).sort((a, b) => b[1] - a[1]).slice(0, 3);
        return <tr key={m.id} style={!m.active ? {opacity:.5} : {}}>
          <td style={{fontWeight:600, minWidth:260}}>{m.name}
            <span style={{fontSize:11.5, color:'#73736c', fontWeight:400, marginLeft:8, textTransform:'capitalize'}}>{m.role}{!m.active ? ' · inactive' : ''}</span>
            <form method="POST" action="/api/act" style={{display:'flex', gap:6, marginTop:6, alignItems:'center'}}>
              <input type="hidden" name="action" value="team_phone"/>
              <input type="hidden" name="id" value={m.id}/>
              <input type="hidden" name="back" value={'/team?days=' + days}/>
              <input name="email" defaultValue={m.email || ''} placeholder="Email (sign-in + alerts)" style={{width:200, fontSize:12, height:30, border:'1px solid #e3e3dd', borderRadius:2, padding:'0 8px', fontFamily:'inherit'}}/>
              <input name="phone" defaultValue={m.phone || ''} placeholder="Mobile (text alerts)" style={{width:140, fontSize:12, height:30, border:'1px solid #e3e3dd', borderRadius:2, padding:'0 8px', fontFamily:'inherit'}}/>
              <button className="btn mini quiet" style={{height:30}}>Save</button>
            </form>
            <div style={{display:'flex', gap:6, marginTop:6, alignItems:'center', flexWrap:'wrap'}}>
              <form method="POST" action="/api/act">
                <input type="hidden" name="action" value="team_on_duty"/>
                <input type="hidden" name="id" value={m.id}/>
                <input type="hidden" name="on_duty" value={m.on_duty === false ? '1' : '0'}/>
                <input type="hidden" name="back" value={'/team?days=' + days}/>
                <button className="btn mini quiet" style={{height:30, ...(m.on_duty === false ? {} : {background:'#1a1a18', color:'#fff', borderColor:'#1a1a18'})}}>{m.on_duty === false ? 'Off duty' : 'On duty'}</button>
              </form>
              <form method="POST" action="/api/act" style={{display:'flex', gap:6, alignItems:'center'}}>
                <input type="hidden" name="action" value="team_slack_id"/>
                <input type="hidden" name="id" value={m.id}/>
                <input type="hidden" name="back" value={'/team?days=' + days}/>
                <input name="slack_user_id" defaultValue={m.slack_user_id || ''} placeholder="Slack ID" style={{width:130, fontSize:12, height:30, border:'1px solid #e3e3dd', borderRadius:2, padding:'0 8px', fontFamily:'inherit'}}/>
                <button className="btn mini quiet" style={{height:30}}>Save</button>
              </form>
            </div>
            <div style={{fontSize:11, color:'#73736c', fontWeight:400, marginTop:4}}>Slack: profile, three dots, Copy member ID. Off duty reps are skipped by routing.</div></td>
          <td style={td}>{s.open}{s.quiet ? <span style={{display:'block', fontSize:11, color:'#9a551a'}}>{s.quiet} quiet</span> : null}</td>
          <td style={td}>{s.claimed}</td>
          <td style={{...td, color: median(s.resp) != null && median(s.resp) > 60 ? '#9a551a' : undefined}}>{fmtMins(median(s.resp))}<span style={{display:'block', fontSize:11, color:'#73736c'}}>median</span></td>
          <td style={td}>{s.holds}</td>
          <td style={td}>{s.invoiced}<span style={{display:'block', fontSize:11, color:'#73736c'}}>{s.invoicedCents ? usd(s.invoicedCents) : ''}</span></td>
          <td style={{...td, fontWeight:700, color: s.collected ? '#2e6b3f' : undefined}}>{s.collected ? usd(s.collected) : '—'}</td>
          <td style={td}>{s.won} · {s.lost}</td>
          <td style={td}>{decided ? Math.round(100 * s.won / decided) + '%' : '—'}</td>
          <td style={{padding:'11px 12px', fontSize:12, color:'#73736c'}}>{reasons.length ? reasons.map(([r, n]) => `${r} (${n})`).join(', ') : '—'}</td>
        </tr>; })}
    </tbody></table></div>
    <div style={{fontSize:12, color:'#73736c', marginTop:8}}>Claimed, first response, holds, invoiced, collected, won and lost count the window. Open now is the live board. Collected credits the salesperson who owns the sale.</div>

    <div className="h1" style={{marginTop:34, fontSize:18}}>Routing rules</div>
    <div className="sub">Checked in order when an inquiry arrives; the first match assigns it. Unmatched inquiries stay unclaimed for the floor.</div>
    <div className="tblcard" style={{marginTop:14, overflowX:'auto'}}><table className="tbl" style={{minWidth:720}}><thead><tr>
      <th style={{...th, textAlign:'left'}}>Order</th><th style={{...th, textAlign:'left'}}>Rule</th><th style={{...th, textAlign:'left'}}>When</th><th style={{...th, textAlign:'left'}}>Assign to</th><th style={{...th, textAlign:'left'}}>Active</th><th></th>
    </tr></thead><tbody>
      {!(rules || []).length && <tr><td colSpan={6} style={{padding:'14px 12px', color:'#73736c', fontSize:13}}>No rules yet. Every inquiry goes to the floor unclaimed.</td></tr>}
      {(rules || []).map(r => <tr key={r.id} style={!r.active ? {opacity:.5} : {}}>
        <td style={{fontVariantNumeric:'tabular-nums'}}>{r.sort}</td>
        <td style={{fontWeight:600}}>{r.label || describeRule(r)}</td>
        <td style={{fontSize:13}}>{describeRule(r)}</td>
        <td style={{fontSize:13}}>{r.match_kind === 'round_robin' ? 'Next on-duty rep' : r.assign_to}</td>
        <td>{r.active ? <span className="pill green">On</span> : <span className="pill">Off</span>}</td>
        <td><div style={{display:'flex', gap:6, justifyContent:'flex-end'}}>
          <form method="POST" action="/api/act">
            <input type="hidden" name="action" value="routing_rule_toggle"/>
            <input type="hidden" name="id" value={r.id}/>
            <input type="hidden" name="active" value={r.active ? '0' : '1'}/>
            <input type="hidden" name="back" value="/team"/>
            <button className="btn ghost mini">{r.active ? 'Switch off' : 'Switch on'}</button>
          </form>
          <form method="POST" action="/api/act">
            <input type="hidden" name="action" value="routing_rule_del"/>
            <input type="hidden" name="id" value={r.id}/>
            <input type="hidden" name="back" value="/team"/>
            <ConfirmButton className="btn ghost mini" message="Delete this routing rule?">Delete</ConfirmButton>
          </form>
        </div></td>
      </tr>)}
    </tbody></table></div>
    <form method="POST" action="/api/act" className="inline-form" style={{marginTop:14, flexWrap:'wrap'}}>
      <input type="hidden" name="action" value="routing_rule_add"/>
      <input type="hidden" name="back" value="/team"/>
      <input name="sort" type="number" placeholder="Order" defaultValue={((rules || []).length + 1) * 10} style={{width:80}}/>
      <input name="label" placeholder="Rule name (optional)"/>
      <BrandSelect name="match_kind" options={RULE_KINDS} defaultValue="artist"/>
      <input name="match_value" placeholder="Value: artist, source, $25k, NY, CA"/>
      <BrandSelect name="assign_to" options={[['', 'Assign to (not for round robin)'], ...(members || []).filter(m => m.active).map(m => [m.name, m.name])]} defaultValue=""/>
      <button className="btn mini">Add rule</button>
    </form>

    <div className="tblcard" style={{marginTop:22}}><table className="tbl"><thead><tr><th>Name</th><th>Status</th><th></th></tr></thead><tbody>
      {(members || []).map(m => <tr key={m.id}>
        <td style={{fontWeight:600}}>{m.name}</td>
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
