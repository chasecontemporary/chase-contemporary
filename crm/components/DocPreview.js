'use client';
import { useEffect, useState } from 'react';

// Document preview: thumbnail card in the page -> modal with the full document,
// download, and email-send. Signature via DocuSign wires in here later.
export default function DocPreview({ url, label, compact = false, thumb = false }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open]);
  const dl = url + (url.includes('?') ? '&' : '?') + 'download=1';
  const mail = 'mailto:?subject=' + encodeURIComponent(label + ' — Chase Contemporary')
    + '&body=' + encodeURIComponent('Please find the ' + label.toLowerCase() + ' linked here:\n\n' + url + '\n\nChase Contemporary\ninfo@chasecontemporary.com');
  const openModal = (e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); };
  return <>
    {thumb
      ? <button onClick={openModal} title={label} style={{width:42, height:54, padding:0, overflow:'hidden',
          borderRadius:6, border:'1px solid #e8e8ed', background:'#fff', cursor:'zoom-in', position:'relative', display:'block'}}>
          <iframe src={url + '#toolbar=0&navpanes=0&scrollbar=0'} title={label} tabIndex={-1}
            style={{width:612, height:792, transform:'scale(0.066)', transformOrigin:'0 0', border:0, pointerEvents:'none'}}/>
        </button>
      : compact
      ? <button onClick={() => setOpen(true)} className="pill" style={{background:'#fff',
          border:'1px solid #e8e8ed', cursor:'pointer', fontFamily:'inherit', fontSize:12}}>{label}</button>
      : <button onClick={() => setOpen(true)} style={{background:'#fff', border:'1px solid #e8e8ed',
          borderRadius:10, padding:8, cursor:'pointer', fontFamily:'inherit', textAlign:'center', display:'inline-block'}}>
          <span style={{display:'block', width:92, height:119, overflow:'hidden', borderRadius:6,
            border:'1px solid #f0f0f2', position:'relative', background:'#fff', margin:'0 auto'}}>
            <iframe src={url + '#toolbar=0&navpanes=0&scrollbar=0'} title={label} tabIndex={-1}
              style={{width:612, height:792, transform:'scale(0.151)', transformOrigin:'0 0',
                border:0, pointerEvents:'none'}}/>
          </span>
          <span style={{display:'block', fontSize:11, fontWeight:650, marginTop:6}}>{label}</span>
        </button>}
    {open && <div onClick={() => setOpen(false)} style={{position:'fixed', inset:0, zIndex:80,
      background:'rgba(0,0,0,.42)', backdropFilter:'blur(6px)', display:'flex',
      alignItems:'center', justifyContent:'center', padding:24}}>
      <div onClick={(e) => e.stopPropagation()} style={{background:'#fff', borderRadius:16,
        width:'min(760px, 96vw)', maxHeight:'92vh', display:'flex', flexDirection:'column',
        overflow:'hidden', boxShadow:'0 24px 80px rgba(0,0,0,.3)'}}>
        <div style={{display:'flex', alignItems:'center', gap:8, padding:'12px 16px',
          borderBottom:'1px solid #f0f0f2'}}>
          <div style={{fontSize:13.5, fontWeight:650, flex:1}}>{label}</div>
          <a className="btn mini" href={dl}>Download</a>
          <a className="btn mini" href={mail}>Email to collector</a>
          <button className="btn mini" disabled title="DocuSign wiring is queued — signature on record comes with it"
            style={{background:'#f0f0f2', color:'#86868b', cursor:'not-allowed'}}>Send for signature</button>
          <button onClick={() => setOpen(false)} className="btn mini"
            style={{background:'#f0f0f2', color:'#1d1d1f'}}>Close</button>
        </div>
        <iframe src={url + '#toolbar=0'} title={label} style={{border:0, width:'100%', height:'76vh'}}/>
        <div style={{padding:'8px 16px', fontSize:11, color:'#86868b', borderTop:'1px solid #f0f0f2'}}>
          Email opens a draft in your mail client — nothing sends itself. Signature on record activates when DocuSign connects.</div>
      </div>
    </div>}
  </>;
}
