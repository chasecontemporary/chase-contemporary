import Shell from '../../components/Shell';
import DocPreview from '../../components/DocPreview';
import ArStage from '../../components/ArStage';
import { db } from '../../lib/db';
export const dynamic = 'force-dynamic';
const usd = (c) => '$' + Math.round((c || 0) / 100).toLocaleString();
const usdK = (c) => {
  const d = Math.round((c || 0) / 100);
  return d >= 1000000 ? '$' + (d / 1000000).toFixed(1) + 'M' : d >= 1000 ? '$' + Math.round(d / 1000) + 'k' : '$' + d;
};

export default async function Finance({ searchParams }) {
  const sp = (await searchParams) || {};
  const view = sp.view || 'open';
  const payReady = !!process.env.SHOPIFY_ADMIN_TOKEN;
  const since = new Date(); since.setMonth(since.getMonth() - 36);
  const [{ data: invs }, { data: collectors }, { data: months }, { data: unsettled }, { data: openSales }] = await Promise.all([
    db.from('invoices').select('*, collectors(first_name, last_name)').order('issued_at', { ascending: false }).limit(200),
    db.from('collectors').select('id, first_name, last_name').order('created_at', { ascending: false }).limit(200),
    db.from('finance_monthly').select('*').gte('month', since.toISOString().slice(0, 10)).order('month'),
    db.from('commissions').select('amount_cents').eq('settled', false).limit(1000),
    db.from('sales').select('id, created_at, owner, collectors(id, first_name, last_name), sale_items(agreed_cents, title)')
      .eq('status', 'open').order('created_at').limit(50),
  ]);
  const all = invs || [];
  const open = all.filter(i => i.status === 'open');
  const paid = all.filter(i => i.status === 'paid');
  const tot = (i) => i.amount_cents + (i.tax_cents || 0) + (i.shipping_cents || 0);
  const ar = open.reduce((s, i) => s + tot(i), 0);
  const now = Date.now();
  const bucketOf = (i) => {
    const d = Math.floor((now - new Date(i.issued_at).getTime()) / 86400000);
    return d <= 30 ? '0–30' : d <= 60 ? '31–60' : d <= 90 ? '61–90' : '90+';
  };
  const buckets = { '0–30': 0, '31–60': 0, '61–90': 0, '90+': 0 };
  open.forEach(i => { buckets[bucketOf(i)] += tot(i); });

  const M = months || [];
  const yr = new Date().getFullYear();
  const ytd = M.filter(m => new Date(m.month).getFullYear() === yr).reduce((s, m) => s + Number(m.collected_cents), 0);
  const lastYtd = M.filter(m => {
    const d = new Date(m.month);
    return d.getFullYear() === yr - 1 && d.getMonth() <= new Date().getMonth();
  }).reduce((s, m) => s + Number(m.collected_cents), 0);
  const t12 = M.filter(m => new Date(m.month) > new Date(now - 366 * 86400000)).reduce((s, m) => s + Number(m.collected_cents), 0);
  const yoy = lastYtd > 0 ? Math.round(100 * (ytd - lastYtd) / lastYtd) : null;
  const commOwed = (unsettled || []).reduce((s, c) => s + Number(c.amount_cents || 0), 0);
  const chart = M.slice(-24);
  const maxM = Math.max(...chart.map(m => Number(m.collected_cents)), 1);
  const waiting = (openSales || []).map(s => ({ ...s,
    value: (s.sale_items || []).reduce((a, it) => a + Number(it.agreed_cents || 0), 0),
    titles: (s.sale_items || []).map(it => it.title).join(', ') })).filter(s => s.value > 0 || (s.sale_items || []).length);

  const shown = view === 'paid' ? paid : view === 'all' ? all : [...open].sort((a, b) => new Date(a.issued_at) - new Date(b.issued_at));
  const VIEWS = [['open', `Open · ${open.length}`], ['paid', `Paid · ${paid.length}`], ['all', 'All']];
  return <Shell active="finance">
    <div className="h1">Finance</div>
    <div className="sub">Cash reality: what came in, what is owed, what is waiting to be asked for</div>

    <div className="stats">
      <div className="stat"><div className="n">{usd(ytd)}</div>
        <div className="l">Collected {yr}{yoy !== null ? <span style={{color: yoy >= 0 ? '#1d7a3d' : '#b25a00', fontWeight:700}}> · {yoy >= 0 ? '+' : ''}{yoy}% vs {yr - 1}</span> : ''}</div></div>
      <div className="stat"><div className="n">{usd(t12)}</div><div className="l">Collected, trailing 12 months</div></div>
      <div className="stat"><div className="n">{usd(ar)}</div><div className="l">Outstanding AR · {open.length} open invoice{open.length === 1 ? '' : 's'}</div></div>
      <div className="stat"><div className="n">{usd(commOwed)}</div><div className="l">Commission pool accrued, unsettled</div></div>
    </div>

    {(() => {
      const ORDER = [['issued','Issued','#8e8e93'],['sent','Sent','#0071e3'],['nudged','Nudged','#af52de'],['promised','Promised','#ff9500']];
      const by = {};
      open.forEach(i => { const k = i.ar_status || 'issued'; (by[k] = by[k] || []).push(i); });
      const overdue = open.filter(i => (Date.now() - new Date(i.issued_at)) / 86400000 > 30
        || (i.promise_date && new Date(i.promise_date) < new Date()));
      return <div className="card" style={{marginTop:16}}>
        <div className="cardtitle">AR pipeline · where every open dollar sits in the chase</div>
        <div style={{display:'flex', gap:6, marginTop:4}}>
          {ORDER.map(([k, label, color]) => {
            const rows = by[k] || [];
            const amt = rows.reduce((s, i) => s + tot(i), 0);
            const w = ar > 0 ? Math.max(rows.length ? 10 : 4, Math.round(100 * amt / ar)) : 25;
            return <div key={k} style={{flexGrow:w, minWidth:90}}>
              <div style={{height:7, borderRadius:4, background: rows.length ? color : '#e8e8ed'}}/>
              <div style={{fontSize:11.5, fontWeight:650, marginTop:6}}>{label} · {rows.length}</div>
              <div style={{fontSize:12.5, fontVariantNumeric:'tabular-nums', fontWeight:700}}>{rows.length ? usd(amt) : '—'}</div>
            </div>; })}
        </div>
        {overdue.length > 0 && <div style={{marginTop:10, fontSize:12, fontWeight:650, color:'#b8231a'}}>
          {overdue.length} invoice{overdue.length > 1 ? 's' : ''} overdue ({usd(overdue.reduce((s, i) => s + tot(i), 0))}) — over 30 days or past a promise date</div>}
        {open.length === 0 && <div style={{marginTop:10, fontSize:12, color:'#86868b'}}>
          No open AR right now. Each invoice moves Issued → Sent → Nudged → Promised as the chase progresses; the segments fill with dollars the moment one issues.</div>}
      </div>; })()}

    <div className="card" style={{marginTop:16}}>
      <div className="cardtitle">Revenue rhythm · last 24 months</div>
      <div style={{display:'flex', alignItems:'flex-end', gap:4, height:120, marginTop:6}}>
        {chart.map(m => {
          const d = new Date(m.month);
          const h = Math.max(3, Math.round(112 * Number(m.collected_cents) / maxM));
          return <div key={m.month} title={d.toLocaleDateString('en-US', { month:'short', year:'numeric' }) + ' · ' + usd(m.collected_cents) + ' · ' + m.sales + ' sales'}
            style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4}}>
            <div style={{width:'100%', maxWidth:26, height:h, background: d.getFullYear() === yr ? '#1d1d1f' : '#d2d2d7',
              borderRadius:4}}/>
            <span style={{fontSize:9, color:'#86868b', letterSpacing:'.02em'}}>{d.getMonth() === 0 ? d.getFullYear() : d.getMonth() % 3 === 0 ? d.toLocaleDateString('en-US', { month:'narrow' }) : ''}</span>
          </div>; })}
      </div>
      <div style={{fontSize:11.5, color:'#86868b', marginTop:6}}>Peak {usdK(maxM)} · black = {yr} · hover any bar for the month</div>
    </div>

    {waiting.length > 0 && <div className="card" style={{marginTop:16}}>
      <div className="cardtitle">Waiting on an invoice · the cash gap</div>
      {waiting.map(s => <div key={s.id} style={{display:'flex', gap:12, alignItems:'center', padding:'9px 0',
        borderBottom:'1px solid #f5f5f7', fontSize:13.5}}>
        <span style={{flex:1, minWidth:0}}>
          <a style={{fontWeight:600}} href={'/collectors/' + s.collectors?.id}>{[s.collectors?.first_name, s.collectors?.last_name].filter(Boolean).join(' ') || 'Collector'}</a>
          <span style={{color:'#86868b'}}> · {s.titles || 'sale in progress'}{s.owner ? ' · ' + s.owner : ''}</span>
        </span>
        <span style={{fontVariantNumeric:'tabular-nums', fontWeight:700}}>{usd(s.value)}</span>
        <form method="POST" action="/api/act">
          <input type="hidden" name="action" value="invoice_from_sale"/>
          <input type="hidden" name="id" value={s.id}/>
          <input type="hidden" name="back" value="/finance"/>
          <button className="btn mini quiet">Generate invoice</button>
        </form>
      </div>)}
    </div>}

    {ar > 0 && <div className="stats" style={{marginTop:16}}>
      {Object.entries(buckets).map(([k, v]) => <div className="stat" key={k}>
        <div className="n" style={{fontSize:19, color: k === '90+' && v > 0 ? '#b8231a' : k === '61–90' && v > 0 ? '#b25a00' : undefined}}>{usd(v)}</div>
        <div className="l">Aging {k} days</div></div>)}
    </div>}

    <div style={{display:'flex', gap:8, marginTop:22, alignItems:'center'}}>
      {VIEWS.map(([k, label]) => <a key={k} href={'/finance?view=' + k} className="pill"
        style={view === k ? {background:'#1d1d1f', color:'#fff'} : {background:'#fff', border:'1px solid #e8e8ed'}}>{label}</a>)}
    </div>
    <div className="tblcard" style={{marginTop:12}}><table className="tbl"><thead><tr>
      <th>№</th><th>Collector</th><th>Work</th><th>Issued</th><th>Age</th><th>Status</th><th>Document</th><th></th><th style={{textAlign:'right'}}>Total</th>
    </tr></thead><tbody>
      {shown.map(i => {
        const age = Math.floor((now - new Date(i.issued_at).getTime()) / 86400000);
        return <tr key={i.id}>
        <td style={{fontVariantNumeric:'tabular-nums', color:'#86868b'}}>{String(i.invoice_number).padStart(4,'0')}</td>
        <td style={{fontWeight:600}}>{i.collectors ? [i.collectors.first_name, i.collectors.last_name].filter(Boolean).join(' ') : '—'}</td>
        <td style={{maxWidth:260, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{i.title}{i.artist ? <span style={{color:'#86868b'}}> · {i.artist}</span> : null}</td>
        <td style={{fontSize:12.5}}>{new Date(i.issued_at).toLocaleDateString()}</td>
        <td style={{fontSize:12.5, color: i.status === 'open' && age > 30 ? '#b8231a' : '#86868b'}}>{age}d</td>
        <td>{i.status === 'paid' ? <span className="pill green">Paid{i.method ? ' · ' + i.method : ''}</span>
          : i.status === 'void' ? <span className="pill">Void</span>
          : <ArStage id={i.id} value={i.ar_status} promiseDate={i.promise_date}/>}</td>
        <td style={{whiteSpace:'nowrap'}}>
          <form method="POST" action="/api/act" style={{display:'inline-block', marginRight:6}}>
            <input type="hidden" name="action" value="invoice_pdf"/>
            <input type="hidden" name="id" value={i.id}/>
            <input type="hidden" name="back" value="/finance"/>
            <button className="btn mini quiet">{i.pdf_url ? 'Re-issue' : 'PDF'}</button>
          </form>
          {i.pdf_url && <span style={{marginRight:6, display:'inline-block'}}>
            <DocPreview compact url={i.pdf_url} label={'Invoice No. ' + String(i.invoice_number).padStart(4,'0')}/></span>}
          {i.status === 'open' && (payReady
            ? <form method="POST" action="/api/act" style={{display:'inline-block', marginRight:6}}>
                <input type="hidden" name="action" value="invoice_paylink"/>
                <input type="hidden" name="id" value={i.id}/>
                <input type="hidden" name="back" value="/finance"/>
                <button className="btn mini quiet">{i.pay_url ? 'New pay link' : 'Pay link'}</button>
              </form>
            : <span className="pill" style={{background:'#ffefdc', color:'#b25a00', fontSize:10, fontWeight:700, marginRight:6}}>PAY LINK · AWAITING SHOPIFY</span>)}
          {i.pay_url && <a className="pill blue" style={{marginRight:6}} href={i.pay_url} target="_blank">Pay ↗</a>}
        </td>
        <td>{i.status === 'open' && <div style={{display:'flex', gap:6}}>
          <form method="POST" action="/api/act" style={{display:'flex', gap:4}}>
            <input type="hidden" name="action" value="invoice_paid"/>
            <input type="hidden" name="id" value={i.id}/>
            <input type="hidden" name="back" value="/finance"/>
            <input name="method" placeholder="wire / card…" style={{width:86, fontSize:12, border:'1px solid #e8e8ed', borderRadius:8, padding:'4px 8px'}}/>
            <button className="btn mini">Mark paid</button></form>
          <form method="POST" action="/api/act">
            <input type="hidden" name="action" value="invoice_void"/>
            <input type="hidden" name="id" value={i.id}/>
            <input type="hidden" name="back" value="/finance"/>
            <button className="btn mini quiet" style={{color:'#b8231a'}}>Void</button></form>
        </div>}</td>
        <td style={{textAlign:'right', fontVariantNumeric:'tabular-nums', fontWeight:700}}>{usd(tot(i))}
          {(i.tax_cents || i.shipping_cents) ? <div style={{fontSize:11, color:'#86868b', fontWeight:400}}>
            {usd(i.amount_cents)} art{i.tax_cents ? ' + ' + usd(i.tax_cents) + ' tax' : ''}{i.shipping_cents ? ' + ' + usd(i.shipping_cents) + ' ship' : ''}</div> : null}</td>
      </tr>; })}
      {!shown.length && <tr><td colSpan={9} style={{color:'#86868b'}}>
        {view === 'open' ? 'No open invoices. New ones are generated from sales in the pipeline drawer.' : 'Nothing here yet.'}</td></tr>}
    </tbody></table></div>

    <details className="edit" style={{marginTop:16}}>
      <summary>Manual invoice — walk-in or off-pipeline sale</summary>
      <form method="POST" action="/api/act" className="inline-form" style={{marginTop:12, flexWrap:'wrap'}}>
        <input type="hidden" name="action" value="invoice_add"/>
        <input type="hidden" name="back" value="/finance"/>
        <select name="collector_id" className="sel rect">
          <option value="">No collector</option>
          {(collectors||[]).map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
        </select>
        <input name="title" placeholder="Work / description" required style={{flex:1, minWidth:180}}/>
        <input name="artist" placeholder="Artist" style={{width:140}}/>
        <input name="amount" placeholder="Amount $" type="number" step="0.01" required style={{width:110}}/>
        <input name="tax" placeholder="Tax $" type="number" step="0.01" style={{width:90}}/>
        <input name="shipping" placeholder="Ship $" type="number" step="0.01" style={{width:90}}/>
        <input name="due" type="date" style={{width:150}}/>
        <button className="btn mini quiet">Create invoice</button>
      </form>
    </details>
  </Shell>;
}
