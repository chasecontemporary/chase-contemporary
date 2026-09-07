'use client';
import { useEffect, useState } from 'react';

// Document preview: thumbnail card in the page -> modal with the full document,
// download, email, and signature. `sign` = { kind, invoiceId?, artworkId?, collectorId?,
// ready } turns on Send for signature (DocuSign) when the integration is connected.
export default function DocPreview({ url, label, compact = false, thumb = false, sign = null, signed = null }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open]);
  const dl = url + (url.includes('?') ? '&' : '?') + 'download=1';
  const mail = 'mailto:?subject=' + encodeURIComponent(label + ' from Chase Contemporary')
    + '&body=' + encodeURIComponent('Please find the ' + label.toLowerCase() + ' linked here:\n\n' + url + '\n\nChase Contemporary\ninfo@chasecontemporary.com');
  const openModal = (e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); };
  const sendSign = async () => {
    if (!sign?.ready || busy) return;
    if (!window.confirm(`Send the ${label.toLowerCase()} to the collector for signature through DocuSign?`)) return;
    setBusy(true); setMsg(null);
    const fd = new FormData();
    fd.set('action', 'doc_sign'); fd.set('kind', sign.kind); fd.set('url', url); fd.set('name', label); fd.set('back', 'json');
    if (sign.invoiceId) fd.set('invoice_id', sign.invoiceId);
    if (sign.artworkId) fd.set('artwork_id', sign.artworkId);
    if (sign.collectorId) fd.set('collector_id', sign.collectorId);
    const r = await fetch('/api/act', { method: 'POST', body: fd }).then(x => x.json()).catch(() => ({ ok: false, error: 'Network error' }));
    setBusy(false);
    setMsg(r.ok ? 'Sent for signature. Status lands on the record as they open and sign it.' : (r.error || 'That did not send.'));
  };
  return <>
    {thumb
      ? <button onClick={openModal} title={label} style={{width:42, height:54, padding:0, overflow:'hidden',
          borderRadius:2, border:'1px solid #e3e3dd', background:'#fff', cursor:'zoom-in', position:'relative', display:'block'}}>
          <iframe src={url + '#toolbar=0&navpanes=0&scrollbar=0'} title={label} tabIndex={-1}
            style={{width:612, height:792, transform:'scale(0.066)', transformOrigin:'0 0', border:0, pointerEvents:'none'}}/>
        </button>
      : compact
      ? <button onClick={() => setOpen(true)} className="pill" style={{background:'#fff',
          border:'1px solid #e3e3dd', cursor:'pointer', fontFamily:'inherit', fontSize:12}}>{label}</button>
      : <button onClick={() => setOpen(true)} style={{background:'#fff', border:'1px solid #e3e3dd',
          borderRadius:2, padding:8, cursor:'pointer', fontFamily:'inherit', textAlign:'center', display:'inline-block'}}>
          <span style={{display:'block', width:92, height:119, overflow:'hidden', borderRadius:2,
            border:'1px solid #eeeee9', position:'relative', background:'#fff', margin:'0 auto'}}>
            <iframe src={url + '#toolbar=0&navpanes=0&scrollbar=0'} title={label} tabIndex={-1}
              style={{width:612, height:792, transform:'scale(0.151)', transformOrigin:'0 0',
                border:0, pointerEvents:'none'}}/>
          </span>
          <span style={{display:'block', fontSize:11, fontWeight:650, marginTop:6}}>{label}</span>
          {signed && <span style={{display:'block', fontSize:10, fontWeight:700, color:'#2e6b3f', letterSpacing:'.04em'}}>SIGNED</span>}
        </button>}
    {open && <div onClick={() => setOpen(false)} style={{position:'fixed', inset:0, zIndex:80,
      background:'rgba(0,0,0,.42)', backdropFilter:'blur(6px)', display:'flex',
      alignItems:'center', justifyContent:'center', padding:24}}>
      <div onClick={(e) => e.stopPropagation()} style={{background:'#fff', borderRadius:2,
        width:'min(760px, 96vw)', maxHeight:'92vh', display:'flex', flexDirection:'column',
        overflow:'hidden', boxShadow:'0 24px 80px rgba(0,0,0,.3)'}}>
        <div style={{display:'flex', alignItems:'center', gap:8, padding:'12px 16px',
          borderBottom:'1px solid #eeeee9', flexWrap:'wrap'}}>
          <div style={{fontSize:13.5, fontWeight:650, flex:1}}>{label}</div>
          <a className="btn mini quiet" href={dl}>Download</a>
          <a className="btn mini quiet" href={mail}>Email draft</a>
          {signed
            ? <a className="btn mini quiet" href={signed} target="_blank" style={{color:'#2e6b3f'}}>Signed copy</a>
            : sign && <button className="btn mini" disabled={!sign.ready || busy} onClick={sendSign}
                title={sign.ready ? 'Send through DocuSign' : 'DocuSign is not connected yet'}
                style={!sign.ready ? {background:'#eeeee9', color:'#73736c', cursor:'not-allowed'} : {}}>
                {busy ? 'Sending…' : 'Send for signature'}</button>}
          <button onClick={() => setOpen(false)} className="btn mini quiet">Close</button>
        </div>
        <iframe src={url + '#toolbar=0'} title={label} style={{border:0, width:'100%', height:'76vh'}}/>
        <div style={{padding:'8px 16px', fontSize:11, color: msg ? '#1a1a18' : '#73736c', borderTop:'1px solid #eeeee9', fontWeight: msg ? 600 : 400}}>
          {msg || (sign?.ready ? 'Send for signature goes to the collector through DocuSign; the executed copy lands on their record.' : 'Email draft opens in your mail client. Signature on record activates when DocuSign connects.')}</div>
      </div>
    </div>}
  </>;
}
