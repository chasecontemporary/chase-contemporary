'use client';
import { useEffect, useState } from 'react';
import WorkPicker from './WorkPicker';

// The sale, step by step: works & prices -> billing details -> review & invoice.
const usd = (n) => '$' + Math.round(n || 0).toLocaleString();

export default function SaleWizard({ lead, onClose }) {
  const [step, setStep] = useState(1);
  const [works, setWorks] = useState(() => lead.artwork ? [{
    id: lead.artwork.id, title: lead.artwork.title, artist: lead.artwork.artist,
    img: lead.artwork.image_url ? lead.artwork.image_url + (lead.artwork.image_url.includes('?') ? '&' : '?') + 'width=88' : null,
    anchor: Number(lead.artwork.price_cents > 0 ? lead.artwork.price_cents : lead.artwork.internal_value_cents || 0),
    est: !(lead.artwork.price_cents > 0) && lead.artwork.internal_value_cents > 0,
    amount: lead.artwork.price_cents > 0 ? String(lead.artwork.price_cents / 100) : '',
  }] : []);
  const [tax, setTax] = useState('');
  const [shipping, setShipping] = useState('');
  const [dlink, setDlink] = useState(null);
  const [selLink, setSelLink] = useState(null);
  const [docBusy, setDocBusy] = useState(null);
  // branded paper on demand: generates the PDF and opens it in a new tab
  const paper = async (workId, kind) => {
    setDocBusy(workId + kind);
    const fd = new FormData();
    fd.set('action', 'artwork_collateral'); fd.set('id', workId);
    fd.set('kind', kind); fd.set('back', 'json');
    const r = await fetch('/api/act', { method: 'POST', body: fd }).then(x => x.json()).catch(() => null);
    setDocBusy(null);
    if (r?.url) window.open(r.url, '_blank');
  };
  // the same deal ticket, as a tracked private-selection page instead of an invoice
  const asSelection = async () => {
    setDocBusy('selection');
    const fd = new FormData();
    fd.set('action', 'offer_create'); fd.set('id', lead.collector_id);
    fd.set('inquiry_id', lead.id);
    fd.set('title', lead.collectors?.first_name ? `A selection for ${lead.collectors.first_name}` : 'A private selection');
    fd.set('expires_days', '14');
    fd.set('items', JSON.stringify(works.map(w => ({ id: w.id,
      price_cents: num(w.amount) > 0 && num(w.amount) * 100 !== w.anchor ? num(w.amount) * 100 : null }))));
    const r = await fetch('/api/act', { method: 'POST', body: fd }).then(x => x.json()).catch(() => null);
    setDocBusy(null);
    if (r?.url) {
      try { await navigator.clipboard.writeText(r.url); } catch {}
      setSelLink(r.url);
    }
  };
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  const c = lead.collectors || {};
  const num = (x) => Number(String(x || '0').replace(/[$,\s]/g, '')) || 0;
  const patch = (id, p) => setWorks(ws => ws.map(w => w.id === id ? { ...w, ...p } : w));
  const subtotal = works.reduce((s, w) => s + num(w.amount), 0);
  const total = subtotal + num(tax) + num(shipping);
  const missing = [!c.address_line1 && 'billing address', !c.phone && 'phone',
    (!c.email || c.email.endsWith?.('import.chasecontemporary.com')) && 'email'].filter(Boolean);
  const label = { fontSize:11, fontWeight:650, letterSpacing:'.05em', textTransform:'uppercase',
    color:'#73736c', display:'block', marginBottom:6 };
  const input = { background:'#fff', border:'1px solid #e3e3dd', borderRadius:2, height:36,
    fontFamily:'inherit', fontSize:13.5, padding:'0 11px' };
  const STEPS = ['Works & price', 'Billing details', 'Review & invoice'];
  return <div onClick={onClose} style={{position:'fixed', inset:0, zIndex:85, background:'rgba(0,0,0,.42)',
    backdropFilter:'blur(6px)', display:'flex', alignItems:'center', justifyContent:'center', padding:20}}>
    <div onClick={(e) => e.stopPropagation()} style={{background:'#fff', borderRadius:2,
      width:'min(620px, 96vw)', maxHeight:'92vh', overflowY:'auto', boxShadow:'0 24px 80px rgba(0,0,0,.3)'}}>
      <div style={{padding:'16px 20px', borderBottom:'1px solid #eeeee9', display:'flex',
        alignItems:'center', gap:12}}>
        <div style={{fontSize:15, fontWeight:700, flex:1}}>Sale · {[c.first_name, c.last_name].filter(Boolean).join(' ')}</div>
        <button onClick={onClose} className="btn mini quiet">Close</button>
      </div>
      <div style={{display:'flex', gap:0, padding:'14px 20px 0'}}>
        {STEPS.map((s, i) => <div key={s} style={{flex:1, textAlign:'center'}}>
          <div style={{height:3, borderRadius:2, background: i + 1 <= step ? '#2257c5' : '#e3e3dd', margin:'0 3px'}}/>
          <div style={{fontSize:11, fontWeight: i + 1 === step ? 700 : 500,
            color: i + 1 <= step ? '#1a1a18' : '#73736c', marginTop:6}}>{i + 1}. {s}</div>
        </div>)}
      </div>
      <div style={{padding:'18px 20px'}}>
        {step === 1 && <div style={{display:'flex', flexDirection:'column', gap:12}}>
          {works.map(w => <div key={w.id} style={{border:'1px solid #eeeee9', borderRadius:3, padding:12}}>
            <div style={{display:'flex', gap:10, alignItems:'center'}}>
              {w.img ? <img src={w.img} alt="" style={{width:40, height:40, objectFit:'cover', borderRadius:2}}/>
                : <span style={{width:40, height:40, borderRadius:2, background:'#eeeee9'}}/>}
              <div style={{flex:1, minWidth:0}}>
                <div style={{fontSize:13, fontWeight:650, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{w.title}</div>
                <div style={{fontSize:11.5, color:'#73736c'}}>{w.artist}{w.anchor > 0 ? ` · ${w.est ? 'est ' : 'list '}${usd(w.anchor / 100)}` : ''}</div>
              </div>
              <button onClick={() => setWorks(ws => ws.filter(x => x.id !== w.id))}
                style={{background:'none', border:0, color:'#c2c2bb', fontSize:16, cursor:'pointer'}}>×</button>
            </div>
            <div style={{display:'flex', gap:6, marginTop:10, flexWrap:'wrap', alignItems:'center'}}>
              {w.anchor > 0 && [[0, (w.est ? 'Est ' : 'List ') + usd(w.anchor / 100)], [5, '−5%'], [10, '−10%'], [15, '−15%']].map(([pct, l]) =>
                <button key={pct} className="btn mini quiet"
                  onClick={() => patch(w.id, { amount: String(Math.round(w.anchor * (100 - pct) / 100) / 100) })}>{l}</button>)}
              <label className="money" style={{marginLeft:'auto'}}><span>$</span>
                <input inputMode="numeric" placeholder="Agreed" value={w.amount || ''}
                  onChange={(e) => patch(w.id, { amount: e.target.value })} style={{width:110}}/></label>
              {num(w.amount) > 0 && w.anchor > 0 && (() => {
                const disc = Math.round((1 - num(w.amount) * 100 / w.anchor) * 1000) / 10;
                const col = disc <= 0 ? '#2e6b3f' : disc <= 10 ? '#73736c' : disc <= 20 ? '#9a551a' : '#b8231a';
                return <span style={{fontSize:11.5, fontWeight:700, color:col, whiteSpace:'nowrap'}}>
                  {disc > 0 ? `−${disc}%` : disc < 0 ? 'above' : 'at list'}{disc > 20 ? ' · deep' : ''}</span>;
              })()}
            </div>
          </div>)}
          <div>
            <span style={label}>Add another work</span>
            <WorkPicker onPick={(h) => { if (h && !works.find(w => w.id === h.id))
              setWorks(ws => [...ws, { id: h.id, title: h.title, artist: h.artist, img: h.img,
                anchor: h.cents, est: h.est, amount: h.cents > 0 ? String(h.cents / 100) : '' }]); }}/>
          </div>
          {works.length > 0 && <div style={{borderTop:'1px solid #eeeee9', paddingTop:12}}>
            {selLink
              ? <div style={{fontSize:12.5}}>
                  <span style={{color:'#2e6b3f', fontWeight:650}}>Selection link copied</span>
                  <span style={{color:'#73736c'}}> — text or email it. Opens and interest land on their card; your special prices show on the page.</span>
                  <div style={{color:'#2257c5', wordBreak:'break-all', marginTop:3}}>{selLink}</div>
                </div>
              : <div style={{display:'flex', alignItems:'center', gap:10, flexWrap:'wrap'}}>
                  <button className="btn mini quiet" disabled={docBusy === 'selection'} onClick={asSelection}>
                    {docBusy === 'selection' ? 'Making the page…' : 'Not ready to invoice? Send these as a private selection'}</button>
                  <span style={{fontSize:11.5, color:'#73736c'}}>Same works and prices, as a tracked page they browse first</span>
                </div>}
          </div>}
        </div>}

        {step === 2 && <div>
          <div style={{fontSize:13.5, lineHeight:1.7}}>
            {missing.length === 0
              ? <span style={{color:'#2e6b3f', fontWeight:650}}>Everything needed for the invoice is on file.</span>
              : <>The invoice still needs their <b>{missing.join(', ')}</b>.</>}
          </div>
          {missing.length > 0 && <div style={{marginTop:14, display:'flex', flexDirection:'column', gap:10}}>
            <button className="btn mini quiet" onClick={async () => {
              const fd = new FormData();
              fd.set('action', 'details_link'); fd.set('id', c.id); fd.set('back', 'json');
              const r = await fetch('/api/act', { method: 'POST', body: fd }).then(x => x.json());
              try { await navigator.clipboard.writeText(r.url); } catch {}
              setDlink(r.url);
            }}>Send them a form to fill in — link copies to clipboard</button>
            {dlink && <div style={{fontSize:12, color:'#2e6b3f'}}>Link copied. Paste it into a text or email — what they enter saves to this collector automatically:
              <div style={{color:'#2257c5', wordBreak:'break-all', marginTop:3}}>{dlink}</div></div>}
            <a href={'/collectors/' + c.id} style={{fontSize:12.5, color:'#2257c5'}}>Or type the details in yourself →</a>
            <div style={{fontSize:12, color:'#73736c'}}>You can also continue now and add details before sending the invoice.</div>
          </div>}
        </div>}

        {step === 3 && <div>
          {works.map(w => <div key={w.id} style={{display:'flex', alignItems:'center', gap:10, padding:'8px 0',
            borderBottom:'1px solid #f2f2ee', fontSize:13}}>
            <span style={{flex:1, minWidth:0}}>
              <span style={{fontSize:10.5, fontWeight:600, letterSpacing:'.06em', textTransform:'uppercase'}}>{w.artist}</span>
              <span style={{fontStyle:'italic'}}> · {w.title}</span></span>
            <button className="btn mini quiet" disabled={docBusy === w.id + 'tearsheet'}
              onClick={() => paper(w.id, 'tearsheet')}>{docBusy === w.id + 'tearsheet' ? '…' : 'Tear sheet'}</button>
            <button className="btn mini quiet" disabled={docBusy === w.id + 'coa'}
              onClick={() => paper(w.id, 'coa')}>{docBusy === w.id + 'coa' ? '…' : 'COA'}</button>
            <span style={{fontVariantNumeric:'tabular-nums', fontWeight:650, width:90, textAlign:'right'}}>{usd(num(w.amount))}</span>
          </div>)}
          <div style={{fontSize:11.5, color:'#73736c', marginTop:8}}>
            Tear sheet and certificate open as branded PDFs, ready to send. The invoice PDF is created with the invoice — you&apos;ll find every document together on the invoice in Finance.</div>
          <div style={{display:'flex', gap:10, marginTop:12}}>
            <div><span style={label}>Sales tax</span>
              <label className="money"><span>$</span><input inputMode="numeric" placeholder="0" value={tax}
                onChange={(e) => setTax(e.target.value)} style={{width:100}}/></label></div>
            <div><span style={label}>Shipping</span>
              <label className="money"><span>$</span><input inputMode="numeric" placeholder="0" value={shipping}
                onChange={(e) => setShipping(e.target.value)} style={{width:100}}/></label></div>
            <div style={{marginLeft:'auto', textAlign:'right'}}>
              <span style={label}>Invoice total</span>
              <div style={{fontSize:20, fontWeight:700, fontVariantNumeric:'tabular-nums'}}>{usd(total)}</div>
            </div>
          </div>
          <div style={{fontSize:12, color:'#73736c', marginTop:10}}>
            Creating the invoice moves this lead to Invoiced. Paying it in full marks the work{works.length > 1 ? 's' : ''} sold automatically.</div>
        </div>}
      </div>
      <div style={{padding:'12px 20px', borderTop:'1px solid #eeeee9', display:'flex', gap:8,
        background:'#fbfbfd'}}>
        {step > 1 && <button className="btn mini quiet" onClick={() => setStep(s => s - 1)}>Back</button>}
        <div style={{marginLeft:'auto'}}>
          {step < 3
            ? <button className="btn" disabled={step === 1 && (!works.length || works.some(w => !num(w.amount)))}
                style={step === 1 && (!works.length || works.some(w => !num(w.amount))) ? {opacity:.4} : {}}
                onClick={() => setStep(s => s + 1)}>Continue</button>
            : <button className="btn" onClick={async () => {
                const fd = new FormData();
                fd.set('action', 'invoice_manual');
                fd.set('collector_id', c.id);
                fd.set('inquiry_id', lead.id);
                fd.set('back', 'json');
                const lines = works.map(w => ({ kind: 'work', artwork_id: w.id, title: w.title,
                  artist: w.artist, amount: String(num(w.amount)) }));
                if (num(tax)) lines.push({ kind: 'tax', amount: String(num(tax)) });
                if (num(shipping)) lines.push({ kind: 'shipping', amount: String(num(shipping)) });
                fd.set('lines', JSON.stringify(lines));
                await fetch('/api/act', { method: 'POST', body: fd });
                window.location.href = '/finance';
              }}>Create invoice · {usd(total)}</button>}
        </div>
      </div>
    </div>
  </div>;
}
