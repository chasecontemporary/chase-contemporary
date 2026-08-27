'use client';
import { useRef, useState } from 'react';

// Search-as-you-type work picker over available inventory. Sets hidden artwork_id.
export default function WorkPicker({ name = 'artwork_id', placeholder = 'Search title or artist…', onPick }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState([]);
  const [picked, setPicked] = useState(null);
  const t = useRef();
  const search = (v) => {
    setQ(v); setPicked(null); onPick?.(null);
    clearTimeout(t.current);
    if (v.length < 2) { setHits([]); return; }
    t.current = setTimeout(async () => {
      const r = await fetch('/api/works?q=' + encodeURIComponent(v)).then(x => x.json());
      setHits(r);
    }, 180);
  };
  const choose = (h) => { setPicked(h); setHits([]); onPick?.(h); };
  return <span style={{position:'relative', display:'block'}}>
    <input type="hidden" name={name} value={picked?.id || ''}/>
    <input value={picked ? `${picked.title} — ${picked.artist}` : q} onChange={e => search(e.target.value)}
      placeholder={placeholder}
      style={{width:'100%', background:'#fff', border:'1px solid #e8e8ed', borderRadius:10, height:36,
        fontFamily:'inherit', fontSize:13.5, padding:'0 11px'}}/>
    {!picked && hits.length > 0 && <span style={{position:'absolute', top:40, left:0, right:0, zIndex:95,
      background:'#fff', border:'1px solid #ececf0', borderRadius:12, boxShadow:'0 12px 40px rgba(0,0,0,.14)',
      overflow:'hidden', display:'block'}}>
      {hits.map(h => <button key={h.id} type="button" onClick={() => choose(h)}
        style={{display:'flex', width:'100%', gap:10, alignItems:'center', textAlign:'left',
          padding:'8px 10px', background:'#fff', border:0, borderBottom:'1px solid #f5f5f7',
          cursor:'pointer', fontFamily:'inherit'}}>
        {h.img ? <img src={h.img} alt="" style={{width:34, height:34, objectFit:'cover', borderRadius:6, flex:'0 0 auto'}}/>
          : <span style={{width:34, height:34, borderRadius:6, background:'#f0f0f2', flex:'0 0 auto'}}/>}
        <span style={{minWidth:0, flex:1}}>
          <span style={{display:'block', fontSize:13, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{h.title}</span>
          <span style={{display:'block', fontSize:11.5, color:'#86868b'}}>{h.artist}</span>
        </span>
        {h.cents > 0 && <span style={{fontSize:12, fontWeight:700, fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap'}}>
          ${Math.round(h.cents / 100).toLocaleString()}{h.est ? <span style={{color:'#86868b', fontWeight:500}}> est</span> : ''}</span>}
      </button>)}
    </span>}
  </span>;
}
