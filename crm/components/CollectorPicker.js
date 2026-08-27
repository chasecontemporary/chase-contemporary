'use client';
import { useRef, useState } from 'react';

// Search-as-you-type collector picker: sets a hidden collector_id for the form.
export default function CollectorPicker({ name = 'collector_id', placeholder = 'Collector…', required = false }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState([]);
  const [picked, setPicked] = useState(null);
  const t = useRef();
  const search = (v) => {
    setQ(v); setPicked(null);
    clearTimeout(t.current);
    if (v.length < 2) { setHits([]); return; }
    t.current = setTimeout(async () => {
      const r = await fetch('/api/collectors?q=' + encodeURIComponent(v)).then(x => x.json());
      setHits(r);
    }, 180);
  };
  return <span style={{position:'relative', display:'inline-block', minWidth:230, flex:1}}>
    <input type="hidden" name={name} value={picked?.id || ''} required={required}/>
    <input value={picked ? picked.name : q} onChange={e => search(e.target.value)}
      placeholder={placeholder} required={required && !picked}
      style={{width:'100%', background:'#fff', border:'1px solid #e8e8ed', borderRadius:10, height:36,
        fontFamily:'inherit', fontSize:13.5, padding:'0 11px'}}/>
    {!picked && hits.length > 0 && <span style={{position:'absolute', top:40, left:0, right:0, zIndex:40,
      background:'#fff', border:'1px solid #e8e8ed', borderRadius:12, boxShadow:'0 10px 30px rgba(0,0,0,.12)',
      overflow:'hidden', display:'block'}}>
      {hits.map(h => <button key={h.id} type="button" onClick={() => { setPicked(h); setHits([]); }}
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
