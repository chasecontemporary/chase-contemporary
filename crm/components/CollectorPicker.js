'use client';
import { useEffect, useRef, useState } from 'react';
import { pickerInput, pickerChevron, pickerMenu } from './pickerShared';

// Collector dropdown-search: opens on click with the top of the book, filters as you type.
export default function CollectorPicker({ name = 'collector_id', placeholder = 'Choose a collector…', required = false }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState([]);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState(null);
  const t = useRef();
  const rootRef = useRef(null);
  useEffect(() => {
    const away = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    const key = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('mousedown', away);
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('mousedown', away); window.removeEventListener('keydown', key); };
  }, []);
  const load = (v) => {
    clearTimeout(t.current);
    t.current = setTimeout(async () => {
      const r = await fetch('/api/collectors?q=' + encodeURIComponent(v)).then(x => x.json());
      setHits(r); setOpen(true);
    }, v ? 160 : 0);
  };
  const search = (v) => { setQ(v); setPicked(null); load(v); };
  const focus = () => { if (!picked) load(q); };
  return <span ref={rootRef} style={{position:'relative', display:'block'}}>
    <input type="hidden" name={name} value={picked?.id || ''} required={required}/>
    <input value={picked ? picked.name : q} onChange={e => search(e.target.value)} onFocus={focus}
      onClick={() => { if (picked) { setPicked(null); setQ(''); load(''); } }}
      placeholder={placeholder} required={required && !picked} style={pickerInput}/>
    <svg width="10" height="6" viewBox="0 0 10 6" style={pickerChevron}>
      <path d="M1 1l4 4 4-4" fill="none" stroke="#6e6e73" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
    {open && !picked && hits.length > 0 && <span style={pickerMenu}>
      {hits.map(h => <button key={h.id} type="button" onClick={() => { setPicked(h); setOpen(false); }}
        style={{display:'block', width:'100%', textAlign:'left', padding:'9px 12px', background:'#fff',
          border:0, borderBottom:'1px solid #f5f5f7', cursor:'pointer', fontFamily:'inherit'}}>
        <span style={{fontSize:13, fontWeight:600}}>{h.name}</span>
        {h.spend > 0 && <span style={{fontSize:11, color:'#1d7a3d', fontWeight:700, marginLeft:8}}>
          ${Math.round(h.spend / 100).toLocaleString()} LTV</span>}
        <span style={{display:'block', fontSize:11.5, color:'#86868b'}}>{h.sub}</span>
      </button>)}
    </span>}
  </span>;
}
