import Shell from '../../components/Shell';
import { db } from '../../lib/db';
export const dynamic = 'force-dynamic';
const usd = (c) => '$' + Math.round((c || 0) / 100).toLocaleString();
const monthName = (d) => new Date(d + (String(d).length === 7 ? '-02' : '')).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

export default async function Commissions() {
  const [{ data: rules }, { data: rows }, { data: invMap }] = await Promise.all([
    db.from('commission_rules').select('*').order('person'),
    db.from('commissions').select('*').order('created_at', { ascending: false }).limit(500),
    db.from('invoices').select('id, invoice_number, title, collectors(first_name, last_name)').limit(300),
  ]);
  const inv = {}; (invMap || []).forEach(i => inv[i.id] = i);
  const all = rows || [];
  const now = new Date();
  const thisPeriod = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  // payable = any period before the current month, unpaid
  const accruing = all.filter(r => r.period === thisPeriod && !r.paid_at);
  const payable = all.filter(r => r.period && r.period < thisPeriod && !r.paid_at);
  const paidYtd = all.filter(r => r.paid_at && new Date(r.paid_at).getFullYear() === now.getFullYear());
  const sum = (list) => list.reduce((s, r) => s + Number(r.amount_cents || 0), 0);
  const nextPayout = new Date(now.getFullYear(), now.getMonth(), 8);
  if (now.getDate() >= 8) nextPayout.setMonth(nextPayout.getMonth() + 1);
  const payoutDateStr = nextPayout.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  // group by person, then by period
  const people = {};
  all.forEach(r => {
    const p = people[r.person] = people[r.person] || { rows: [], accruing: 0, payable: 0, paidYtd: 0 };
    p.rows.push(r);
    if (r.period === thisPeriod && !r.paid_at) p.accruing += Number(r.amount_cents);
    else if (r.period && r.period < thisPeriod && !r.paid_at) p.payable += Number(r.amount_cents);
    if (r.paid_at && new Date(r.paid_at).getFullYear() === now.getFullYear()) p.paidYtd += Number(r.amount_cents);
  });
  (rules || []).forEach(r => { people[r.person] = people[r.person] || { rows: [], accruing: 0, payable: 0, paidYtd: 0 }; });
  const ruleFor = (name) => (rules || []).find(r => r.person === name);

  return <Shell active="commissions">
    <div className="h1">Commissions</div>
    <div className="sub">Each salesperson earns their rate on the money they collect — computed the moment cash lands, paid on the 8th for the month before</div>

    <div className="stats">
      <div className="stat"><div className="n">{usd(sum(accruing))}</div>
        <div className="l">Earning in {monthName(thisPeriod.slice(0, 7))}</div></div>
      <div className="stat"><div className="n">{usd(sum(payable))}</div>
        <div className="l">Payable {payoutDateStr}{payable.length ? ` · for ${monthName(lastMonth.toISOString().slice(0, 7))}` : ''}</div></div>
      <div className="stat"><div className="n">{usd(sum(paidYtd))}</div>
        <div className="l">Paid out in {now.getFullYear()}</div></div>
      <div className="stat"><div className="n">{(rules || []).filter(r => r.active).length}</div>
        <div className="l">Salespeople with a rate set</div></div>
    </div>

    <div className="card" style={{marginTop:16}}>
      <div className="cardtitle">How it works</div>
      <div style={{fontSize:13, color:'#3a3a3c', lineHeight:1.7}}>
        A salesperson's commission is their rate times the payments that actually arrive on their sales
        — collected cash, never invoiced promises. Each month closes on its last day, and everything
        earned that month is paid out on the 8th of the next. Nothing is calculated by hand.</div>
    </div>

    {(rules || []).length === 0 && <div className="card" style={{marginTop:16, background:'#fffdf5'}}>
      <div style={{fontSize:13.5, fontWeight:650}}>No rates set yet</div>
      <div style={{fontSize:12.5, color:'#6e6e73', marginTop:4}}>
        Set each salesperson's rate below (Bernie's call on the percentages). From that moment, every
        payment that lands on their sales earns automatically — nothing retroactive, nothing manual.</div>
    </div>}

    <div style={{display:'flex', flexDirection:'column', gap:10, marginTop:16}}>
      {Object.entries(people).sort((a, b) => (b[1].payable + b[1].accruing) - (a[1].payable + a[1].accruing)).map(([name, p]) => {
        const rule = ruleFor(name);
        const periods = {};
        p.rows.forEach(r => { const k = r.period || 'unknown'; (periods[k] = periods[k] || []).push(r); });
        return <details key={name} className="edit" style={{padding:0, overflow:'hidden'}}>
          <summary style={{padding:'13px 18px', display:'grid',
            gridTemplateColumns:'14px minmax(140px,1fr) 110px 130px 130px 130px', gap:12, alignItems:'center'}}>
            <span style={{minWidth:0}}>
              <span style={{fontWeight:650, fontSize:14}}>{name}</span>
              {rule && !rule.active && <span className="pill" style={{marginLeft:8, fontSize:10}}>PAUSED</span>}
            </span>
            <span>{rule ? <span className="pill" style={{background:'#f0f0f2', fontWeight:700, fontSize:10.5,
              display:'inline-flex', height:24, alignItems:'center'}}>{rule.pct}% RATE</span>
              : <span style={{fontSize:12, color:'#b25a00', fontWeight:600}}>no rate set</span>}</span>
            <span style={{textAlign:'right'}}>
              <span style={{fontVariantNumeric:'tabular-nums', fontWeight:600}}>{p.accruing ? usd(p.accruing) : '—'}</span>
              <span style={{display:'block', fontSize:11, color:'#86868b'}}>earning now</span></span>
            <span style={{textAlign:'right'}}>
              <span style={{fontVariantNumeric:'tabular-nums', fontWeight:700, color: p.payable ? '#b25a00' : undefined}}>{p.payable ? usd(p.payable) : '—'}</span>
              <span style={{display:'block', fontSize:11, color:'#86868b'}}>payable {payoutDateStr}</span></span>
            <span style={{textAlign:'right'}}>
              <span style={{fontVariantNumeric:'tabular-nums', fontWeight:600}}>{p.paidYtd ? usd(p.paidYtd) : '—'}</span>
              <span style={{display:'block', fontSize:11, color:'#86868b'}}>paid {now.getFullYear()}</span></span>
          </summary>
          <div style={{padding:'4px 18px 16px', borderTop:'1px solid #f0f0f2'}}>
            {Object.entries(periods).sort((a, b) => b[0].localeCompare(a[0])).map(([period, rs]) => {
              const unpaid = rs.filter(r => !r.paid_at);
              const closed = period < thisPeriod;
              return <div key={period} style={{marginTop:12}}>
                <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:6}}>
                  <span className="cardtitle" style={{marginBottom:0}}>{monthName(period.slice(0, 7))}</span>
                  <span style={{fontSize:12.5, fontWeight:700, fontVariantNumeric:'tabular-nums'}}>{usd(sum(rs))}</span>
                  {unpaid.length === 0 ? <span className="pill green" style={{fontSize:10, fontWeight:700}}>PAID OUT</span>
                    : closed ? <form method="POST" action="/api/act" style={{marginLeft:'auto'}}>
                        <input type="hidden" name="action" value="payout_complete"/>
                        <input type="hidden" name="person" value={name}/>
                        <input type="hidden" name="period" value={period}/>
                        <input type="hidden" name="back" value="/commissions"/>
                        <button className="btn mini">Mark paid out · {usd(sum(unpaid))}</button>
                      </form>
                    : <span style={{fontSize:11.5, color:'#86868b'}}>month still open</span>}
                </div>
                {rs.map(r => {
                  const i = inv[r.invoice_id];
                  return <div key={r.id} style={{display:'flex', gap:12, alignItems:'center', padding:'6px 0',
                    borderBottom:'1px solid #f5f5f7', fontSize:12.5}}>
                    <span style={{color:'#86868b', width:78}}>{new Date(r.created_at).toLocaleDateString()}</span>
                    <span style={{flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                      {i ? <>№{String(i.invoice_number).padStart(4,'0')} · {i.collectors ? [i.collectors.first_name, i.collectors.last_name].filter(Boolean).join(' ') : ''} <span style={{color:'#86868b'}}>· {i.title}</span></> : 'Payment'}</span>
                    <span style={{color:'#86868b'}}>{Number(r.pct) > 0 ? r.pct + '%' : <span className="pill" style={{background:'#ffefdc', color:'#b25a00', fontSize:9.5, fontWeight:700}}>RATE PENDING</span>}</span>
                    <span style={{fontWeight:700, fontVariantNumeric:'tabular-nums', color: Number(r.amount_cents) > 0 ? '#1d7a3d' : '#c7c7cc'}}>+{usd(r.amount_cents)}</span>
                  </div>; })}
              </div>; })}
            {!p.rows.length && <div style={{fontSize:12.5, color:'#86868b', marginTop:10}}>
              Nothing earned yet — commissions appear here the moment a payment lands on one of {name}&apos;s sales.</div>}
            {rule && <form method="POST" action="/api/act" style={{marginTop:14}}>
              <input type="hidden" name="action" value="rule_toggle"/>
              <input type="hidden" name="id" value={rule.id}/>
              <input type="hidden" name="active" value={rule.active ? '0' : '1'}/>
              <input type="hidden" name="back" value="/commissions"/>
              <button className="btn mini quiet">{rule.active ? 'Pause rate' : 'Reactivate rate'}</button>
            </form>}
          </div>
        </details>; })}
    </div>

    <details className="edit" style={{marginTop:16}}>
      <summary>Set a salesperson&apos;s rate</summary>
      <form method="POST" action="/api/act" className="inline-form" style={{marginTop:12}}>
        <input type="hidden" name="action" value="rule_add"/>
        <input type="hidden" name="back" value="/commissions"/>
        <input name="person" placeholder="Name exactly as on Team (e.g. Sara)" required style={{minWidth:220}}/>
        <input name="pct" placeholder="Rate %" type="number" step="0.1" min="0" max="100" required style={{width:110}}/>
        <button className="btn mini quiet">Set rate</button>
      </form>
      <div style={{fontSize:12, color:'#86868b', marginTop:8}}>
        The name must match how the salesperson appears on leads and sales — that is how their collections find them.</div>
      <form method="POST" action="/api/act" style={{marginTop:12}}>
        <input type="hidden" name="action" value="commissions_recompute"/>
        <input type="hidden" name="back" value="/commissions"/>
        <button className="btn mini quiet">Apply current rates to everything not yet paid out</button>
      </form>
      <div style={{fontSize:12, color:'#86868b', marginTop:6}}>
        Use this once the real percentages are set — every unpaid month re-computes at the new rates. Paid-out months never change.</div>
    </details>
  </Shell>;
}
