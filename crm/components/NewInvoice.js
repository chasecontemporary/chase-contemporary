'use client';
import { useEffect, useState } from 'react';
import CollectorPicker from './CollectorPicker';
import WorkPicker from './WorkPicker';

// New invoice, built the way an invoice actually is: line items.
// Works pull from on-hand inventory (and create the sale underneath);
// shipping, tax, and services are lines too.
const usd = (n) => '$' + Math.round(n || 0).toLocaleString();

export default function NewInvoice() {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState([{ key: 1, kind: 'work' }]);
  const [nextKey, setNextKey] = useState(2);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open]);
  const patch = (key, p) => setLines(ls => ls.map(l => l.key === key ? { ...l, ...p } : l));
  const remove = (key) => setLines(ls => ls.filter(l => l.key !== key));
  const add = (kind) => { setLines(ls => [...ls, { key: nextKey, kind }]); setNextKey(k => k + 1); };
  const num = (x) => Number(String(x || '0').replace(/[$,\s]/g, '')) || 0;
  const total = lines.reduce((s, l) => s + num(l.amount), 0);
  const label = { fontSize:11, fontWeight:650, letterSpacing:'.05em', textTransform:'uppercase',
    color:'#86868b', display:'block', marginBottom:6 };
  const input = { background:'#fff', border:'1px solid #e8e8ed', borderRadius:10, height:36,
    fontFamily:'inherit', fontSize:13.5, padding:'0 11px', width:'100%' };
  const KINDN = { work: 'Work', service: 'Service', shipping: 'Shipping', tax: 'Sales tax' };
  return <>
    <button className="btn" onClick={() => setOpen(true)}>New invoice</button>
    {open && <div onClick={() => setOpen(false)} style={{position:'fixed', inset:0, zIndex:80,
      background:'rgba(0,0,0,.42)', backdropFilter:'blur(6px)', display:'flex',
      alignItems:'center', justifyContent:'center', padding:24}}>
      <div onClick={(e) => e.stopPropagation()} style={{background:'#fff', borderRadius:16,
        width:'min(640px, 96vw)', maxHeight:'92vh', overflowY:'auto',
        boxShadow:'0 24px 80px rgba(0,0,0,.3)'}}>
        <div style={{padding:'16px 20px', borderBottom:'1px solid #f0f0f2', display:'flex',
          alignItems:'center', justifyContent:'space-between'}}>
          <div style={{fontSize:15, fontWeight:700}}>New invoice</div>
          <button onClick={() => setOpen(false)} className="btn mini quiet">Close</button>
        </div>
        <form method="POST" action="/api/act" style={{padding:'18px 20px', display:'flex',
          flexDirection:'column', gap:16}}>
          <input type="hidden" name="action" value="invoice_manual"/>
          <input type="hidden" name="back" value="/finance"/>
          <input type="hidden" name="lines" value={JSON.stringify(lines.map(({ key, ...l }) => l))}/>
          <div>
            <span style={label}>Collector</span>
            <CollectorPicker required/>
          </div>
          <div>
            <span style={label}>Line items</span>
            <div style={{display:'flex', flexDirection:'column', gap:8}}>
              {lines.map(l => <div key={l.key} style={{display:'grid',
                gridTemplateColumns:'84px 1fr 130px 28px', gap:8, alignItems:'center'}}>
                <span className="pill" style={{background:'#f0f0f2', fontWeight:700, fontSize:10.5,
                  justifyContent:'center', display:'inline-flex', height:24, alignItems:'center'}}>{KINDN[l.kind]}</span>
                {l.kind === 'work'
                  ? <WorkPicker onPick={(h) => patch(l.key, h
                      ? { artwork_id: h.id, title: h.title, artist: h.artist, amount: h.cents > 0 ? String(h.cents / 100) : l.amount }
                      : { artwork_id: null })}/>
                  : l.kind === 'service'
                  ? <input style={input} placeholder="Description (framing, installation…)"
                      onChange={(e) => patch(l.key, { title: e.target.value })}/>
                  : <span style={{fontSize:12.5, color:'#86868b'}}>{l.kind === 'shipping' ? 'Shipping & handling' : 'Sales tax'}</span>}
                <label className="money" style={{width:'100%'}}><span>$</span>
                  <input inputMode="numeric" placeholder="0" value={l.amount || ''}
                    onChange={(e) => patch(l.key, { amount: e.target.value })} style={{width:'100%'}}/></label>
                <button type="button" onClick={() => remove(l.key)} title="Remove line"
                  style={{background:'none', border:0, color:'#c7c7cc', fontSize:16, cursor:'pointer'}}>×</button>
              </div>)}
            </div>
            <div style={{display:'flex', gap:6, marginTop:10, flexWrap:'wrap'}}>
              {[['work','+ Work'],['service','+ Service'],['shipping','+ Shipping'],['tax','+ Sales tax']].map(([k, l2]) =>
                <button key={k} type="button" className="btn mini quiet" onClick={() => add(k)}>{l2}</button>)}
            </div>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 160px', gap:10, alignItems:'end'}}>
            <div><span style={label}>Due date</span><input style={{...input, width:160}} name="due" type="date"/></div>
            <div style={{textAlign:'right'}}>
              <span style={label}>Total</span>
              <div style={{fontSize:20, fontWeight:700, fontVariantNumeric:'tabular-nums'}}>{usd(total)}</div>
            </div>
          </div>
          {lines.some(l => l.kind === 'work' && l.artwork_id) && <div style={{fontSize:12, color:'#86868b'}}>
            Paying this invoice in full marks the selected work{lines.filter(l => l.kind === 'work' && l.artwork_id).length > 1 ? 's' : ''} sold and books them to the collector automatically.</div>}
          <div style={{display:'flex', justifyContent:'flex-end'}}>
            <button className="btn">Create invoice · {usd(total)}</button>
          </div>
        </form>
      </div>
    </div>}
  </>;
}
