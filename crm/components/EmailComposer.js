'use client';
import { useEffect, useState } from 'react';
import BrandSelect from './BrandSelect';

// Write to the collector from the record. Pick a template, add a line, see it, send it.
// When the gallery's email is connected it sends from the domain and logs on the record;
// until then the same text opens as a draft in the rep's own mail client. A text lane
// sits beside it for links.
export default function EmailComposer({ inquiryId, collectorId, invoiceId, defaultTemplate = 'first_reply',
  label = 'Email them', quiet = true, onSent }) {
  const [open, setOpen] = useState(false);
  const [tpl, setTpl] = useState(defaultTemplate);
  const [note, setNote] = useState('');
  const [preview, setPreview] = useState(null);
  const [subject, setSubject] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [mode, setMode] = useState('email');       // email | sms
  const [sms, setSms] = useState('');
  const [attachTear, setAttachTear] = useState(true);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      const p = new URLSearchParams({ template: tpl, note });
      if (inquiryId) p.set('inquiry_id', inquiryId);
      if (collectorId) p.set('collector_id', collectorId);
      if (invoiceId) p.set('invoice_id', invoiceId);
      const r = await fetch('/api/email?' + p).then(x => x.json()).catch(() => null);
      if (r) { setPreview(r); setSubject(r.subject); if (!sms && r.links) setSms(smsFor(tpl, r)); }
    }, 220);
    return () => clearTimeout(t);
  }, [open, tpl, note, inquiryId, collectorId, invoiceId]);   // eslint-disable-line react-hooks/exhaustive-deps

  const smsFor = (key, r) => {
    const L = r.links || {};
    if (key === 'selection' && L.selection) return `Chase Contemporary: a private selection for you ${L.selection}`;
    if (key === 'details_link' && L.details) return `Chase Contemporary: please confirm your details for the invoice here ${L.details}`;
    if (key === 'invoice' && L.pay) return `Chase Contemporary: your invoice is ready. Pay securely here ${L.pay}`;
    return '';
  };

  const send = async () => {
    if (busy) return;
    setBusy(true); setMsg(null);
    const fd = new FormData();
    if (mode === 'sms') {
      fd.set('action', 'sms_send'); fd.set('collector_id', collectorId || preview?.collector_id || '');
      fd.set('body', sms); fd.set('template', tpl); if (inquiryId) fd.set('inquiry_id', inquiryId);
    } else {
      fd.set('action', 'email_send'); fd.set('template', tpl); fd.set('note', note); fd.set('subject', subject);
      if (inquiryId) fd.set('inquiry_id', inquiryId);
      if (collectorId) fd.set('collector_id', collectorId);
      if (invoiceId) fd.set('invoice_id', invoiceId);
      if (attachTear) fd.set('attach_tearsheet', '1');
    }
    fd.set('back', 'json');
    const r = await fetch('/api/act', { method: 'POST', body: fd }).then(x => x.json()).catch(() => ({ ok: false, error: 'Network error' }));
    setBusy(false);
    if (r.ok) { setMsg('Sent. It is on their record.'); onSent?.(); setTimeout(() => window.location.reload(), 900); }
    else setMsg(r.error || 'That did not send.');
  };
  const draft = () => {
    if (!preview) return;
    const to = preview.to || '';
    window.open('mailto:' + to + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(preview.text || ''), '_self');
    setMsg('Draft opened in your mail client. Send it there; then log the call or move the stage.');
  };
  const label2 = { fontSize:11, fontWeight:650, letterSpacing:'.05em', textTransform:'uppercase', color:'#73736c', display:'block', marginBottom:6 };
  const input = { background:'#fff', border:'1px solid #e3e3dd', borderRadius:2, height:36, fontFamily:'inherit', fontSize:13.5, padding:'0 11px', width:'100%', outline:'none' };

  return <>
    <button className={'btn mini' + (quiet ? ' quiet' : '')} onClick={() => setOpen(true)}>{label}</button>
    {open && <div onClick={() => setOpen(false)} style={{position:'fixed', inset:0, zIndex:86, background:'rgba(0,0,0,.42)',
      backdropFilter:'blur(6px)', display:'flex', alignItems:'center', justifyContent:'center', padding:20}}>
      <div onClick={(e) => e.stopPropagation()} style={{background:'#fff', borderRadius:2, width:'min(820px, 96vw)', maxHeight:'92vh',
        display:'flex', flexDirection:'column', boxShadow:'0 24px 80px rgba(0,0,0,.3)', overflow:'hidden'}}>
        <div style={{padding:'14px 20px', borderBottom:'1px solid #eeeee9', display:'flex', alignItems:'center', gap:12}}>
          <div style={{fontSize:15, fontWeight:700, flex:1}}>Write to {preview?.to || (preview?.phone ? preview.phone : 'the collector')}</div>
          {preview?.phone && <div style={{display:'flex', gap:4}}>
            {[['email','Email'],['sms','Text']].map(([k, l]) => <button key={k} className={'btn mini' + (mode === k ? '' : ' quiet')}
              onClick={() => setMode(k)} disabled={k === 'sms' && !preview?.sms} title={k === 'sms' && !preview?.sms ? 'Texting is not connected yet' : ''}>{l}</button>)}
          </div>}
          <button onClick={() => setOpen(false)} className="btn mini quiet">Close</button>
        </div>
        <div style={{display:'grid', gridTemplateColumns:'260px 1fr', gap:0, flex:1, minHeight:0}}>
          <div style={{padding:'16px 18px', borderRight:'1px solid #eeeee9', display:'flex', flexDirection:'column', gap:14, overflowY:'auto'}}>
            <div><span style={label2}>Template</span>
              <BrandSelect options={(preview?.templates || [{ key: tpl, label: tpl }]).map(t => [t.key, t.label])} value={tpl} onValue={setTpl} width="100%"/></div>
            {mode === 'email' && <>
              <div><span style={label2}>Subject</span><input style={input} value={subject} onChange={e => setSubject(e.target.value)}/></div>
              <div><span style={label2}>Add a line · optional</span>
                <textarea value={note} onChange={e => setNote(e.target.value)} rows={4} placeholder="One personal sentence, in your words. It drops into the letter."
                  style={{...input, height:'auto', padding:'10px 11px', resize:'vertical', lineHeight:1.6}}/></div>
              {preview?.links?.tearsheet && tpl === 'first_reply' && <label style={{fontSize:12.5, display:'flex', gap:8, alignItems:'center'}}>
                <input type="checkbox" checked={attachTear} onChange={e => setAttachTear(e.target.checked)}/> Attach the tear sheet</label>}
              <div style={{fontSize:11.5, color:'#73736c', lineHeight:1.55}}>
                {preview?.ready ? 'Sends from the gallery domain and lands on the collector record.' : 'Email is not connected yet: Draft opens this exact text in your mail client.'}
                {preview && !preview.to && <div style={{color:'#9a551a', fontWeight:650, marginTop:6}}>No real email on file for this collector.</div>}
              </div>
            </>}
            {mode === 'sms' && <>
              <div><span style={label2}>Text · to {preview?.phone}</span>
                <textarea value={sms} onChange={e => setSms(e.target.value)} rows={6} maxLength={480}
                  style={{...input, height:'auto', padding:'10px 11px', resize:'vertical', lineHeight:1.6}}/></div>
              <div style={{fontSize:11.5, color:'#73736c'}}>{sms.length}/480. Links only, never marketing.</div>
            </>}
          </div>
          <div style={{minHeight:0, display:'flex', flexDirection:'column'}}>
            {mode === 'email'
              ? <iframe title="preview" sandbox="" srcDoc={preview?.html || '<p style="font:13px Helvetica;color:#73736c;padding:20px">Preparing…</p>'} style={{border:0, flex:1, width:'100%', minHeight:380}}/>
              : <div style={{padding:24, fontSize:14, lineHeight:1.7, whiteSpace:'pre-wrap', color:'#1a1a18'}}>{sms || 'Type the text.'}</div>}
          </div>
        </div>
        <div style={{padding:'12px 20px', borderTop:'1px solid #eeeee9', display:'flex', gap:10, alignItems:'center', background:'#fbfbfd'}}>
          {msg && <span style={{fontSize:12.5, fontWeight:600, color: msg.startsWith('Sent') || msg.startsWith('Draft') ? '#2e6b3f' : '#c02d23', flex:1}}>{msg}</span>}
          <div style={{marginLeft:'auto', display:'flex', gap:8}}>
            {mode === 'email' && <button className="btn mini quiet" onClick={draft} disabled={!preview}>Open as draft in my mail</button>}
            <button className="btn mini" disabled={busy || !preview || (mode === 'email' ? !(preview.ready && preview.to) : !(preview.sms && sms.trim()))}
              style={busy ? {opacity:.5} : {}} onClick={send}
              title={mode === 'email' && !preview?.ready ? 'Email is not connected yet' : ''}>
              {busy ? 'Sending…' : mode === 'email' ? 'Send email' : 'Send text'}</button>
          </div>
        </div>
      </div>
    </div>}
  </>;
}
