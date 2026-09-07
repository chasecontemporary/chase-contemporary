'use client';
import { useEffect, useState } from 'react';
import WorkPicker from './WorkPicker';

// Fix an open invoice without voiding it: change a price, add framing, add shipping, take
// something off with a credit line. Refused once money has landed; then it is Re-issue.
const usd = (n) => '$' + Math.round(n || 0).toLocaleString();
const KINDN = { work: 'Work', service: 'Service', shipping: 'Shipping', tax: 'Sales tax', credit: 'Credit' };

export default function InvoiceLines({ invoice, lines: initial = [], locked = false, lockedWhy = '' }) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState(() => initial.map((l, i) => ({ key: i + 1, kind: l.kind, artwork_id: l.artwork_id, title: l.title, artist: l.artist,
    amount: l.amount_cents ? String(Math.round(l.amount_cents / 100)) : '', note: l.note || '' })));
  const [nextKey, setNextKey] = useState(initial.length + 1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open]);
  const num = (x) => Number(String(x || '0').replace(/[$,\s]/g, '')) || 0;
  const patch = (key, p) => setLines(ls => ls.map(l => l.key === key ? { ...l, ...p } : l));
  const remove = (key) => setLines(ls => ls.filter(l => l.key !== key));
  const add = (kind) => { setLines(ls => [...ls, { key: nextKey, kind, amount: '' }]); setNextKey(k => k + 1); };
  const total = lines.reduce((s, l) => s + (l.kind === 'credit' ? -num(l.amount) : num(l.amount)), 0);
  const label = { fontSize:11, fontWeight:650, letterSpacing:'.05em', textTransform:'uppercase', color:'#73736c', display:'block', marginBottom:6 };
  const input = { background:'#fff', border:'1px solid #e3e3dd', borderRadius:2, height:36, fontFamily:'inherit', fontSize:13.5, padding:'0 11px', width:'100%' };
  const save = async () => {
    if (busy) return;
    setBusy(true); setErr(null);
    const fd = new FormData();
    fd.set('action', 'invoice_lines_set'); fd.set('id', invoice.id); fd.set('back', 'json');
    fd.set('lines', JSON.stringify(lines.map(({ key, ...l }) => l)));
    const r = await fetch('/api/act', { method: 'POST', body: fd }).then(x => x.json()).catch(() => ({ ok: false, error: 'Network error' }));
    setBusy(false);
    if (!r.ok) { setErr(r.error || 'That did not save.'); return; }
    window.location.href = '/finance';
  };
  return <>
    <button className="btn mini quiet" onClick={() => locked ? setErr(lockedWhy) : setOpen(true)} title={locked ? lockedWhy : ''}
      style={locked ? {opacity:.6} : {}}>Edit lines</button>
    {err && !open && <span style={{fontSize:12, color:'#9a551a', fontWeight:600, marginLeft:8}}>{err}</span>}
    {open && <div onClick={() => setOpen(false)} style={{position:'fixed', inset:0, zIndex:80, background:'rgba(0,0,0,.42)',
      backdropFilter:'blur(6px)', display:'flex', alignItems:'center', justifyContent:'center', padding:24}}>
      <div onClick={(e) => e.stopPropagation()} style={{background:'#fff', borderRadius:2, width:'min(680px, 96vw)', maxHeight:'92vh', overflowY:'auto',
        boxShadow:'0 24px 80px rgba(0,0,0,.3)'}}>
        <div style={{padding:'16px 20px', borderBottom:'1px solid #eeeee9', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <div style={{fontSize:15, fontWeight:700}}>Invoice No. {String(invoice.invoice_number).padStart(4, '0')} · lines</div>
          <button onClick={() => setOpen(false)} className="btn mini quiet">Close</button>
        </div>
        <div style={{padding:'18px 20px', display:'flex', flexDirection:'column', gap:16}}>
          <div>
            <span style={label}>Line items</span>
            <div style={{display:'flex', flexDirection:'column', gap:8}}>
              {lines.map(l => <div key={l.key} style={{display:'grid', gridTemplateColumns:'84px 1fr 130px 28px', gap:8, alignItems:'center'}}>
                <span className="pill" style={{background: l.kind === 'credit' ? '#fdf3e3' : '#eeeee9', color: l.kind === 'credit' ? '#9a551a' : undefined,
                  fontWeight:700, fontSize:10.5, justifyContent:'center', display:'inline-flex', height:24, alignItems:'center'}}>{KINDN[l.kind]}</span>
                {l.kind === 'work'
                  ? (l.artwork_id
                      ? <span style={{fontSize:13}}><span style={{fontSize:10.5, fontWeight:600, letterSpacing:'.06em', textTransform:'uppercase'}}>{l.artist}</span><span style={{fontStyle:'italic'}}> · {l.title}</span></span>
                      : <WorkPicker onPick={(h) => patch(l.key, h ? { artwork_id: h.id, title: h.title, artist: h.artist, amount: h.cents > 0 ? String(h.cents / 100) : l.amount } : { artwork_id: null })}/>)
                  : l.kind === 'service' || l.kind === 'credit'
                  ? <input style={input} placeholder={l.kind === 'credit' ? 'Why (courtesy, damage allowance, price adjustment)' : 'Description (framing, installation…)'}
                      value={l.title || ''} onChange={(e) => patch(l.key, { title: e.target.value })}/>
                  : <span style={{fontSize:12.5, color:'#73736c'}}>{l.kind === 'shipping' ? 'Shipping & handling' : 'Sales tax'}</span>}
                <label className="money" style={{width:'100%'}}><span>{l.kind === 'credit' ? '−$' : '$'}</span>
                  <input inputMode="numeric" placeholder="0" value={l.amount || ''} onChange={(e) => patch(l.key, { amount: e.target.value })} style={{width:'100%'}}/></label>
                <button type="button" onClick={() => remove(l.key)} title="Remove line"
                  style={{background:'none', border:0, color:'#c2c2bb', fontSize:16, cursor:'pointer'}}>×</button>
              </div>)}
            </div>
            <div style={{display:'flex', gap:6, marginTop:10, flexWrap:'wrap'}}>
              {[['work','+ Work'],['service','+ Service'],['shipping','+ Shipping'],['tax','+ Sales tax'],['credit','+ Credit']].map(([k, l2]) =>
                <button key={k} type="button" className="btn mini quiet" onClick={() => add(k)}>{l2}</button>)}
            </div>
          </div>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'end'}}>
            <div style={{fontSize:12, color:'#73736c', maxWidth:360}}>Saving replaces the lines, recomputes the totals and clears the old PDF; generate it again before sending. Works added here join the sale; works removed leave it.</div>
            <div style={{textAlign:'right'}}><span style={label}>New total</span>
              <div style={{fontSize:20, fontWeight:700, fontVariantNumeric:'tabular-nums'}}>{usd(total)}</div></div>
          </div>
          {err && <div style={{fontSize:12.5, color:'#c02d23', fontWeight:600}}>{err}</div>}
          <div style={{display:'flex', justifyContent:'flex-end'}}>
            <button className="btn" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save lines · ' + usd(total)}</button>
          </div>
        </div>
      </div>
    </div>}
  </>;
}
