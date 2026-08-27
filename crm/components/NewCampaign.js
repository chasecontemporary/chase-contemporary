'use client';
import { useEffect, useState } from 'react';
import BrandSelect from './BrandSelect';
import WorkPicker from './WorkPicker';
import { renderCampaignEmail } from '../lib/email';

// Campaign composer, MoaOS-style: fields on the left, the live email on the right.
export default function NewCampaign({ audiences = [] }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState('drop');
  const [audienceId, setAudienceId] = useState('');
  const [subject, setSubject] = useState('');
  const [preheader, setPreheader] = useState('');
  const [body, setBody] = useState('');
  const [works, setWorks] = useState([]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open]);
  const addWork = (h) => { if (h && !works.find(w => w.id === h.id)) setWorks(ws => [...ws, h]); };
  const html = renderCampaignEmail({
    campaign: { name, kind, subject: subject || name || 'Subject line', preheader, body },
    artworks: works.map(w => ({ handle: null, image_url: w.img ? w.img.replace('width=88', 'width=1200') : null,
      title: w.title, artist: w.artist, price_cents: w.cents })),
  });
  const label = { fontSize:11, fontWeight:650, letterSpacing:'.05em', textTransform:'uppercase',
    color:'#86868b', display:'block', marginBottom:6 };
  const input = { background:'#fff', border:'1px solid #e8e8ed', borderRadius:10, height:36,
    fontFamily:'inherit', fontSize:13.5, padding:'0 11px', width:'100%' };
  return <>
    <button className="btn" onClick={() => setOpen(true)}>New campaign</button>
    {open && <div onClick={() => setOpen(false)} style={{position:'fixed', inset:0, zIndex:80,
      background:'rgba(0,0,0,.42)', backdropFilter:'blur(6px)', display:'flex',
      alignItems:'center', justifyContent:'center', padding:20}}>
      <div onClick={(e) => e.stopPropagation()} style={{background:'#fff', borderRadius:16,
        width:'min(1060px, 97vw)', height:'min(760px, 94vh)', display:'flex', flexDirection:'column',
        overflow:'hidden', boxShadow:'0 24px 80px rgba(0,0,0,.3)'}}>
        <div style={{padding:'14px 20px', borderBottom:'1px solid #f0f0f2', display:'flex',
          alignItems:'center', justifyContent:'space-between'}}>
          <div style={{fontSize:15, fontWeight:700}}>New campaign</div>
          <button onClick={() => setOpen(false)} className="btn mini quiet">Close</button>
        </div>
        <div style={{display:'grid', gridTemplateColumns:'minmax(360px, 44%) 1fr', flex:1, minHeight:0}}>
          <form method="POST" action="/api/act" style={{padding:'18px 20px', display:'flex',
            flexDirection:'column', gap:16, overflowY:'auto', borderRight:'1px solid #f0f0f2'}}>
            <input type="hidden" name="action" value="campaign_add"/>
            <input type="hidden" name="back" value="/campaigns"/>
            {works.map(w => <input key={w.id} type="hidden" name="artwork_ids" value={w.id}/>)}
            <div>
              <span style={label}>Campaign</span>
              <div style={{display:'flex', gap:8}}>
                <input style={{...input, flex:1}} name="name" placeholder="Internal name (e.g. Pelé Drop 09/26)"
                  value={name} onChange={(e) => setName(e.target.value)} required/>
                <BrandSelect name="kind" options={[['drop','Drop'],['newsletter','Newsletter'],['oneoff','One-off']]}
                  value={kind} onValue={setKind}/>
              </div>
            </div>
            <div>
              <span style={label}>Audience</span>
              <BrandSelect name="audience_id" placeholder="Who receives this…" width="100%"
                options={audiences.map(a => [a.id, `${a.name} · ${a.count.toLocaleString()}`])}
                value={audienceId} onValue={setAudienceId}/>
            </div>
            <div>
              <span style={label}>Subject line</span>
              <input style={input} name="subject" value={subject} onChange={(e) => setSubject(e.target.value)} required/>
              <input style={{...input, marginTop:8}} name="preheader" placeholder="Preheader — the inbox preview text"
                value={preheader} onChange={(e) => setPreheader(e.target.value)}/>
            </div>
            <div>
              <span style={label}>The story</span>
              <textarea name="body" rows={5} value={body} onChange={(e) => setBody(e.target.value)}
                placeholder="Short paragraphs. Renders in the editorial style above the works."
                style={{...input, height:'auto', padding:'10px 11px', resize:'vertical', lineHeight:1.6}}/>
            </div>
            <div>
              <span style={label}>Works · {works.length}</span>
              <WorkPicker name="_ignore" onPick={addWork} placeholder="Add a work from inventory…"/>
              <div style={{display:'flex', flexDirection:'column', gap:6, marginTop:10}}>
                {works.map(w => <div key={w.id} style={{display:'flex', gap:10, alignItems:'center',
                  border:'1px solid #f0f0f2', borderRadius:10, padding:'6px 10px'}}>
                  {w.img ? <img src={w.img} alt="" style={{width:30, height:30, objectFit:'cover', borderRadius:6}}/>
                    : <span style={{width:30, height:30, borderRadius:6, background:'#f0f0f2'}}/>}
                  <span style={{flex:1, minWidth:0, fontSize:12.5, fontWeight:600, overflow:'hidden',
                    textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{w.title} <span style={{color:'#86868b', fontWeight:400}}>· {w.artist}</span></span>
                  <button type="button" onClick={() => setWorks(ws => ws.filter(x => x.id !== w.id))}
                    style={{background:'none', border:0, color:'#c7c7cc', fontSize:15, cursor:'pointer'}}>×</button>
                </div>)}
              </div>
            </div>
            <div style={{marginTop:'auto', display:'flex', justifyContent:'flex-end', paddingTop:8}}>
              <button className="btn">Save draft</button>
            </div>
          </form>
          <div style={{background:'#f5f5f7', display:'flex', flexDirection:'column', minHeight:0}}>
            <div style={{padding:'10px 16px', fontSize:11, fontWeight:650, letterSpacing:'.06em',
              textTransform:'uppercase', color:'#86868b'}}>Live preview — what lands in the inbox</div>
            <iframe srcDoc={html} title="preview" style={{flex:1, border:0, width:'100%', background:'#fff'}}/>
          </div>
        </div>
      </div>
    </div>}
  </>;
}
