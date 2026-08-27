import Shell from '../../components/Shell';
import { db } from '../../lib/db';
export const dynamic = 'force-dynamic';
const usd = (c) => '$' + Math.round((c || 0) / 100).toLocaleString();

export default async function Finance() {
  const payReady = !!process.env.SHOPIFY_ADMIN_TOKEN;
  const stripeReady = !!process.env.STRIPE_SECRET_KEY;
  const [{ data: invs }, { data: collectors }] = await Promise.all([
    db.from('invoices').select('*, collectors(first_name, last_name)').order('issued_at', { ascending: false }).limit(200),
    db.from('collectors').select('id, first_name, last_name').order('created_at', { ascending: false }).limit(200),
  ]);
  const all = invs || [];
  const open = all.filter(i => i.status === 'open');
  const paid = all.filter(i => i.status === 'paid');
  const tot = (i) => i.amount_cents + (i.tax_cents || 0) + (i.shipping_cents || 0);
  const ar = open.reduce((s, i) => s + tot(i), 0);
  const now = Date.now();
  const bucket = (i) => {
    const d = Math.floor((now - new Date(i.issued_at).getTime()) / 86400000);
    return d <= 30 ? '0-30' : d <= 60 ? '31-60' : d <= 90 ? '61-90' : '90+';
  };
  const buckets = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
  open.forEach(i => { buckets[bucket(i)] += tot(i); });
  const yr = new Date().getFullYear();
  const collectedYtd = paid.filter(i => i.paid_at && new Date(i.paid_at).getFullYear() === yr)
    .reduce((s, i) => s + tot(i), 0);
  const avgDays = paid.filter(i => i.paid_at).length
    ? Math.round(paid.filter(i => i.paid_at).reduce((s, i) =>
        s + (new Date(i.paid_at) - new Date(i.issued_at)) / 86400000, 0) / paid.filter(i => i.paid_at).length)
    : null;
  return <Shell active="finance">
    <div className="h1">Finance</div>
    <div className="sub">Open AR, invoice pipeline, and collections — live</div>
    <div className="stats">
      <div className="stat"><div className="n">{usd(ar)}</div><div className="l">Outstanding AR ({open.length} open)</div></div>
      <div className="stat"><div className="n">{usd(collectedYtd)}</div><div className="l">Collected this year</div></div>
      <div className="stat"><div className="n">{avgDays === null ? '—' : avgDays + 'd'}</div><div className="l">Avg days to pay</div></div>
      <div className="stat"><div className="n">{usd(buckets['90+'] + buckets['61-90'])}</div><div className="l">AR over 60 days</div></div>
    </div>
    <div className="stats">
      {Object.entries(buckets).map(([k, v]) => <div className="stat" key={k}>
        <div className="n" style={{fontSize:20}}>{usd(v)}</div><div className="l">Aging {k} days</div></div>)}
    </div>

    <div className="sub" style={{marginTop:24}}>Invoices are generated from leads in the pipeline drawer. Manual entry below is for walk-in / off-pipeline sales only.</div>
    <form method="POST" action="/api/act" className="inline-form" style={{marginTop:10, flexWrap:'wrap'}}>
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
      <button className="btn mini">Create invoice</button>
    </form>

    <div className="tblcard"><table className="tbl"><thead><tr>
      <th>#</th><th>Collector</th><th>Work</th><th>Amount</th><th>Issued</th><th>Age</th><th>Status</th><th>Document</th><th></th>
    </tr></thead><tbody>
      {all.map(i => {
        const age = Math.floor((now - new Date(i.issued_at).getTime()) / 86400000);
        return <tr key={i.id}>
        <td style={{fontVariantNumeric:'tabular-nums'}}>{String(i.invoice_number).padStart(4,'0')}</td>
        <td style={{fontWeight:600}}>{i.collectors ? i.collectors.first_name + ' ' + i.collectors.last_name : '—'}</td>
        <td>{i.title}{i.artist ? <span style={{color:'#86868b'}}> · {i.artist}</span> : null}</td>
        <td style={{fontVariantNumeric:'tabular-nums', fontWeight:600}}>{usd(i.amount_cents + (i.tax_cents || 0) + (i.shipping_cents || 0))}
          {(i.tax_cents || i.shipping_cents) ? <div style={{fontSize:11, color:'#86868b', fontWeight:400}}>
            {usd(i.amount_cents)} art{i.tax_cents ? ' + ' + usd(i.tax_cents) + ' tax' : ''}{i.shipping_cents ? ' + ' + usd(i.shipping_cents) + ' ship' : ''}</div> : null}</td>
        <td>{new Date(i.issued_at).toLocaleDateString()}</td>
        <td style={{color: i.status === 'open' && age > 30 ? '#ff3b30' : '#86868b'}}>{age}d</td>
        <td>{i.status === 'paid' ? <span className="pill green">Paid{i.method ? ' · ' + i.method : ''}</span>
          : i.status === 'void' ? <span className="pill">Void</span>
          : <span className="pill blue">Open</span>}</td>
        <td style={{whiteSpace:'nowrap'}}>
          <form method="POST" action="/api/act" style={{display:'inline-block', marginRight:6}}>
            <input type="hidden" name="action" value="invoice_pdf"/>
            <input type="hidden" name="id" value={i.id}/>
            <input type="hidden" name="back" value="/finance"/>
            <button className="btn mini">{i.pdf_url ? 'Re-issue PDF' : 'Generate PDF'}</button>
          </form>
          {i.pdf_url && <a className="pill" style={{background:'#fff', border:'1px solid #e8e8ed', marginRight:6}}
            href={i.pdf_url} target="_blank">PDF ↗</a>}
          {i.status === 'open' && (payReady
            ? <form method="POST" action="/api/act" style={{display:'inline-block', marginRight:6}}>
                <input type="hidden" name="action" value="invoice_paylink"/>
                <input type="hidden" name="id" value={i.id}/>
                <input type="hidden" name="back" value="/finance"/>
                <button className="btn mini">{i.pay_url ? 'New pay link' : 'Pay link'}</button>
              </form>
            : <span className="pill" style={{background:'#ffefdc', color:'#b25a00', fontSize:10, fontWeight:700, marginRight:6}}>PAY LINK · AWAITING SHOPIFY TOKEN</span>)}
          {i.pay_url && <a className="pill blue" style={{marginRight:6}} href={i.pay_url} target="_blank">Pay ↗</a>}
          {i.status === 'open' && (stripeReady
            ? <form method="POST" action="/api/act" style={{display:'inline-block', marginRight:6}}>
                <input type="hidden" name="action" value="invoice_paylink"/>
                <input type="hidden" name="id" value={i.id}/>
                <input type="hidden" name="back" value="/finance"/>
                <button className="btn mini">{i.pay_url ? 'New pay link' : 'Pay link'}</button>
              </form>
            : <span className="pill" style={{background:'#ffefdc', color:'#b25a00', fontSize:10, fontWeight:700, marginRight:6}}>PAY LINK · AWAITING STRIPE</span>)}
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
            <button className="btn ghost mini">Void</button></form>
        </div>}</td>
      </tr>; })}
    </tbody></table>
    {!all.length && <div style={{padding:'16px 18px', fontSize:13, color:'#86868b'}}>No invoices yet. Create the first above — marking one paid auto-computes commissions and logs the collector purchase.</div>}
    </div>
    <div className="empty">Stripe payment links + PDF invoices (Vercel Blob) arrive in the next phase — this ledger is their foundation.</div>
  </Shell>;
}
