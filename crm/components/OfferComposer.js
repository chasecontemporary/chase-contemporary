'use client';
import { useEffect, useState } from 'react';
import WorkPicker from './WorkPicker';
import BrandSelect from './BrandSelect';

// Compose a private selection: pick 1-10 works, set special prices if any,
// add a personal note, get a tracked link to text or email.
const usd = (n) => '$' + Math.round(n || 0).toLocaleString();

export default function OfferComposer({ collectorId, collectorName, defaultWork, quiet }) {
  const [open, setOpen] = useState(false);
  const [works, setWorks] = useState(() => defaultWork ? [{
    id: defaultWork.id, title: defaultWork.title, artist: defaultWork.artist,
    img: defaultWork.image_url ? defaultWork.image_url + (defaultWork.image_url.includes('?') ? '&' : '?') + 'width=88' : null,
    list: Number(defaultWork.price_cents || 0), price: '',
  }] : []);
  const first = (collectorName || '').split(' ')[0];
  const [title, setTitle] = useState(first ? `A selection for ${first}` : 'A private selection');
  const [note, setNote] = useState('');
  const [days, setDays] = useState('14');
  const [link, setLink] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open]);
  const label = { fontSize:11, fontWeight:650, letterSpacing:'.05em', textTransform:'uppercase',
    color:'#73736c', display:'block', marginBottom:6 };
  const input = { background:'#fff', border:'1px solid #e3e3dd', borderRadius:2, height:36,
    fontFamily:'inherit', fontSize:13.5, padding:'0 11px', width:'100%', outline:'none' };
  const num = (x) => Number(String(x || '0').replace(/[$,\s]/g, '')) || 0;

  const create = async () => {
    setBusy(true);
    const fd = new FormData();
    fd.set('action', 'offer_create');
    fd.set('id', collectorId);
    fd.set('title', title);
    fd.set('note', note);
    fd.set('expires_days', days);
    fd.set('items', JSON.stringify(works.map(w => ({ id: w.id,
      price_cents: num(w.price) > 0 ? num(w.price) * 100 : null }))));
    const r = await fetch('/api/act', { method: 'POST', body: fd }).then(x => x.json()).catch(() => null);
    setBusy(false);
    if (r?.url) {
      try { await navigator.clipboard.writeText(r.url); } catch {}
      setLink(r.url);
    }
  };

  return <>
    <button className={'btn mini' + (quiet ? ' quiet' : '')} onClick={() => setOpen(true)}>Send a selection</button>
    {open && <div onClick={() => setOpen(false)} style={{position:'fixed', inset:0, zIndex:80,
      background:'rgba(0,0,0,.42)', backdropFilter:'blur(6px)', display:'flex',
      alignItems:'center', justifyContent:'center', padding:24}}>
      <div onClick={(e) => e.stopPropagation()} style={{background:'#fff', borderRadius:2,
        width:'min(620px, 96vw)', maxHeight:'92vh', overflowY:'auto',
        boxShadow:'0 24px 80px rgba(0,0,0,.3)'}}>
        <div style={{padding:'16px 20px', borderBottom:'1px solid #eeeee9', display:'flex',
          alignItems:'center', justifyContent:'space-between'}}>
          <div style={{fontSize:15, fontWeight:700}}>Private selection for {collectorName || 'this collector'}</div>
          <button onClick={() => setOpen(false)} className="btn mini quiet">Close</button>
        </div>
        {link
          ? <div style={{padding:'22px 20px'}}>
              <div style={{fontSize:13.5, color:'#2e6b3f', fontWeight:650}}>Link copied — paste it into a text or email.</div>
              <div style={{fontSize:12.5, color:'#2257c5', wordBreak:'break-all', marginTop:8}}>
                <a href={link} target="_blank">{link}</a></div>
              <div style={{fontSize:12, color:'#73736c', marginTop:12, lineHeight:1.6}}>
                You&apos;ll see when they open it on Today and on their collector card.
                If they tap &ldquo;I&apos;m interested&rdquo; on a work, it lands in the Pipeline
                assigned to you.</div>
              <div style={{display:'flex', justifyContent:'flex-end', marginTop:16}}>
                <button className="btn mini quiet" onClick={() => setOpen(false)}>Done</button>
              </div>
            </div>
          : <div style={{padding:'18px 20px', display:'flex', flexDirection:'column', gap:16}}>
            <div>
              <span style={label}>Works · up to 10</span>
              <div style={{display:'flex', flexDirection:'column', gap:8}}>
                {works.map(w => <div key={w.id} style={{display:'grid',
                  gridTemplateColumns:'34px 1fr 150px 28px', gap:10, alignItems:'center'}}>
                  {w.img ? <img src={w.img} alt="" style={{width:34, height:34, objectFit:'cover', borderRadius:2}}/>
                    : <span style={{width:34, height:34, borderRadius:2, background:'#eeeee9'}}/>}
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:13, fontWeight:650, overflow:'hidden', textOverflow:'ellipsis',
                      whiteSpace:'nowrap'}}>{w.title}</div>
                    <div style={{fontSize:11.5, color:'#73736c'}}>{w.artist}
                      {w.list > 0 ? ` · shows ${usd(w.list / 100)}` : ' · shows Price on request'}</div>
                  </div>
                  <label className="money" style={{width:'100%'}}><span>$</span>
                    <input inputMode="numeric" placeholder="Special price" value={w.price}
                      onChange={(e) => setWorks(ws => ws.map(x => x.id === w.id ? { ...x, price: e.target.value } : x))}
                      style={{width:'100%'}}/></label>
                  <button type="button" onClick={() => setWorks(ws => ws.filter(x => x.id !== w.id))}
                    style={{background:'none', border:0, color:'#c2c2bb', fontSize:16, cursor:'pointer'}}>×</button>
                </div>)}
                {works.length < 10 && <WorkPicker onPick={(h) => { if (h && !works.find(w => w.id === h.id))
                  setWorks(ws => [...ws, { id: h.id, title: h.title, artist: h.artist, img: h.img,
                    list: Number(h.cents || 0), price: '' }]); }}/>}
              </div>
              <div style={{fontSize:12, color:'#73736c', marginTop:8}}>
                Each work shows its list price. Type a special price to show that instead — leave blank to keep the list price.</div>
            </div>
            <div>
              <span style={label}>Page title</span>
              <input style={input} value={title} onChange={e => setTitle(e.target.value)}/>
            </div>
            <div>
              <span style={label}>Personal note · shows under the title</span>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
                placeholder={'Thought of you when these came in.' + (first ? ` — for ${first}` : '')}
                style={{...input, height:'auto', padding:'10px 11px', resize:'vertical', lineHeight:1.6}}/>
            </div>
            <div style={{display:'flex', alignItems:'end', justifyContent:'space-between', gap:12}}>
              <div>
                <span style={label}>Link stops working after</span>
                <BrandSelect options={[['7','7 days'],['14','14 days'],['30','30 days'],['90','90 days']]}
                  value={days} onValue={setDays} width={130}/>
              </div>
              <button className="btn" disabled={!works.length || busy}
                style={!works.length || busy ? {opacity:.4} : {}}
                onClick={create}>Create the link</button>
            </div>
          </div>}
      </div>
    </div>}
  </>;
}
