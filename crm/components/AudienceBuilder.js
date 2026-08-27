'use client';
import { useEffect, useRef, useState } from 'react';
import BrandSelect from './BrandSelect';

// Audience builder with a live reach count — see who you're talking to before you save.
const SEGS = [['all','Everyone'],['buyers','Buyers'],['active','Active pipeline'],['trade','Trade'],['vip','VIP list']];
const MINS = [['','Any lifetime'],['10000','$10k+'],['50000','$50k+'],['100000','$100k+'],['250000','$250k+']];

export default function AudienceBuilder({ artists = [] }) {
  const [seg, setSeg] = useState('all');
  const [artist, setArtist] = useState('');
  const [min, setMin] = useState('');
  const [consented, setConsented] = useState(true);
  const [count, setCount] = useState(null);
  const t = useRef();
  useEffect(() => {
    clearTimeout(t.current);
    t.current = setTimeout(async () => {
      const p = new URLSearchParams({ seg, artist, min_spend: min, consented: String(consented) });
      const r = await fetch('/api/audience-count?' + p).then(x => x.json()).catch(() => null);
      if (r) setCount(r.count);
    }, 250);
  }, [seg, artist, min, consented]);
  return <form method="POST" action="/api/act" className="card" style={{marginTop:14}}>
    <input type="hidden" name="action" value="audience_add"/>
    <input type="hidden" name="back" value="/audiences"/>
    <input type="hidden" name="seg" value={seg}/>
    <input type="hidden" name="artist" value={artist}/>
    <input type="hidden" name="min_spend" value={min}/>
    <input type="hidden" name="consented" value={consented ? 'true' : ''}/>
    <div className="cardtitle">Build an audience</div>
    <div style={{display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}>
      <BrandSelect options={SEGS} value={seg} onValue={setSeg}/>
      <BrandSelect options={[['', 'Any artist interest'], ...artists.map(a => [a, a])]} value={artist} onValue={setArtist}/>
      <BrandSelect options={MINS} value={min} onValue={setMin}/>
      <label style={{display:'flex', gap:6, alignItems:'center', fontSize:12.5, color:'#3a3a35'}}>
        <input type="checkbox" checked={consented} onChange={(e) => setConsented(e.target.checked)}/> Newsletter-consented only
      </label>
    </div>
    <div style={{display:'flex', gap:10, alignItems:'center', marginTop:14, flexWrap:'wrap'}}>
      <div style={{fontSize:13.5}}>
        Reaches <b style={{fontVariantNumeric:'tabular-nums', color:'#2257c5'}}>{count === null ? '…' : count.toLocaleString()}</b> collectors right now
      </div>
      <div style={{marginLeft:'auto', display:'flex', gap:8, alignItems:'center'}}>
        <input name="name" placeholder="Name this audience…" required
          style={{border:'1px solid #e3e3dd', borderRadius:2, height:36, fontFamily:'inherit', fontSize:13, padding:'0 12px', width:220}}/>
        <button className="btn mini">Save audience</button>
      </div>
    </div>
  </form>;
}
