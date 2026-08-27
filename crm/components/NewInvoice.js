'use client';
import { useEffect, useState } from 'react';
import CollectorPicker from './CollectorPicker';
import WorkPicker from './WorkPicker';

// New invoice modal: pick the collector, pick the work (or free-form), money, done.
export default function NewInvoice() {
  const [open, setOpen] = useState(false);
  const [work, setWork] = useState(null);
  const [amount, setAmount] = useState('');
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open]);
  const pickWork = (h) => {
    setWork(h);
    if (h && h.cents > 0) setAmount((h.cents / 100).toLocaleString());
  };
  const label = { fontSize:11, fontWeight:650, letterSpacing:'.05em', textTransform:'uppercase',
    color:'#86868b', display:'block', marginBottom:6 };
  const input = { background:'#fff', border:'1px solid #e8e8ed', borderRadius:10, height:36,
    fontFamily:'inherit', fontSize:13.5, padding:'0 11px', width:'100%' };
  return <>
    <button className="btn" onClick={() => setOpen(true)}>New invoice</button>
    {open && <div onClick={() => setOpen(false)} style={{position:'fixed', inset:0, zIndex:80,
      background:'rgba(0,0,0,.42)', backdropFilter:'blur(6px)', display:'flex',
      alignItems:'center', justifyContent:'center', padding:24}}>
      <div onClick={(e) => e.stopPropagation()} style={{background:'#fff', borderRadius:16,
        width:'min(560px, 96vw)', maxHeight:'92vh', overflowY:'auto',
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
          <div>
            <span style={label}>Collector</span>
            <CollectorPicker required placeholder="Search the book…"/>
          </div>
          <div>
            <span style={label}>Work</span>
            <WorkPicker onPick={pickWork}/>
            <span style={{fontSize:11.5, color:'#86868b', display:'block', marginTop:5}}>Search inventory, or leave empty for a free-form line</span>
          </div>
          {!work && <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
            <div><span style={label}>Description</span><input style={input} name="title" placeholder="What is being billed"/></div>
            <div><span style={label}>Artist</span><input style={input} name="artist" placeholder="Optional"/></div>
          </div>}
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:10}}>
            <div><span style={label}>Amount</span>
              <label className="money" style={{width:'100%'}}><span>$</span>
                <input name="amount" inputMode="numeric" required value={amount}
                  onChange={(e) => setAmount(e.target.value)} placeholder="0" style={{width:'100%'}}/></label></div>
            <div><span style={label}>Tax</span>
              <label className="money" style={{width:'100%'}}><span>$</span>
                <input name="tax" inputMode="numeric" placeholder="0" style={{width:'100%'}}/></label></div>
            <div><span style={label}>Shipping</span>
              <label className="money" style={{width:'100%'}}><span>$</span>
                <input name="shipping" inputMode="numeric" placeholder="0" style={{width:'100%'}}/></label></div>
            <div><span style={label}>Due</span><input style={input} name="due" type="date"/></div>
          </div>
          {work && <div style={{fontSize:12, color:'#86868b'}}>
            Paying this invoice in full marks “{work.title}” sold and books it to the collector automatically.</div>}
          <div style={{display:'flex', justifyContent:'flex-end'}}>
            <button className="btn">Create invoice</button>
          </div>
        </form>
      </div>
    </div>}
  </>;
}
