import Shell from '../../components/Shell';
import DocPreview from '../../components/DocPreview';
import ConfirmButton from '../../components/ConfirmButton';
import ArStage from '../../components/ArStage';
import FollowUp from '../../components/FollowUp';
import BrandSelect from '../../components/BrandSelect';
import NewInvoice from '../../components/NewInvoice';
import { db } from '../../lib/db';
export const dynamic = 'force-dynamic';
const fmtPhone = (p) => {
  const d = String(p || '').replace(/\D/g, '');
  const n = d.length === 11 && d[0] === '1' ? d.slice(1) : d;
  return n.length === 10 ? `(${n.slice(0,3)}) ${n.slice(3,6)}-${n.slice(6)}` : p;
};
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
  const [{ data: invs }, { data: availWorks }, { data: months }, { data: unsettled }, { data: openSales }, { data: payRows }, { data: saleItemDocs }] = await Promise.all([
    db.from('invoices').select('*, collectors(id, first_name, last_name, phone, email, city, state)').order('issued_at', { ascending: false }).limit(200),
    Promise.resolve({ data: null }),
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
  const VIEWS = [['open', `Open · ${open.length}`], ['paid', `Paid · ${paid.length}`], ['payments', 'Payments received'], ['all', 'All']];
  return <Shell active="finance">
    <div style={{display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16}}>
      <div>
        <div className="h1">Finance</div>
        <div className="sub">Money in, money owed, and who to follow up with — invoices are made from sales, then you send, follow up, and record money as it arrives</div>
      </div>
      <div style={{paddingTop:6}}>
        <NewInvoice/>
      </div>
    </div>

    {(() => {
      const thisMonth = new Date(); thisMonth.setDate(1);
      const mKey = thisMonth.toISOString().slice(0, 7);
      const collThis = M.filter(m => String(m.month).slice(0, 7) === mKey).reduce((s, m) => s + Number(m.collected_cents), 0);
      const paidWithDates = paid.filter(p => p.paid_at);
      const avgDays = paidWithDates.length
        ? Math.round(paidWithDates.reduce((s, p) => s + (new Date(p.paid_at) - new Date(p.issued_at)) / 86400000, 0) / paidWithDates.length)
        : null;
      return <div className="stats">
        <div className="stat"><div className="n">{usd(ytd)}</div><div className="l">Closed {yr}{yoy !== null ? <span style={{color: yoy >= 0 ? '#2e6b3f' : '#9a551a', fontWeight:700}}> · {yoy >= 0 ? '+' : ''}{yoy}% vs {yr - 1}</span> : ''}</div></div>
        <div className="stat"><div className="n">{usd(ar)}</div><div className="l">Owed to the gallery · {open.length} open invoice{open.length === 1 ? '' : 's'}</div></div>
        <div className="stat"><div className="n">{usd(collThis)}</div><div className="l">Collected in {new Date().toLocaleDateString('en-US', { month: 'long' })}</div></div>
        <div className="stat"><div className="n">{avgDays === null ? '—' : avgDays + 'd'}</div><div className="l">Average days to collect</div></div>
      </div>; })()}

    {(() => {
      const ORDER = [['issued','Unsent','#82827b'],['sent','Sent','#2257c5'],['fu1','Follow up 1','#56599f'],['fu2','Follow up 2','#7d4d9e'],['fu3','Follow up 3','#b7791f'],['paidstage','Paid','#35804a']];
      const by = { paidstage: paid };
      open.forEach(i => { const k = i.ar_status || 'issued'; (by[k] = by[k] || []).push(i); });
      const overdue = open.filter(i => (Date.now() - new Date(i.issued_at)) / 86400000 > 30
       );
      return <div className="card" style={{marginTop:16}}>
        <div className="cardtitle">Collections · every open invoice, by stage</div>
        <div style={{display:'flex', gap:6, marginTop:4}}>
          {ORDER.map(([k, label, color]) => {
            const rows = by[k] || [];
            const amt = k === 'paidstage' ? rows.reduce((s, i) => s + tot(i), 0) : rows.reduce((s, i) => s + balance(i), 0);
            const w = ar > 0 ? Math.max(rows.length ? 10 : 4, Math.round(100 * amt / ar)) : 25;
            return <div key={k} style={{flexGrow:w, minWidth:90}}>
              <div style={{height:7, borderRadius:4, background: rows.length ? color : '#e3e3dd'}}/>
              <div style={{fontSize:11.5, fontWeight:650, marginTop:6}}>{label} · {rows.length}</div>
              <div style={{fontSize:12.5, fontVariantNumeric:'tabular-nums', fontWeight:700}}>{rows.length ? usd(amt) : '—'}</div>
            </div>; })}
        </div>
        {overdue.length > 0 && <div style={{marginTop:10, fontSize:12, fontWeight:650, color:'#b8231a'}}>
          {overdue.length} invoice{overdue.length > 1 ? 's' : ''} overdue ({usd(overdue.reduce((s, i) => s + balance(i), 0))}) — open more than 30 days</div>}
        {open.length === 0 && <div style={{marginTop:10, fontSize:12, color:'#73736c'}}>
          No open AR right now. Each invoice moves Unsent → Sent → Follow up 1/2/3 until paid; the segments fill with dollars the moment one issues.</div>}
      </div>; })()}

    {waiting.length > 0 && <div className="card" style={{marginTop:16}}>
      <div className="cardtitle">Sales waiting for an invoice</div>
      {waiting.map(s => <div key={s.id} style={{display:'flex', gap:12, alignItems:'center', padding:'9px 0',
        borderBottom:'1px solid #f2f2ee', fontSize:13.5}}>
        <span style={{flex:1, minWidth:0}}>
          <a style={{fontWeight:600}} href={'/collectors/' + s.collectors?.id}>{[s.collectors?.first_name, s.collectors?.last_name].filter(Boolean).join(' ') || 'Collector'}</a>
          <span style={{color:'#73736c'}}> · {s.titles || 'sale in progress'}{s.owner ? ' · ' + s.owner : ''}</span>
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
        <div className="n" style={{fontSize:19, color: k === '90+' && v > 0 ? '#b8231a' : k === '61–90' && v > 0 ? '#9a551a' : undefined}}>{usd(v)}</div>
        <div className="l">Aging {k} days</div></div>)}
    </div>}

    <div style={{display:'flex', gap:8, marginTop:22, alignItems:'center', flexWrap:'wrap'}}>
      {VIEWS.map(([k, label]) => <a key={k} href={'/finance?view=' + k} className="pill"
        style={view === k ? {background:'#1a1a18', color:'#fff'} : {background:'#fff', border:'1px solid #e3e3dd'}}>{label}</a>)}
      <span style={{fontSize:12, color:'#73736c'}}>Click any invoice to open everything about it: contact, money received, documents, actions.</span>
    </div>
    {view === 'payments' && (() => {
      const invByI = {}; all.forEach(i => invByI[i.id] = i);
      const rows = (payRows || []).slice().reverse();
      const byMonth = {};
      rows.forEach(p => { const k = String(p.settled_at || '').slice(0, 7); (byMonth[k] = byMonth[k] || []).push(p); });
      return <div style={{display:'flex', flexDirection:'column', gap:10, marginTop:12}}>
        {Object.entries(byMonth).map(([mo, ps]) => <div className="card" key={mo} style={{padding:'12px 18px'}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
            <div className="cardtitle" style={{marginBottom:8}}>{new Date(mo + '-02').toLocaleDateString('en-US', { month:'long', year:'numeric' })}</div>
            <div style={{fontWeight:700, fontVariantNumeric:'tabular-nums'}}>{usd(ps.reduce((s, p) => s + Number(p.amount_cents), 0))}</div>
          </div>
          {ps.map((p, ix) => {
            const inv = invByI[p.invoice_id];
            return <div key={ix} style={{display:'flex', gap:12, alignItems:'center', padding:'8px 0',
              borderBottom:'1px solid #f2f2ee', fontSize:13}}>
              <span style={{color:'#73736c', fontSize:12, width:80}}>{p.settled_at ? new Date(p.settled_at).toLocaleDateString() : '—'}</span>
              <span style={{flex:1}}>{inv ? <>№{String(inv.invoice_number).padStart(4,'0')} · {inv.collectors ? [inv.collectors.first_name, inv.collectors.last_name].filter(Boolean).join(' ') : '—'}
                <span style={{color:'#73736c'}}> · {inv.title}</span></> : 'Unlinked payment'}</span>
              <span className="pill" style={{fontSize:10.5}}>{p.method || '—'}</span>
              <span style={{fontWeight:700, fontVariantNumeric:'tabular-nums', color:'#2e6b3f'}}>+{usd(p.amount_cents)}</span>
            </div>; })}
        </div>)}
        {!rows.length && <div className="empty">No payments recorded yet.</div>}
      </div>; })()}
    {view !== 'payments' && <div style={{display:'flex', flexDirection:'column', gap:10, marginTop:12}}>
      {shown.map(i => {
        const age = Math.floor((now - new Date(i.issued_at).getTime()) / 86400000);
        const c = i.collectors;
        const hist = payHist[i.id] || [];
        const isOpen = i.status === 'open';
        const overdueRow = isOpen && (age > 30);
        return <details key={i.id} className="edit" style={{padding:0, overflow:'hidden'}}>
          <summary style={{padding:'13px 18px', display:'grid',
            gridTemplateColumns:'14px 46px 52px minmax(150px,1fr) minmax(130px,1.1fr) 110px 90px 130px', gap:12, alignItems:'center'}}>
            <span>{i.pdf_url
              ? <DocPreview thumb url={i.pdf_url} label={'Invoice No. ' + String(i.invoice_number).padStart(4,'0')}/>
              : <span style={{display:'block', width:42, height:54, borderRadius:2, border:'1px dashed #e3e3dd'}}/>}</span>
            <span style={{fontSize:12, color:'#73736c', fontVariantNumeric:'tabular-nums'}}>№{String(i.invoice_number).padStart(4,'0')}</span>
            <span style={{minWidth:0}}>
              <span style={{fontWeight:650, fontSize:13.5, display:'block', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                {c ? [c.first_name, c.last_name].filter(Boolean).join(' ') : 'No collector'}</span>
              <span style={{fontSize:11.5, color:'#73736c'}}>{new Date(i.issued_at).toLocaleDateString()} · {age}d{overdueRow ? ' · OVERDUE' : ''}</span>
            </span>
            <span style={{fontSize:12.5, color:'#3a3a35', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{i.title}{i.artist ? ' · ' + i.artist : ''}</span>
            <span>{i.status === 'paid' ? <span className="pill green" style={{display:'inline-flex', alignItems:'center', height:24, fontSize:10.5, fontWeight:700, letterSpacing:'.04em', whiteSpace:'nowrap'}}>PAID{i.method ? ' · ' + i.method.toUpperCase() : ''}</span>
              : i.status === 'void' ? <span className="pill">Void</span>
              : <ArStage id={i.id} value={i.ar_status}/>}</span>
            <span>{isOpen && paidIn[i.id] ? <span className="pill" style={{background:'#e4f7e9', color:'#2e6b3f', fontSize:10.5, fontWeight:700,
                display:'inline-flex', alignItems:'center', height:24, whiteSpace:'nowrap', letterSpacing:'.04em'}}>DEPOSIT IN · {usd(paidIn[i.id])}</span> : ''}</span>
            <span style={{textAlign:'right', fontVariantNumeric:'tabular-nums', fontWeight:700, fontSize:14}}>
              {isOpen ? usd(balance(i)) : usd(tot(i))}
              {isOpen && paidIn[i.id] ? <span style={{display:'block', fontSize:10.5, color:'#73736c', fontWeight:400}}>of {usd(tot(i))}</span> : null}</span>
          </summary>
          <div style={{padding:'16px 20px 18px', borderTop:'1px solid #eeeee9',
            display:'grid', gridTemplateColumns:'200px minmax(240px,320px) 1fr', gap:32}}>
            <div>
              <div className="cardtitle" style={{marginBottom:8}}>Collector</div>
              {c ? <div style={{fontSize:13, lineHeight:1.7}}>
                <a style={{fontWeight:650}} href={'/collectors/' + c.id}>{[c.first_name, c.last_name].filter(Boolean).join(' ')}</a>
                {[c.city, c.state].filter(Boolean).length ? <div style={{color:'#73736c', fontSize:12}}>{[c.city, c.state].filter(Boolean).join(', ')}</div> : null}
                {c.phone && <div><a href={'tel:' + c.phone} style={{color:'#2257c5'}}>{fmtPhone(c.phone)}</a></div>}
                {c.email && !c.email.endsWith('import.chasecontemporary.com') && <div><a href={'mailto:' + c.email} style={{color:'#2257c5'}}>{c.email}</a></div>}
              </div> : <div style={{fontSize:12.5, color:'#73736c'}}>No collector attached</div>}
            </div>
            <div>
              <div className="cardtitle" style={{marginBottom:8}}>Money</div>
              <div style={{fontSize:13, fontVariantNumeric:'tabular-nums'}}>
                <div style={{display:'flex', justifyContent:'space-between', padding:'3px 0', color:'#73736c'}}>
                  <span>Total</span><span>{usd(tot(i))}</span></div>
                {(i.tax_cents || i.shipping_cents) ? <div style={{padding:'0 0 3px', fontSize:11.5, color:'#73736c'}}>
                  incl. {i.tax_cents ? usd(i.tax_cents) + ' tax' : ''}{i.tax_cents && i.shipping_cents ? ' · ' : ''}{i.shipping_cents ? usd(i.shipping_cents) + ' shipping' : ''}</div> : null}
                {hist.map((p, ix) => <div key={ix} style={{display:'flex', justifyContent:'space-between', padding:'3px 0', color:'#2e6b3f'}}>
                  <span>Received {p.settled_at ? new Date(p.settled_at).toLocaleDateString() : ''}{p.method ? ' · ' + p.method : ''}</span>
                  <span>−{usd(p.amount_cents)}</span></div>)}
                {isOpen && <div style={{display:'flex', justifyContent:'space-between', padding:'6px 0 0', marginTop:4,
                  borderTop:'1px solid #e3e3dd', fontWeight:700}}>
                  <span>Balance</span><span>{usd(balance(i))}</span></div>}
                {i.last_nudge_at && <div style={{fontSize:11.5, color:'#73736c', marginTop:6}}>Last follow-up {new Date(i.last_nudge_at).toLocaleDateString()}</div>}
              </div>
            </div>
            <div>
              <div className="cardtitle" style={{marginBottom:8}}>Documents</div>
              <div style={{display:'flex', gap:14, flexWrap:'wrap', alignItems:'flex-start'}}>
                <div style={{display:'flex', flexDirection:'column', gap:8, alignItems:'center'}}>
                  {i.pdf_url
                    ? <DocPreview url={i.pdf_url} label={'Invoice No. ' + String(i.invoice_number).padStart(4,'0')}/>
                    : <div style={{width:110, height:143, borderRadius:2, border:'1px dashed #cccdc4',
                        display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, color:'#73736c'}}>No PDF yet</div>}
                  <form method="POST" action="/api/act">
                    <input type="hidden" name="action" value="invoice_pdf"/>
                    <input type="hidden" name="id" value={i.id}/>
                    <input type="hidden" name="back" value="/finance"/>
                    <button className="btn mini quiet">{i.pdf_url ? 'Regenerate PDF' : 'Generate PDF'}</button>
                  </form>
                </div>
                {(docsBySale[i.sale_id] || []).map((doc, ix) => <DocPreview key={ix} url={doc.url} label={doc.label}/>)}
                {isOpen && payReady && <form method="POST" action="/api/act" style={{alignSelf:'flex-end'}}>
                  <input type="hidden" name="action" value="invoice_paylink"/>
                  <input type="hidden" name="id" value={i.id}/>
                  <input type="hidden" name="back" value="/finance"/>
                  <button className="btn mini quiet">{i.pay_url ? 'New pay link' : 'Pay link'}</button>
                </form>}
                {i.pay_url && <a className="pill blue" style={{alignSelf:'flex-end'}} href={i.pay_url} target="_blank">Pay ↗</a>}
              </div>
            </div>
          </div>
          {isOpen && <div style={{display:'flex', gap:8, alignItems:'center', padding:'12px 20px',
            borderTop:'1px solid #eeeee9', background:'#fbfbfd'}}>
            <FollowUp id={i.id} stage={i.ar_status} email={c && !c.email?.endsWith('import.chasecontemporary.com') ? c.email : ''}
              name={c ? [c.first_name, c.last_name].filter(Boolean).join(' ') : ''}
              num={String(i.invoice_number).padStart(4,'0')} balance={usd(balance(i))}
              pdf={i.pdf_url} docs={docsBySale[i.sale_id] || []}/>
            <span style={{width:1, height:22, background:'#e3e3dd'}}/>
            <form method="POST" action="/api/act" style={{display:'flex', gap:8, alignItems:'center'}}>
              <input type="hidden" name="action" value="invoice_payment"/>
              <input type="hidden" name="id" value={i.id}/>
              <input type="hidden" name="back" value="/finance"/>
              <label className="money"><span>$</span><input name="amount" inputMode="numeric" placeholder="Amount received"/></label>
              <input name="method" placeholder="wire / card" style={{width:96, fontSize:12.5, border:'1px solid #e3e3dd', borderRadius:2, height:36, padding:'0 10px', fontFamily:'inherit', background:'#fff'}}/>
              <ConfirmButton className="btn mini quiet">Record payment</ConfirmButton>
              {!paidIn[i.id] && <ConfirmButton className="btn mini quiet" name="fraction" value="0.5">50% deposit · {usd(Math.round(tot(i) / 2))}</ConfirmButton>}
            </form>
            <div style={{marginLeft:'auto', display:'flex', gap:14, alignItems:'center'}}>
              <form method="POST" action="/api/act">
                <input type="hidden" name="action" value="invoice_paid"/>
                <input type="hidden" name="id" value={i.id}/>
                <input type="hidden" name="back" value="/finance"/>
                <ConfirmButton className="btn mini"
                  message={`Mark invoice No. ${String(i.invoice_number).padStart(4,'0')} paid in full?\n\nThis records ${usd(balance(i))}, marks the work sold, books it to the collector, and writes the commission. Only do this once the money is actually in the bank.`}>
                  {paidIn[i.id] ? 'Record final ' + usd(balance(i)) : 'Mark paid in full'}</ConfirmButton>
              </form>
              <form method="POST" action="/api/act">
                <input type="hidden" name="action" value="invoice_void"/>
                <input type="hidden" name="id" value={i.id}/>
                <input type="hidden" name="back" value="/finance"/>
                <ConfirmButton className=""
                  message={`Void invoice No. ${String(i.invoice_number).padStart(4,'0')}?\n\nThis cannot be undone. Any payments already recorded against it stay on the books.`}
                  style={{background:'none', border:0, color:'#b8231a', fontSize:12.5, fontWeight:600,
                  fontFamily:'inherit', cursor:'pointer', padding:0}}>Void</ConfirmButton>
              </form>
            </div>
          </div>}
        </details>; })}
      {!shown.length && <div className="empty">
        {view === 'open' ? 'No open invoices. New ones are generated from sales in the pipeline drawer.' : 'Nothing here yet.'}</div>}
    </div>}


  </Shell>;
}
