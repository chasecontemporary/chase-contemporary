import Shell from '../../components/Shell';
import { db } from '../../lib/db';
import { cookies } from 'next/headers';
export const dynamic = 'force-dynamic';
const usd = (c) => '$' + Math.round((c || 0) / 100).toLocaleString();
const monthName = (d) => new Date(String(d).slice(0, 7) + '-02').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
const monthShort = (d) => new Date(String(d).slice(0, 7) + '-02').toLocaleDateString('en-US', { month: 'short' });

export default async function Commissions() {
  const jar = await cookies();
  const viewer = decodeURIComponent(jar.get('cc_rep')?.value || '');
  const [{ data: rules }, { data: team }, { data: rows }, { data: invMap }] = await Promise.all([
    db.from('commission_rules').select('*').order('person'),
    db.from('team_members').select('name, role'),
    db.from('commissions').select('*').order('created_at', { ascending: false }).limit(800),
    db.from('invoices').select('id, invoice_number, title, collectors(first_name, last_name)').limit(300),
  ]);
  const role = (team || []).find(t => t.name === viewer)?.role;
  const personal = role === 'rep';
  const inv = {}; (invMap || []).forEach(i => inv[i.id] = i);
  const all = personal ? (rows || []).filter(r => r.person === viewer) : (rows || []);
  const now = new Date();
  const thisPeriod = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const sum = (list) => list.reduce((s, r) => s + Number(r.amount_cents || 0), 0);
  const accruing = all.filter(r => r.period === thisPeriod && !r.paid_at);
  const payable = all.filter(r => r.period && r.period < thisPeriod && !r.paid_at);
  const paidYtd = all.filter(r => r.paid_at && new Date(r.paid_at).getFullYear() === now.getFullYear());
  const nextPayout = new Date(now.getFullYear(), now.getMonth(), 8);
  if (now.getDate() >= 8) nextPayout.setMonth(nextPayout.getMonth() + 1);
  const payoutDateStr = nextPayout.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

  // twelve-month progress series
  const series = [];
  for (let k = 11; k >= 0; k--) {
    const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
    const key = d.toISOString().slice(0, 10);
    series.push({ key, label: monthShort(key), earned: sum(all.filter(r => r.period === key)),
      current: key === thisPeriod });
  }
  const maxE = Math.max(...series.map(s => s.earned), 1);
  const lastM = series[series.length - 2];
  const curM = series[series.length - 1];
  const delta = lastM && lastM.earned > 0 ? Math.round(100 * (curM.earned - lastM.earned) / lastM.earned) : null;

  // grouping
  const people = {};
  all.forEach(r => {
    const p = people[r.person] = people[r.person] || { rows: [] };
    p.rows.push(r);
  });
  if (!personal) (rules || []).forEach(r => { people[r.person] = people[r.person] || { rows: [] }; });
  const ruleFor = (name) => (rules || []).find(r => r.person === name);

  const Chart = () => <div className="card" style={{marginTop:16}}>
    <div style={{display:'flex', alignItems:'baseline', justifyContent:'space-between'}}>
      <div className="cardtitle" style={{marginBottom:0}}>{personal ? 'Your last twelve months' : 'Team commissions · last twelve months'}</div>
      <div style={{fontSize:12.5, color:'#86868b'}}>
        {monthName(thisPeriod)} so far <b style={{color:'#1d1d1f', fontVariantNumeric:'tabular-nums'}}>{usd(curM.earned)}</b>
        {delta !== null && <span style={{color: delta >= 0 ? '#1d7a3d' : '#b25a00', fontWeight:700}}> · {delta >= 0 ? '+' : ''}{delta}% vs {lastM.label}</span>}
      </div>
    </div>
    <div style={{display:'flex', alignItems:'flex-end', gap:6, height:110, marginTop:14}}>
      {series.map(s => <div key={s.key} title={monthName(s.key) + ' · ' + usd(s.earned)}
        style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:5}}>
        <div style={{width:'100%', maxWidth:34, height: Math.max(3, Math.round(88 * s.earned / maxE)),
          borderRadius:5, background: s.current ? '#0071e3' : s.earned > 0 ? '#1d1d1f' : '#e8e8ed'}}/>
        <span style={{fontSize:9.5, color: s.current ? '#0071e3' : '#86868b', fontWeight: s.current ? 700 : 500,
          letterSpacing:'.02em'}}>{s.label}</span>
      </div>)}
    </div>
  </div>;

  const Ledger = ({ name, p, showPayout }) => {
    const periods = {};
    p.rows.forEach(r => { const k = r.period || 'unknown'; (periods[k] = periods[k] || []).push(r); });
    return <>{Object.entries(periods).sort((a, b) => b[0].localeCompare(a[0])).map(([period, rs]) => {
      const unpaid = rs.filter(r => !r.paid_at);
      const closed = period < thisPeriod;
      const isCurrent = period === thisPeriod;
      return <div key={period} style={{marginTop:14, ...(isCurrent ? {background:'#f5f9ff', borderRadius:10, padding:'10px 12px', margin:'14px -12px 0'} : {})}}>
        <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:6}}>
          <span className="cardtitle" style={{marginBottom:0, ...(isCurrent ? {color:'#0071e3'} : {})}}>
            {monthName(period.slice(0, 7))}{isCurrent ? ' · in progress' : ''}</span>
          <span style={{fontSize:12.5, fontWeight:700, fontVariantNumeric:'tabular-nums'}}>{usd(sum(rs))}</span>
          {unpaid.length === 0 ? <span className="pill green" style={{fontSize:10, fontWeight:700}}>PAID OUT</span>
            : closed ? (showPayout
                ? <form method="POST" action="/api/act" style={{marginLeft:'auto'}}>
                    <input type="hidden" name="action" value="payout_complete"/>
                    <input type="hidden" name="person" value={name}/>
                    <input type="hidden" name="period" value={period}/>
                    <input type="hidden" name="back" value="/commissions"/>
                    <button className="btn mini">Mark paid out · {usd(sum(unpaid))}</button>
                  </form>
                : <span className="pill" style={{background:'#ffefdc', color:'#b25a00', fontSize:10, fontWeight:700}}>PAYS {payoutDateStr.toUpperCase()}</span>)
            : null}
        </div>
        {rs.map(r => {
          const i = inv[r.invoice_id];
          return <div key={r.id} style={{display:'flex', gap:12, alignItems:'center', padding:'6px 0',
            borderBottom:'1px solid ' + (isCurrent ? '#e4eefb' : '#f5f5f7'), fontSize:12.5}}>
            <span style={{color:'#86868b', width:78}}>{new Date(r.created_at).toLocaleDateString()}</span>
            <span style={{flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
              {i ? <>№{String(i.invoice_number).padStart(4,'0')} · {i.collectors ? [i.collectors.first_name, i.collectors.last_name].filter(Boolean).join(' ') : ''} <span style={{color:'#86868b'}}>· {i.title}</span></> : 'Payment'}</span>
            <span style={{color:'#86868b'}}>{Number(r.pct) > 0 ? r.pct + '%'
              : <span className="pill" style={{background:'#ffefdc', color:'#b25a00', fontSize:9.5, fontWeight:700}}>RATE PENDING</span>}</span>
            <span style={{fontWeight:700, fontVariantNumeric:'tabular-nums',
              color: Number(r.amount_cents) > 0 ? '#1d7a3d' : '#c7c7cc'}}>+{usd(r.amount_cents)}</span>
          </div>; })}
      </div>; })}</>;
  };

  return <Shell active="commissions">
    <div className="h1">{personal ? 'Your commissions' : 'Commissions'}</div>
    <div className="sub">{personal
      ? `${viewer} — your rate on every dollar you collect, paid on the 8th for the month before`
      : 'Each salesperson earns their rate on the money they collect — computed the moment cash lands, paid on the 8th for the month before'}</div>

    <div className="stats">
      <div className="stat"><div className="n" style={{color:'#0071e3'}}>{usd(sum(accruing))}</div>
        <div className="l">Earning in {monthName(thisPeriod)}</div></div>
      <div className="stat"><div className="n" style={{color: sum(payable) > 0 ? '#b25a00' : undefined}}>{usd(sum(payable))}</div>
        <div className="l">Payable {payoutDateStr}</div></div>
      <div className="stat"><div className="n">{usd(sum(paidYtd))}</div>
        <div className="l">Paid out in {now.getFullYear()}</div></div>
      {personal
        ? <div className="stat"><div className="n">{ruleFor(viewer) ? ruleFor(viewer).pct + '%' : '—'}</div>
            <div className="l">Your rate{ruleFor(viewer) ? '' : ' · not set yet'}</div></div>
        : <div className="stat"><div className="n">{(rules || []).filter(r => r.active).length}</div>
            <div className="l">Salespeople with a rate set</div></div>}
    </div>

    <Chart/>

    {personal
      ? <div className="card" style={{marginTop:16}}>
          <Ledger name={viewer} p={people[viewer] || { rows: [] }} showPayout={false}/>
          {!(people[viewer]?.rows || []).length && <div style={{fontSize:13, color:'#86868b'}}>
            Nothing earned yet — commissions appear here the moment a payment lands on one of your sales.</div>}
        </div>
      : <>
        <div style={{display:'flex', flexDirection:'column', gap:10, marginTop:16}}>
          {Object.entries(people).sort((a, b) => sum(b[1].rows.filter(r => !r.paid_at)) - sum(a[1].rows.filter(r => !r.paid_at))).map(([name, p]) => {
            const rule = ruleFor(name);
            const pAcc = sum(p.rows.filter(r => r.period === thisPeriod && !r.paid_at));
            const pPay = sum(p.rows.filter(r => r.period && r.period < thisPeriod && !r.paid_at));
            const pPaid = sum(p.rows.filter(r => r.paid_at && new Date(r.paid_at).getFullYear() === now.getFullYear()));
            return <details key={name} className="edit" style={{padding:0, overflow:'hidden'}}>
              <summary style={{padding:'13px 18px', display:'grid',
                gridTemplateColumns:'14px minmax(140px,1fr) 110px 130px 130px 130px', gap:12, alignItems:'center'}}>
                <span style={{minWidth:0}}>
                  <span style={{fontWeight:650, fontSize:14}}>{name}</span>
                  {rule && !rule.active && <span className="pill" style={{marginLeft:8, fontSize:10}}>PAUSED</span>}
                </span>
                <span>{rule ? <span className="pill" style={{background:'#f0f0f2', fontWeight:700, fontSize:10.5,
                  display:'inline-flex', height:24, alignItems:'center'}}>{rule.pct}% RATE</span>
                  : <span className="pill" style={{background:'#ffefdc', color:'#b25a00', fontSize:10, fontWeight:700,
                      display:'inline-flex', height:24, alignItems:'center'}}>NO RATE SET</span>}</span>
                <span style={{textAlign:'right'}}>
                  <span style={{fontVariantNumeric:'tabular-nums', fontWeight:600, color: pAcc ? '#0071e3' : undefined}}>{pAcc ? usd(pAcc) : '—'}</span>
                  <span style={{display:'block', fontSize:11, color:'#86868b'}}>earning now</span></span>
                <span style={{textAlign:'right'}}>
                  <span style={{fontVariantNumeric:'tabular-nums', fontWeight:700, color: pPay ? '#b25a00' : undefined}}>{pPay ? usd(pPay) : '—'}</span>
                  <span style={{display:'block', fontSize:11, color:'#86868b'}}>payable {payoutDateStr}</span></span>
                <span style={{textAlign:'right'}}>
                  <span style={{fontVariantNumeric:'tabular-nums', fontWeight:600}}>{pPaid ? usd(pPaid) : '—'}</span>
                  <span style={{display:'block', fontSize:11, color:'#86868b'}}>paid {now.getFullYear()}</span></span>
              </summary>
              <div style={{padding:'4px 18px 16px', borderTop:'1px solid #f0f0f2'}}>
                <Ledger name={name} p={p} showPayout={true}/>
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
          <summary>Rates &amp; recompute</summary>
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
      </>}
  </Shell>;
}
