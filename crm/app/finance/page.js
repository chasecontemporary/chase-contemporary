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
  const [{ data: invs }, { data: collectors }, { data: months }, { data: unsettled }, { data: openSales }, { data: payRows }, { data: saleItemDocs }] = await Promise.all([
    db.from('invoices').select('*, collectors(id, first_name, last_name, phone, email, city, state)').order('issued_at', { ascending: false }).limit(200),
    db.from('collectors').select('id, first_name, last_name').order('created_at', { ascending: false }).limit(200),
    db.from('finance_monthly').select('*').gte('month', since.toISOString().slice(0, 10)).order('month'),
    db.from('commissions').select('amount_cents').eq('settled', false).limit(1000),
    db.from('sales').select('id, created_at, owner, collectors(id, first_name, last_name), sale_items(agreed_cents, title)')
      .eq('status', 'open').order('created_at').limit(50),
    db.from('payments').select('invoice_id, amount_cents, method, settled_at').eq('status', 'settled').not('invoice_id', 'is', null).order('settled_at').limit(1000),
    db.from('sale_items').select('sale_id, title, artworks(tearsheet_url, coa_url, title)').not('sale_id', 'is', null).limit(400),
  ]);
  const all = invs || [];
  const open = all.filter(i => i.status === 'open');
  const paid = all.filter(i => i.status === 'paid');
  const tot = (i) => i.amount_cents + (i.tax_cents || 0) + (i.shipping_cents || 0);
  const paidIn = {}, payHist = {};
  (payRows || []).forEach(p => {
    paidIn[p.invoice_id] = (paidIn[p.invoice_id] || 0) + Number(p.amount_cents);
    (payHist[p.invoice_id] = payHist[p.invoice_id] || []).push(p);
  });
  const balance = (i) => Math.max(0, tot(i) - (paidIn[i.id] || 0));
  const ar = open.reduce((s, i) => s + balance(i), 0);
  const now = Date.now();
  const bucketOf = (i) => {
    const d = Math.floor((now - new Date(i.issued_at).getTime()) / 86400000);
    return d <= 30 ? '0–30' : d <= 60 ? '31–60' : d <= 90 ? '61–90' : '90+';
  };
  const buckets = { '0–30': 0, '31–60': 0, '61–90': 0, '90+': 0 };
  open.forEach(i => { buckets[bucketOf(i)] += balance(i); });

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

  const docsBySale = {};
  (saleItemDocs || []).forEach(it => {
    const a = it.artworks;
    if (!a) return;
    const list = docsBySale[it.sale_id] = docsBySale[it.sale_id] || [];
    if (a.tearsheet_url) list.push({ label: 'Tear sheet · ' + (a.title || it.title), url: a.tearsheet_url });
    if (a.coa_url) list.push({ label: 'COA · ' + (a.title || it.title), url: a.coa_url });
  });
  const shown = view === 'paid' ? paid : view === 'all' ? all : [...open].sort((a, b) => new Date(a.issued_at) - new Date(b.issued_at));
  const VIEWS = [['open', `Open · ${open.length}`], ['paid', `Paid · ${paid.length}`], ['all', 'All']];
  return <Shell active="finance">
    <div className="h1">Finance</div>
    <div className="sub">Cash reality: what came in, what is owed, what is waiting to be asked for</div>

    {(() => {
      const thisMonth = new Date(); thisMonth.setDate(1);
      const mKey = thisMonth.toISOString().slice(0, 7);
      const lastM = new Date(thisMonth); lastM.setMonth(lastM.getMonth() - 1);
      const lKey = lastM.toISOString().slice(0, 7);
      const collThis = M.filter(m => String(m.month).slice(0, 7) === mKey).reduce((s, m) => s + Number(m.collected_cents), 0);
      const collLast = M.filter(m => String(m.month).slice(0, 7) === lKey).reduce((s, m) => s + Number(m.collected_cents), 0);
      return <div className="stats">
        <div className="stat"><div className="n">{usd(ar)}</div><div className="l">Outstanding AR · {open.length} open invoice{open.length === 1 ? '' : 's'}</div></div>
        <div className="stat"><div className="n">{usd(collThis)}</div><div className="l">Closed {new Date().toLocaleDateString('en-US', { month: 'long' })}</div></div>
        <div className="stat"><div className="n">{usd(collLast)}</div><div className="l">Closed {lastM.toLocaleDateString('en-US', { month: 'long' })}</div></div>
        <div className="stat"><div className="n">{usd(commOwed)}</div><div className="l">Commission pool accrued, unsettled</div></div>
      </div>; })()}

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
            const amt = rows.reduce((s, i) => s + balance(i), 0);
            const w = ar > 0 ? Math.max(rows.length ? 10 : 4, Math.round(100 * amt / ar)) : 25;
            return <div key={k} style={{flexGrow:w, minWidth:90}}>
              <div style={{height:7, borderRadius:4, background: rows.length ? color : '#e8e8ed'}}/>
              <div style={{fontSize:11.5, fontWeight:650, marginTop:6}}>{label} · {rows.length}</div>
              <div style={{fontSize:12.5, fontVariantNumeric:'tabular-nums', fontWeight:700}}>{rows.length ? usd(amt) : '—'}</div>
            </div>; })}
        </div>
        {overdue.length > 0 && <div style={{marginTop:10, fontSize:12, fontWeight:650, color:'#b8231a'}}>
          {overdue.length} invoice{overdue.length > 1 ? 's' : ''} overdue ({usd(overdue.reduce((s, i) => s + balance(i), 0))}) — over 30 days or past a promise date</div>}
        {open.length === 0 && <div style={{marginTop:10, fontSize:12, color:'#86868b'}}>
          No open AR right now. Each invoice moves Issued → Sent → Nudged → Promised as the chase progresses; the segments fill with dollars the moment one issues.</div>}
      </div>; })()}

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
    <div style={{display:'flex', flexDirection:'column', gap:10, marginTop:12}}>
      {shown.map(i => {
        const age = Math.floor((now - new Date(i.issued_at).getTime()) / 86400000);
        const c = i.collectors;
        const hist = payHist[i.id] || [];
        const isOpen = i.status === 'open';
        const overdueRow = isOpen && (age > 30 || (i.promise_date && new Date(i.promise_date) < new Date()));
        return <details key={i.id} className="edit" style={{padding:0, overflow:'hidden'}}>
          <summary style={{padding:'13px 18px', display:'grid',
            gridTemplateColumns:'14px 46px 52px minmax(150px,1fr) minmax(130px,1.1fr) 110px 90px 130px', gap:12, alignItems:'center'}}>
            <span>{i.pdf_url
              ? <DocPreview thumb url={i.pdf_url} label={'Invoice No. ' + String(i.invoice_number).padStart(4,'0')}/>
              : <span style={{display:'block', width:42, height:54, borderRadius:6, border:'1px dashed #e8e8ed'}}/>}</span>
            <span style={{fontSize:12, color:'#86868b', fontVariantNumeric:'tabular-nums'}}>№{String(i.invoice_number).padStart(4,'0')}</span>
            <span style={{minWidth:0}}>
              <span style={{fontWeight:650, fontSize:13.5, display:'block', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                {c ? [c.first_name, c.last_name].filter(Boolean).join(' ') : 'No collector'}</span>
              <span style={{fontSize:11.5, color:'#86868b'}}>{new Date(i.issued_at).toLocaleDateString()} · {age}d{overdueRow ? ' · OVERDUE' : ''}</span>
            </span>
            <span style={{fontSize:12.5, color:'#3a3a3c', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{i.title}{i.artist ? ' · ' + i.artist : ''}</span>
            <span>{i.status === 'paid' ? <span className="pill green">Paid{i.method ? ' · ' + i.method : ''}</span>
              : i.status === 'void' ? <span className="pill">Void</span>
              : <span className="pill" style={overdueRow ? {background:'#ffefdc', color:'#b25a00', fontWeight:700} : {background:'#f0f0f2', fontWeight:700}}>
                  {(i.ar_status || 'issued').toUpperCase()}{i.ar_status === 'promised' && i.promise_date ? ' ' + new Date(i.promise_date).toLocaleDateString('en-US',{month:'numeric',day:'numeric'}) : ''}</span>}</span>
            <span style={{fontSize:11.5, color:'#86868b'}}>{isOpen && paidIn[i.id] ? usd(paidIn[i.id]) + ' in' : ''}</span>
            <span style={{textAlign:'right', fontVariantNumeric:'tabular-nums', fontWeight:700, fontSize:14}}>
              {isOpen ? usd(balance(i)) : usd(tot(i))}
              {isOpen && paidIn[i.id] ? <span style={{display:'block', fontSize:10.5, color:'#86868b', fontWeight:400}}>of {usd(tot(i))}</span> : null}</span>
          </summary>
          <div style={{padding:'4px 18px 16px', borderTop:'1px solid #f5f5f7'}}>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:18, marginTop:12}}>
              <div>
                <div className="cardtitle" style={{marginBottom:6}}>Collector</div>
                {c ? <div style={{fontSize:13}}>
                  <a style={{fontWeight:650}} href={'/collectors/' + c.id}>{[c.first_name, c.last_name].filter(Boolean).join(' ')}</a>
                  {[c.city, c.state].filter(Boolean).length ? <div style={{color:'#86868b', fontSize:12}}>{[c.city, c.state].filter(Boolean).join(', ')}</div> : null}
                  {c.phone && <div style={{marginTop:4}}><a href={'tel:' + c.phone} style={{color:'#0071e3'}}>{c.phone}</a></div>}
                  {c.email && !c.email.endsWith('import.chasecontemporary.com') && <div><a href={'mailto:' + c.email} style={{color:'#0071e3'}}>{c.email}</a></div>}
                </div> : <div style={{fontSize:12.5, color:'#86868b'}}>No collector attached</div>}
              </div>
              <div>
                <div className="cardtitle" style={{marginBottom:6}}>Money</div>
                <div style={{fontSize:12.5, lineHeight:1.8}}>
                  <div>Total {usd(tot(i))}{(i.tax_cents || i.shipping_cents) ? <span style={{color:'#86868b'}}> ({usd(i.amount_cents)} art{i.tax_cents ? ' + ' + usd(i.tax_cents) + ' tax' : ''}{i.shipping_cents ? ' + ' + usd(i.shipping_cents) + ' ship' : ''})</span> : null}</div>
                  {hist.map((p, ix) => <div key={ix} style={{color:'#1d7a3d'}}>
                    + {usd(p.amount_cents)} received {p.settled_at ? new Date(p.settled_at).toLocaleDateString() : ''}{p.method ? ' · ' + p.method : ''}</div>)}
                  {isOpen && <div style={{fontWeight:700}}>Balance {usd(balance(i))}</div>}
                  {i.promise_date && <div style={{color:'#b25a00'}}>Promised by {new Date(i.promise_date).toLocaleDateString()}</div>}
                  {i.last_nudge_at && <div style={{color:'#86868b'}}>Last nudged {new Date(i.last_nudge_at).toLocaleDateString()}</div>}
                </div>
              </div>
              <div>
                <div className="cardtitle" style={{marginBottom:6}}>Documents &amp; chase</div>
                <div style={{display:'flex', flexDirection:'column', gap:6, marginBottom:8}}>
                  {i.pdf_url && <span><DocPreview compact url={i.pdf_url} label={'Invoice No. ' + String(i.invoice_number).padStart(4,'0')}/></span>}
                  {(docsBySale[i.sale_id] || []).map((doc, ix) => <span key={ix}>
                    <DocPreview compact url={doc.url} label={doc.label}/></span>)}
                  {!i.pdf_url && !(docsBySale[i.sale_id] || []).length &&
                    <span style={{fontSize:12, color:'#86868b'}}>No documents yet — generate the invoice PDF below.</span>}
                </div>
                <div style={{display:'flex', gap:6, flexWrap:'wrap', alignItems:'center'}}>
                  {isOpen && <ArStage id={i.id} value={i.ar_status} promiseDate={i.promise_date}/>}
                  <form method="POST" action="/api/act" style={{display:'inline-block'}}>
                    <input type="hidden" name="action" value="invoice_pdf"/>
                    <input type="hidden" name="id" value={i.id}/>
                    <input type="hidden" name="back" value="/finance"/>
                    <button className="btn mini quiet">{i.pdf_url ? 'Re-issue PDF' : 'Generate PDF'}</button>
                  </form>
                  {isOpen && (payReady
                    ? <form method="POST" action="/api/act" style={{display:'inline-block'}}>
                        <input type="hidden" name="action" value="invoice_paylink"/>
                        <input type="hidden" name="id" value={i.id}/>
                        <input type="hidden" name="back" value="/finance"/>
                        <button className="btn mini quiet">{i.pay_url ? 'New pay link' : 'Pay link'}</button>
                      </form>
                    : <span className="pill" style={{background:'#ffefdc', color:'#b25a00', fontSize:10, fontWeight:700}}>PAY LINK · AWAITING SHOPIFY</span>)}
                  {i.pay_url && <a className="pill blue" href={i.pay_url} target="_blank">Pay ↗</a>}
                </div>
              </div>
            </div>
            {isOpen && <div style={{display:'flex', gap:8, alignItems:'center', marginTop:14, flexWrap:'wrap'}}>
              <form method="POST" action="/api/act" style={{display:'flex', gap:6}}>
                <input type="hidden" name="action" value="invoice_payment"/>
                <input type="hidden" name="id" value={i.id}/>
                <input type="hidden" name="back" value="/finance"/>
                <label className="money"><span>$</span><input name="amount" inputMode="numeric" placeholder="Received"/></label>
                <input name="method" placeholder="wire / card…" style={{width:100, fontSize:12.5, border:'1px solid #e8e8ed', borderRadius:10, height:36, padding:'0 10px', fontFamily:'inherit'}}/>
                <button className="btn mini quiet">Record payment</button>
              </form>
              <form method="POST" action="/api/act">
                <input type="hidden" name="action" value="invoice_paid"/>
                <input type="hidden" name="id" value={i.id}/>
                <input type="hidden" name="back" value="/finance"/>
                <button className="btn mini">Settle balance · {usd(balance(i))}</button>
              </form>
              <form method="POST" action="/api/act" style={{marginLeft:'auto'}}>
                <input type="hidden" name="action" value="invoice_void"/>
                <input type="hidden" name="id" value={i.id}/>
                <input type="hidden" name="back" value="/finance"/>
                <button className="btn mini quiet" style={{color:'#b8231a'}}>Void</button>
              </form>
            </div>}
          </div>
        </details>; })}
      {!shown.length && <div className="empty">
        {view === 'open' ? 'No open invoices. New ones are generated from sales in the pipeline drawer.' : 'Nothing here yet.'}</div>}
    </div>

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
