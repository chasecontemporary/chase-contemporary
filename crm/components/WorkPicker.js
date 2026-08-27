'use client';
import { useEffect, useRef, useState } from 'react';
import { pickerInput, pickerChevron, pickerMenu } from './pickerShared';

// Work dropdown-search over ON-HAND inventory only: opens on click with the most
// valuable available works, filters by title or artist as you type.
export default function WorkPicker({ name = 'artwork_id', placeholder = 'Choose a work on hand…', onPick }) {
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
      const r = await fetch('/api/works?q=' + encodeURIComponent(v)).then(x => x.json());
      setHits(r); setOpen(true);
    }, v ? 160 : 0);
  };
  const search = (v) => { setQ(v); setPicked(null); onPick?.(null); load(v); };
  const focus = () => { if (!picked) load(q); };
  const choose = (h) => { setPicked(h); setOpen(false); onPick?.(h); };
  return <span ref={rootRef} style={{position:'relative', display:'block'}}>
    <input type="hidden" name={name} value={picked?.id || ''}/>
    <input value={picked ? `${picked.title} — ${picked.artist}` : q} onChange={e => search(e.target.value)}
      onFocus={focus} onClick={() => { if (picked) { setPicked(null); onPick?.(null); setQ(''); load(''); } }}
      placeholder={placeholder} style={pickerInput}/>
    <svg width="10" height="6" viewBox="0 0 10 6" style={pickerChevron}>
      <path d="M1 1l4 4 4-4" fill="none" stroke="#73736c" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
    {open && !picked && hits.length > 0 && <span style={pickerMenu}>
      {hits.map(h => <button key={h.id} type="button" onClick={() => choose(h)}
        style={{display:'flex', width:'100%', gap:10, alignItems:'center', textAlign:'left',
          padding:'8px 10px', background:'#fff', border:0, borderBottom:'1px solid #f2f2ee',
          cursor:'pointer', fontFamily:'inherit'}}>
        {h.img ? <img src={h.img} alt="" style={{width:34, height:34, objectFit:'cover', borderRadius:2, flex:'0 0 auto'}}/>
          : <span style={{width:34, height:34, borderRadius:2, background:'#eeeee9', flex:'0 0 auto'}}/>}
        <span style={{minWidth:0, flex:1}}>
          <span style={{display:'block', fontSize:13, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{h.title}</span>
          <span style={{display:'block', fontSize:11.5, color:'#73736c'}}>{h.artist}</span>
        </span>
        {h.cents > 0 && <span style={{fontSize:12, fontWeight:700, fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap'}}>
          ${Math.round(h.cents / 100).toLocaleString()}{h.est ? <span style={{color:'#73736c', fontWeight:500}}> est</span> : ''}</span>}
      </button>)}
    </span>}
  </span>;
}
