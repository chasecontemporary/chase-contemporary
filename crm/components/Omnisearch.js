'use client';
import { useEffect, useRef, useState } from 'react';

// Global find box for the landing page: one field, collectors and works together.
const usd = (c) => '$' + Math.round((c || 0) / 100).toLocaleString();

export default function Omnisearch() {
  const [q, setQ] = useState('');
  const [cols, setCols] = useState([]);
  const [works, setWorks] = useState([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const seq = useRef(0);

  useEffect(() => {
    if (q.trim().length < 2) { setCols([]); setWorks([]); setOpen(false); return; }
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      const [c, w] = await Promise.all([
        fetch('/api/collectors?q=' + encodeURIComponent(q)).then(r => r.json()).catch(() => []),
        fetch('/api/works?q=' + encodeURIComponent(q)).then(r => r.json()).catch(() => []),
      ]);
      if (mine !== seq.current) return;
      setCols(c.slice(0, 5)); setWorks(w.slice(0, 5)); setOpen(true);
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const close = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    const key = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('click', close);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('click', close); document.removeEventListener('keydown', key); };
  }, []);

  const head = { fontSize:10.5, fontWeight:700, letterSpacing:'.07em', textTransform:'uppercase',
    color:'#73736c', padding:'8px 12px 4px' };
  const row = { display:'flex', alignItems:'center', gap:10, padding:'8px 12px',
    textDecoration:'none', color:'inherit', borderRadius:2 };

  return <div ref={boxRef} style={{position:'relative', maxWidth:520, marginTop:16}}>
    <input value={q} onChange={e => setQ(e.target.value)} onFocus={() => (cols.length || works.length) && setOpen(true)}
      placeholder="Find a collector or a work…"
      style={{width:'100%', height:38, border:'1px solid #e3e3dd', borderRadius:2, background:'#fff',
        fontFamily:'inherit', fontSize:13.5, padding:'0 14px', outline:'none',
        boxShadow:'0 1px 2px rgba(0,0,0,.03)'}}/>
    {open && (cols.length > 0 || works.length > 0) && <div style={{position:'absolute', top:44, left:0,
      right:0, zIndex:70, background:'#fff', border:'1px solid #e3e3dd', borderRadius:3,
      boxShadow:'0 12px 40px rgba(0,0,0,.14)', padding:6, maxHeight:420, overflowY:'auto'}}>
      {cols.length > 0 && <div style={head}>Collectors</div>}
      {cols.map(c => <a key={c.id} href={'/collectors/' + c.id} style={row}
        onMouseEnter={e => e.currentTarget.style.background = '#f2f2ee'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
        <span style={{flex:1, minWidth:0}}>
          <span style={{fontSize:13.5, fontWeight:600}}>{c.name}</span>
          {c.sub && <span style={{fontSize:12, color:'#73736c'}}> · {c.sub}</span>}
        </span>
        {c.spend > 0 && <span style={{fontSize:12, fontWeight:650, fontVariantNumeric:'tabular-nums',
          color:'#2e6b3f'}}>{usd(c.spend)}</span>}
      </a>)}
      {works.length > 0 && <div style={head}>Works on hand</div>}
      {works.map(w => <a key={w.id} href={'/inventory/' + w.id} style={row}
        onMouseEnter={e => e.currentTarget.style.background = '#f2f2ee'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
        {w.img ? <img src={w.img} alt="" style={{width:28, height:28, objectFit:'cover', borderRadius:2}}/>
          : <span style={{width:28, height:28, borderRadius:2, background:'#eeeee9'}}/>}
        <span style={{flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
          <span style={{fontSize:13.5, fontWeight:600, fontStyle:'italic'}}>{w.title}</span>
          {w.artist && <span style={{fontSize:12, color:'#73736c'}}> · {w.artist}</span>}
        </span>
        <span style={{fontSize:12, fontWeight:650, fontVariantNumeric:'tabular-nums'}}>
          {w.cents > 0 ? (w.est ? 'est ' : '') + usd(w.cents) : 'POR'}</span>
      </a>)}
    </div>}
  </div>;
}
