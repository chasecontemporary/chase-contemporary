'use client';
import { useState } from 'react';
import BrandSelect from './BrandSelect';
import EmailComposer from './EmailComposer';

// After the money. One block per paid sale: where the work is on its way, the paper that
// travels with it, and the two notes the collector should get (shipped, delivered).
const CARRIERS = [['', 'Choose a carrier…'], ['YSDS', 'YSDS'], ['Hangman', 'Hangman'], ['SBA', 'SBA'], ['FedEx', 'FedEx'],
  ['UPS', 'UPS'], ['Courier', 'Local courier'], ['Pickup', 'Collector pickup'], ['Other', 'Other']];
const STEPS = [['packed', 'Packed'], ['shipped', 'Shipped'], ['delivered', 'Delivered'], ['installed', 'Installed']];
const usd = (n) => '$' + Math.round(n || 0).toLocaleString();
const trackUrl = (carrier, t) => {
  const n = String(t || '').replace(/\s/g, '');
  if (!n) return null;
  if (carrier === 'FedEx') return 'https://www.fedex.com/fedextrack/?trknbr=' + n;
  if (carrier === 'UPS') return 'https://www.ups.com/track?tracknum=' + n;
  return null;
};

export default function Fulfilment({ sale, invoice, collector, works = [], shipments = [], mailReady = false, compact = false }) {
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);
  const [edit, setEdit] = useState({});
  const byWork = {}; shipments.forEach(s => byWork[s.artwork_id || 'sale'] = s);
  const post = async (fields) => {
    setBusy(fields.artwork_id || fields.action); setErr(null);
    const fd = new FormData();
    Object.entries(fields).forEach(([k, v]) => fd.set(k, v ?? ''));
    fd.set('back', 'json');
    const r = await fetch('/api/act', { method: 'POST', body: fd }).then(x => x.json()).catch(() => ({ ok: false, error: 'Network error' }));
    setBusy(null);
    if (!r.ok) { setErr(r.error || 'That did not save.'); return; }
    window.location.reload();
  };
  const label = { fontSize:10.5, fontWeight:650, letterSpacing:'.06em', textTransform:'uppercase', color:'#73736c', display:'block', marginBottom:5 };
  const input = { background:'#fff', border:'1px solid #e3e3dd', borderRadius:2, height:34, fontFamily:'inherit', fontSize:13, padding:'0 10px', width:'100%', outline:'none' };
  const done = sale?.fulfilment_status === 'done';
  const allDelivered = works.length > 0 && works.every(w => ['delivered', 'installed'].includes(byWork[w.id]?.status));

  return <div style={{border:'1px solid #e3e3dd', borderRadius:3, background:'#fff', padding: compact ? '12px 14px' : '14px 18px'}}>
    <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:10}}>
      <span className="cardtitle" style={{marginBottom:0}}>After the money</span>
      <span className="pill" style={{fontSize:10, fontWeight:700, background: done ? '#e4f7e9' : '#fdf3e3', color: done ? '#2e6b3f' : '#9a551a'}}>
        {done ? 'DONE' : sale?.fulfilment_status === 'delivered' ? 'DELIVERED' : sale?.fulfilment_status === 'shipped' ? 'ON ITS WAY' : 'TO SHIP'}</span>
      {collector?.shipping_line1 && <span style={{fontSize:11.5, color:'#73736c', marginLeft:'auto'}}>
        to {[collector.shipping_line1, collector.shipping_city, collector.shipping_state].filter(Boolean).join(', ')}</span>}
    </div>

    {works.map(w => {
      const s = byWork[w.id] || {};
      const e = edit[w.id] || {};
      const carrier = e.carrier ?? s.carrier ?? '';
      const quote = e.quote ?? (s.quote_cents ? String(Math.round(s.quote_cents / 100)) : '');
      const tracking = e.tracking ?? s.tracking ?? '';
      const eta = e.eta ?? s.eta ?? '';
      const url = s.tracking_url || trackUrl(carrier, tracking);
      const stepIdx = STEPS.findIndex(([k]) => k === s.status);
      return <div key={w.id} style={{borderTop:'1px solid #f0f0eb', padding:'12px 0'}}>
        <div style={{display:'flex', gap:10, alignItems:'center', marginBottom:10}}>
          {w.image_url && <img src={w.image_url + (w.image_url.includes('?') ? '&' : '?') + 'width=88'} alt="" style={{width:36, height:36, objectFit:'cover', borderRadius:2}}/>}
          <span style={{flex:1, minWidth:0, fontSize:13}}>
            <span style={{fontSize:10.5, fontWeight:600, letterSpacing:'.06em', textTransform:'uppercase'}}>{w.artist}</span>
            <span style={{fontStyle:'italic'}}> · {w.title}</span>
            {w.location && <span style={{color:'#73736c'}}> · at {w.location}</span>}
          </span>
          <span style={{display:'flex', gap:4}}>
            {STEPS.map(([k, l], i) => <button key={k} type="button" className="btn mini quiet"
              disabled={!!busy} onClick={() => post({ action:'shipment_set', sale_id: sale.id, invoice_id: invoice?.id || '', artwork_id: w.id,
                status: k, carrier, quote, tracking, eta })}
              style={{height:26, fontSize:11, padding:'0 9px', ...(i <= stepIdx ? {background:'#1a1a18', color:'#fff'} : {})}}>
              {i < stepIdx ? '✓ ' : ''}{l}</button>)}
          </span>
        </div>
        <div style={{display:'grid', gridTemplateColumns:'1.2fr .8fr 1.4fr .9fr auto', gap:8, alignItems:'end'}}>
          <div><span style={label}>Carrier</span>
            <BrandSelect options={CARRIERS} value={carrier} onValue={(v) => setEdit(x => ({ ...x, [w.id]: { ...e, carrier: v } }))} width="100%"/></div>
          <div><span style={label}>Quote</span>
            <label className="money"><span>$</span><input inputMode="numeric" value={quote} placeholder="0"
              onChange={ev => setEdit(x => ({ ...x, [w.id]: { ...e, quote: ev.target.value } }))} style={{width:'100%'}}/></label></div>
          <div><span style={label}>Tracking</span>
            <input style={input} value={tracking} placeholder="Number or link"
              onChange={ev => setEdit(x => ({ ...x, [w.id]: { ...e, tracking: ev.target.value } }))}/></div>
          <div><span style={label}>ETA</span>
            <input type="date" style={input} value={eta} onChange={ev => setEdit(x => ({ ...x, [w.id]: { ...e, eta: ev.target.value } }))}/></div>
          <button className="btn mini quiet" disabled={!!busy} style={{height:34}}
            onClick={() => post({ action:'shipment_set', sale_id: sale.id, invoice_id: invoice?.id || '', artwork_id: w.id,
              status: s.status || 'pending', carrier, quote, tracking, eta })}>{busy === w.id ? 'Saving…' : 'Save'}</button>
        </div>
        <div style={{display:'flex', gap:14, alignItems:'center', marginTop:8, fontSize:12, color:'#73736c', flexWrap:'wrap'}}>
          {url && <a href={url} target="_blank" style={{color:'#2257c5', fontWeight:650}}>Track ↗</a>}
          {s.shipped_at && <span>shipped {new Date(s.shipped_at).toLocaleDateString()}</span>}
          {s.delivered_at && <span style={{color:'#2e6b3f', fontWeight:650}}>delivered {new Date(s.delivered_at).toLocaleDateString()}</span>}
          <span style={{marginLeft:'auto', display:'flex', gap:8, alignItems:'center'}}>
            <span>Certificate</span>
            {w.coa_url ? <a href={w.coa_url} target="_blank" style={{color:'#2257c5'}}>PDF</a> : <span style={{color:'#9a551a'}}>not made</span>}
            <button type="button" className="btn mini quiet" style={{height:26, fontSize:11, ...(w.coa_signed_at ? {background:'#e4f7e9', color:'#2e6b3f'} : {})}}
              disabled={!!busy} onClick={() => post({ action:'coa_mark', id: w.id, what: w.coa_signed_at ? 'unsigned' : 'signed' })}>
              {w.coa_signed_at ? '✓ Signed' : 'Mark signed'}</button>
            <button type="button" className="btn mini quiet" style={{height:26, fontSize:11, ...(w.coa_sent_at ? {background:'#e4f7e9', color:'#2e6b3f'} : {})}}
              disabled={!!busy} onClick={() => post({ action:'coa_mark', id: w.id, what: w.coa_sent_at ? 'unsent' : 'sent' })}>
              {w.coa_sent_at ? '✓ Sent with the work' : 'Sent with the work'}</button>
          </span>
        </div>
      </div>; })}

    <div style={{borderTop:'1px solid #f0f0eb', paddingTop:12, display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}>
      {invoice && <EmailComposer invoiceId={invoice.id} collectorId={collector?.id} defaultTemplate="shipping_confirmation" label="Tell them it shipped"/>}
      {invoice && <EmailComposer invoiceId={invoice.id} collectorId={collector?.id} defaultTemplate="delivered_thank_you" label={sale?.thanked_at ? '✓ Thank-you sent' : 'Send the thank-you'}/>}
      {!mailReady && <span style={{fontSize:11.5, color:'#73736c'}}>Email opens as a draft until Resend is connected.</span>}
      <span style={{marginLeft:'auto'}}>
        {done
          ? <span style={{fontSize:12.5, color:'#2e6b3f', fontWeight:650}}>Closed {sale.closed_at ? new Date(sale.closed_at).toLocaleDateString() : ''}</span>
          : <button className="btn mini" disabled={!!busy || !allDelivered} title={allDelivered ? '' : 'Every work must be delivered first'}
              style={!allDelivered ? {opacity:.4} : {}}
              onClick={() => { if (window.confirm('Close this sale? Everything is delivered and the paper has gone with it.')) post({ action:'sale_close', id: sale.id }); }}>
              Close the sale</button>}
      </span>
    </div>
    {err && <div style={{marginTop:8, fontSize:12.5, color:'#c02d23', fontWeight:600}}>{err}</div>}
  </div>;
}
