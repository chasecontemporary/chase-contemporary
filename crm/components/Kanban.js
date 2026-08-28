'use client';
import BrandSelect from './BrandSelect';
import SaleWizard from './SaleWizard';
import OfferComposer from './OfferComposer';
import DocPreview from './DocPreview';
import { useEffect, useState } from 'react';

const STAGES = ['new','contacted','in_conversation','hold','invoice','paid','nurture'];
const LABEL = { new:'Inbound', contacted:'Contacted', in_conversation:'In conversation',
  hold:'Hold', invoice:'Invoiced', paid:'Closed', nurture:'Nurture' };
const COLOR = { new:'#2257c5', contacted:'#56599f', in_conversation:'#7d4d9e',
  hold:'#b7791f', invoice:'#9a6a16', paid:'#35804a', nurture:'#82827b' };
const usd = (c) => '$' + Math.round((c || 0) / 100).toLocaleString();
const usdK = (c) => {
  const d = Math.round((c || 0) / 100);
  return d >= 1000000 ? '$' + (d / 1000000).toFixed(1) + 'M' : d >= 1000 ? '$' + Math.round(d / 1000) + 'k' : '$' + d;
};
const BUDGET_MID = { 'Under $10,000': 500000, '$10,000-25,000': 1750000, '$25,000-50,000': 3750000,
  '$50,000-100,000': 7500000, '$100,000+': 10000000 };
const leadValue = (l) => (l.artwork?.price_cents > 0 ? l.artwork.price_cents
  : l.artwork?.internal_value_cents > 0 ? l.artwork.internal_value_cents : (BUDGET_MID[l.budget_range] || 0));
const ageDays = (t) => Math.floor((Date.now() - new Date(t).getTime()) / 86400000);
const holdLeft = (l) => {
  const ms = new Date(l.stage_changed_at || l.created_at).getTime() + 72 * 3600000 - Date.now();
  if (ms <= 0) return 'Hold expired';
  const h = Math.floor(ms / 3600000);
  return h >= 24 ? Math.floor(h / 24) + 'd ' + (h % 24) + 'h left' : h + 'h left';
};
// lead strength: value on the table, who the collector is, and live competition
const strength = (l) => {
  const v = leadValue(l);
  if (v >= 2500000 || l.ltv >= 25000000 || l.vip || l.competition?.others > 0) return 2;
  if (v >= 1000000 || l.ltv >= 5000000 || l.inquiryCount > 1) return 1;
  return 0;
};
const fmtPhone = (p) => {
  const d = String(p || '').replace(/\D/g, '');
  const n = d.length === 11 && d[0] === '1' ? d.slice(1) : d;
  return n.length === 10 ? `(${n.slice(0,3)}) ${n.slice(3,6)}-${n.slice(6)}` : p;
};

export default function Kanban({ initial, team = [] }) {
  const [dlink, setDlink] = useState(null);
  const [leads, setLeads] = useState(initial);
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);
  const [openLead, setOpenLead] = useState(null);
  const [note, setNote] = useState('');
  const [wizard, setWizard] = useState(false);
  const [noteState, setNoteState] = useState('idle');   // idle | saving | saved | failed
  const [failed, setFailed] = useState(null);           // id of a lead whose move didn't stick
  // touch devices can't drag (HTML5 drag events never fire on iOS) — give them a picker
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    try { setTouch(window.matchMedia('(hover: none)').matches); } catch {}
  }, []);

  const move = async (id, status) => {
    const before = leads.find(l => l.id === id)?.status;
    setFailed(null);
    setLeads(ls => ls.map(l => l.id === id ? { ...l, status, stage_changed_at: new Date().toISOString() } : l));
    if (openLead?.id === id) setOpenLead(o => ({ ...o, status }));
    const fd = new FormData();
    fd.set('action', 'status'); fd.set('id', id); fd.set('status', status); fd.set('back', 'json');
    try {
      const r = await fetch('/api/act', { method: 'POST', body: fd });
      if (!r.ok) throw new Error('rejected');
    } catch {
      // put it back where it was and say so — never leave a card lying about where it sits
      setLeads(ls => ls.map(l => l.id === id ? { ...l, status: before } : l));
      if (openLead?.id === id) setOpenLead(o => ({ ...o, status: before }));
      setFailed(id);
    }
  };
  const saveNote = async () => {
    if (!note.trim() || noteState === 'saving') return;
    setNoteState('saving');
    const fd = new FormData();
    fd.set('action', 'note'); fd.set('id', openLead.collector_id);
    fd.set('entity_type', 'collector'); fd.set('body', note); fd.set('back', 'json');
    try {
      const r = await fetch('/api/act', { method: 'POST', body: fd });
      if (!r.ok) throw new Error('rejected');
      setNote('');                       // only clear once the save is confirmed
      setNoteState('saved');
      setTimeout(() => setNoteState('idle'), 2500);
    } catch {
      setNoteState('failed');            // the note stays in the box
    }
  };

  const c = openLead?.collectors || {};
  const a = openLead?.artwork;
  const anchor = a ? (a.price_cents > 0 ? a.price_cents : a.internal_value_cents || 0) : 0;
  const anchorIsEst = a && !(a.price_cents > 0) && a.internal_value_cents > 0;
  const budgetMid = (() => {
    const s = openLead?.budget_range || '';
    const nums = (s.match(/[\d,]+/g) || []).map(x => Number(x.replace(/,/g, '')));
    if (!nums.length) return 0;
    const scaled = nums.map(n => n < 1000 ? n * 1000 : n);
    return scaled.length >= 2 ? (scaled[0] + scaled[1]) / 2 : scaled[0];
  })();
  const missing = openLead ? [!c.address_line1 && 'billing address', !c.phone && 'phone',
    (!c.email || c.email.endsWith?.('import.chasecontemporary.com')) && 'email'].filter(Boolean) : [];
  const secTitle = { fontSize:11, fontWeight:650, letterSpacing:'.07em', textTransform:'uppercase',
    color:'#73736c', margin:'18px 0 8px' };

  return <>
    <div className="cols">
      {STAGES.map(s => <div key={s}
        className={'col kcol' + (overCol === s ? ' over' : '')}
        onDragOver={e => { e.preventDefault(); setOverCol(s); }}
        onDragLeave={() => setOverCol(null)}
        onDrop={e => { e.preventDefault(); setOverCol(null); if (dragId) move(dragId, s); setDragId(null); }}>
        <h3><span style={{color: COLOR[s]}}>●</span> {LABEL[s]} · {leads.filter(l => l.status === s).length}
          <span style={{float:'right', fontVariantNumeric:'tabular-nums'}}>
            {(() => { const v = leads.filter(l => l.status === s).reduce((t, l) => t + leadValue(l), 0);
              return v ? usdK(v) : ''; })()}</span></h3>
        {leads.filter(l => l.status === s).sort((x, y) => strength(y) - strength(x) || leadValue(y) - leadValue(x))
          .map(l => {
          const str = strength(l);
          return <div key={l.id}
          className={'kcard' + (dragId === l.id ? ' dragging' : '')}
          draggable
          onDragStart={() => setDragId(l.id)}
          onDragEnd={() => setDragId(null)}
          onClick={() => setOpenLead(l)}
          style={str === 2 ? {borderLeft:'3px solid #2e6b3f'} : str === 1 ? {borderLeft:'3px solid #cccdc4'} : {}}>
          {l.artwork?.image_url && <img src={l.artwork.image_url + (l.artwork.image_url.includes('?') ? '&' : '?') + 'width=560'}
            alt="" style={{width:'calc(100% + 28px)', margin:'-12px -14px 10px', height:120,
              objectFit:'cover', borderRadius:'2px 2px 0 0', display:'block'}}/>}
          <div style={{minWidth:0}}>
            <div className="t" style={{display:'flex', gap:6, alignItems:'center'}}>
              <span style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{l.collectors?.first_name} {l.collectors?.last_name}</span>
              {l.vip && <span className="pill" style={{fontSize:9, fontWeight:700, background:'#1a1a18', color:'#fff', flex:'0 0 auto'}}>VIP</span>}
            </div>
            {l.ltv > 0 && <div style={{fontSize:10.5, fontWeight:700, color:'#2e6b3f', marginTop:1}}>
              {usdK(l.ltv)} collector{l.worksOwned ? ` · ${l.worksOwned} owned` : ''}</div>}
            <div className="s" style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{l.artwork_title || l.purpose}</div>
          </div>
          {l.competition?.others > 0 && <div style={{fontSize:11, fontWeight:700, marginTop:6,
            color: l.competition.committed ? '#c02d23' : '#8f6f14'}}>
            {l.competition.committed ? '⛔ Committed elsewhere' : '⚡ ' + l.competition.others + ' other interested'}</div>}
          <div className="s" style={{display:'flex', justifyContent:'space-between', marginTop:6}}>
            <span style={{fontWeight:700, color:'#1a1a18', fontVariantNumeric:'tabular-nums'}}>{leadValue(l) ? usd(leadValue(l)) : '—'}</span>
            {s === 'hold'
              ? <span style={{color: holdLeft(l).includes('expired') ? '#c02d23' : '#8f6f14', fontWeight:600}}>{holdLeft(l)}</span>
              : <span style={{color: ageDays(l.stage_changed_at || l.created_at) >= 5 ? '#8f6f14' : '#73736c'}}>
                  {ageDays(l.stage_changed_at || l.created_at)}d</span>}
          </div>
          {l.owner && <div className="s">{l.owner}</div>}
          {failed === l.id && <div style={{fontSize:11, fontWeight:700, color:'#c02d23', marginTop:6}}>
            Not saved — check your connection and try again</div>}
          {touch && <div onClick={e => e.stopPropagation()} style={{marginTop:8}}>
            <BrandSelect options={STAGES.map(x => [x, LABEL[x]])} value={l.status}
              pill pillColor={(v) => COLOR[v] || '#82827b'} onValue={(v) => move(l.id, v)}/>
          </div>}
        </div>; })}
      </div>)}
    </div>

    <div className={'ldscrim' + (openLead ? ' open' : '')} onClick={() => setOpenLead(null)} />
    <div className={'ldrawer' + (openLead ? ' open' : '')}>
      {openLead && <>
        <div className="ld-head">
          <button className="close" onClick={() => setOpenLead(null)}>✕</button>
          <h2><a className="namelink" href={'/collectors/' + openLead.collector_id}>
            {c.first_name} {c.last_name}</a>
            {openLead.vip && <span className="badge" style={{background:'#1a1a18', color:'#fff'}}>VIP</span>}
            {openLead.inquiryCount > 1 && <span className="badge">{openLead.inquiryCount} open inquiries</span>}
            {c.trade ? <span className="badge">Trade</span> : null}</h2>
          <div className="sub">{[c.email && !c.email.endsWith?.('import.chasecontemporary.com') ? c.email : null,
            fmtPhone(c.phone)].filter(Boolean).join(' · ') || 'No contact details yet'}</div>
          <div style={{marginTop:12, display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}>
            <BrandSelect options={STAGES.map(s => [s, LABEL[s]])} value={openLead.status}
              control pillColor={(v) => COLOR[v] || '#82827b'} onValue={(v) => move(openLead.id, v)}/>
            {!openLead.contacted_at && <span style={{fontSize:12, color:'#c02d23', fontWeight:600}}>
              Awaiting first response</span>}
          </div>
        </div>
        <div className="ld-body">
        {openLead.competition?.committed && <div style={{background:'rgba(192,45,35,.1)', color:'#c0271d',
          borderRadius:3, padding:'12px 14px', fontSize:13, fontWeight:600, marginBottom:14}}>
          This work is {openLead.competition.committed.stage === 'hold' ? 'on hold' :
            openLead.competition.committed.stage === 'invoice' ? 'invoiced' : 'sold'} for {openLead.competition.committed.name}.
          Offer alternatives, or wait for the hold to lapse.</div>}
        {!openLead.competition?.committed && openLead.competition?.others > 0 &&
          <div style={{background:'rgba(183,121,31,.12)', color:'#8a5300',
          borderRadius:3, padding:'12px 14px', fontSize:13, fontWeight:600, marginBottom:14}}>
          ⚡ {openLead.competition.others} other active {openLead.competition.others === 1 ? 'inquiry' : 'inquiries'} on this work.
          Genuine scarcity — use it honestly. First hold deposit wins.</div>}
        {a && !a.available && !openLead.competition?.committed && ['new','contacted','in_conversation'].includes(openLead.status) &&
          <div style={{background:'rgba(192,45,35,.1)', color:'#c0271d', borderRadius:3,
            padding:'12px 14px', fontSize:13, fontWeight:600, marginBottom:14}}>
          This work is marked sold in inventory. Offer alternatives.</div>}

        {a && <a className="ld-artwork" href={'/inventory/' + a.id}>
          {a.image_url && <img src={a.image_url + (a.image_url.includes('?') ? '&' : '?') + 'width=800'} alt="" />}
          <div className="cap">
            <div><div className="a">{a.artist}</div><div className="t">{a.title}{a.medium ? <span style={{fontStyle:'normal', color:'#73736c'}}> · {a.medium}</span> : null}</div></div>
            <div style={{textAlign:'right'}}>
              <div className="p">{(a.price_cents || 0) > 0 ? usd(a.price_cents)
                : a.internal_value_cents > 0 ? <>POR <span style={{fontSize:11, color:'#73736c', fontWeight:500}}>· est {usd(a.internal_value_cents)}</span></>
                : 'POR'}</div>
              <div className="open">Open in inventory →</div>
            </div>
          </div>
        </a>}

        <div style={secTitle}>This collector</div>
        {(() => {
          const price = anchor > 0 ? usd(anchor) : null;
          const budgetStr = openLead.budget_range || c.budget_range || null;
          const rows = [];
          rows.push(['Bought from us before', openLead.ltv > 0
            ? <span><b style={{fontVariantNumeric:'tabular-nums'}}>{usd(openLead.ltv)}</b>
                <span style={{color:'#73736c'}}> across {openLead.worksOwned} work{openLead.worksOwned === 1 ? '' : 's'}</span></span>
            : <span style={{color:'#73736c'}}>Nothing yet — new collector</span>]);
          rows.push(['Budget they gave us', budgetStr
            ? <span><b>{budgetStr}</b>
                {price && budgetMid > 0 && (() => {
                  const pct = Math.round(100 * budgetMid * 100 / anchor);
                  const [txt, col] = pct >= 100 ? [`covers the ${price} ${anchorIsEst ? 'estimate' : 'price'}`, '#2e6b3f']
                    : pct >= 65 ? [`close to the ${price} ${anchorIsEst ? 'estimate' : 'price'}`, '#3a3a35']
                    : [`well below the ${price} ${anchorIsEst ? 'estimate' : 'price'}`, '#9a551a'];
                  return <span style={{color:col, fontWeight:650}}> — {txt}</span>;
                })()}</span>
            : <span style={{color:'#73736c'}}>Not given</span>]);
          if (openLead.journey) {
            const j = openLead.journey;
            const days = Math.round((Date.now() - new Date(j.first_seen).getTime()) / 86400000);
            rows.push(['Visits to our site',
              <span>{j.visit_days === 1
                ? <b>{j.page_views} page{j.page_views === 1 ? '' : 's'} in one visit</b>
                : <b>{j.page_views} pages over {j.visit_days} days</b>}
                <span style={{color:'#73736c'}}> · first visit {days <= 0 ? 'today' : days === 1 ? 'yesterday' : days + ' days ago'}</span></span>]);
          }
          if (openLead.openInvoice) rows.push(['Open invoice',
            <span style={{display:'flex', gap:10, alignItems:'center'}}>
              {openLead.openInvoice.pdf_url && <DocPreview thumb url={openLead.openInvoice.pdf_url}
                label={'Invoice No. ' + String(openLead.openInvoice.invoice_number).padStart(4,'0')}/>}
              <a href="/finance" style={{color:'#2257c5', fontWeight:650}}>
                №{String(openLead.openInvoice.invoice_number).padStart(4,'0')} for {usd(openLead.openInvoice.amount_cents + (openLead.openInvoice.tax_cents || 0) + (openLead.openInvoice.shipping_cents || 0))} — open in Finance →</a>
            </span>]);
          if (openLead.openSale && !openLead.openInvoice) rows.push(['Sale in progress',
            <span style={{color:'#73736c'}}>{openLead.openSale.sale_items.length} work{openLead.openSale.sale_items.length > 1 ? 's' : ''} at {usd(openLead.openSale.sale_items.reduce((s, i) => s + i.agreed_cents, 0))} — finish it with Start sale above</span>]);
          return <div style={{border:'1px solid #e3e3dd', borderRadius:3, background:'#fff',
            boxShadow:'0 1px 2px rgba(0,0,0,.03)'}}>
            {rows.map(([lb, node], i) => <div key={lb} style={{display:'grid',
              gridTemplateColumns:'150px 1fr', gap:12, alignItems:'center', padding:'11px 16px',
              borderTop: i ? '1px solid #f0f0eb' : 'none'}}>
              <div style={{fontSize:12.5, color:'#73736c'}}>{lb}</div>
              <div style={{fontSize:13.5, minWidth:0}}>{node}</div>
            </div>)}
          </div>;
        })()}

        <div style={secTitle}>This inquiry</div>
        {(() => {
          const rows = [];
          if (!a) rows.push(['Asking about', openLead.artwork_title || openLead.purpose || <span style={{color:'#73736c'}}>Not given</span>]);
          rows.push(['When they want to buy', openLead.timeframe || <span style={{color:'#73736c'}}>Not given</span>]);
          rows.push(['Where they are', [c.city, c.timezone].filter(Boolean).join(' · ') || <span style={{color:'#73736c'}}>Not given</span>]);
          rows.push(['How they found us', openLead.source || c.source || <span style={{color:'#73736c'}}>Not given</span>]);
          rows.push(['Salesperson', <BrandSelect options={[['', 'Unassigned'], ...team.map(t => [t, t])]} value={openLead.owner || ''}
            onValue={async (owner) => {
              const fd = new FormData();
              fd.set('action','assign'); fd.set('id', openLead.id); fd.set('owner', owner); fd.set('back','json');
              await fetch('/api/act', { method:'POST', body: fd });
              setOpenLead(o => ({ ...o, owner }));
              setLeads(ls => ls.map(l => l.id === openLead.id ? { ...l, owner } : l));
            }}/>]);
          return <div style={{border:'1px solid #e3e3dd', borderRadius:3, background:'#fff',
            boxShadow:'0 1px 2px rgba(0,0,0,.03)'}}>
            {rows.map(([lb, node], i) => <div key={lb} style={{display:'grid',
              gridTemplateColumns:'150px 1fr', gap:12, alignItems:'center', padding:'11px 16px',
              borderTop: i ? '1px solid #f0f0eb' : 'none'}}>
              <div style={{fontSize:12.5, color:'#73736c'}}>{lb}</div>
              <div style={{fontSize:13.5, minWidth:0}}>{node}</div>
            </div>)}
          </div>;
        })()}

        <div style={secTitle}>Billing details for the invoice</div>
        <div style={{border:'1px solid #e3e3dd', borderRadius:3, background:'#fff',
          boxShadow:'0 1px 2px rgba(0,0,0,.03)', padding:'13px 16px', fontSize:13.5}}>
          {missing.length === 0
            ? <span style={{color:'#2e6b3f', fontWeight:650}}>Everything needed to invoice them is on file.</span>
            : <>
              <div>Still missing their <b>{missing.length > 1
                ? missing.slice(0, -1).join(', ') + ' and ' + missing[missing.length - 1]
                : missing[0]}</b>.</div>
              <div style={{display:'flex', gap:10, alignItems:'center', marginTop:10, flexWrap:'wrap'}}>
                <button className="btn mini quiet" onClick={async () => {
                  const fd = new FormData();
                  fd.set('action','details_link'); fd.set('id', c.id); fd.set('back','json');
                  const r = await fetch('/api/act', { method:'POST', body: fd }).then(x => x.json());
                  try { await navigator.clipboard.writeText(r.url); } catch {}
                  setDlink(r.url);
                }}>Send them a form to fill in</button>
                <a href={'/collectors/' + c.id} style={{fontSize:12.5, color:'#2257c5'}}>Or type the details in yourself →</a>
              </div>
              {dlink
                ? <div style={{marginTop:10, fontSize:12}}>
                    <span style={{color:'#2e6b3f', fontWeight:650}}>Link copied.</span> Paste it into a text or email —
                    what they enter saves to this collector automatically.
                    <div style={{color:'#2257c5', wordBreak:'break-all', marginTop:3}}>{dlink}</div>
                  </div>
                : <div style={{marginTop:8, fontSize:12, color:'#73736c'}}>
                    Makes a private page where they type in their own billing address and contact info.
                  </div>}
            </>}
        </div>

        {openLead.message && <><div style={secTitle}>Their message</div>
          <div className="msg" style={{marginTop:0}}>{openLead.message}</div></>}
        {openLead.page_journey && <div className="msg" style={{fontSize:12}}>
          <b style={{fontSize:11.5}}>Path through the site</b><br/>{openLead.page_journey}</div>}

        <div style={secTitle}>Notes</div>
        <textarea placeholder="What happened on the call, what they responded to, what to do next — saves to the collector's record"
          value={note} onChange={e => setNote(e.target.value)} rows={3}
          style={{width:'100%', border:'1px solid #e3e3dd', borderRadius:2, fontFamily:'inherit',
            fontSize:13.5, padding:'10px 12px', outline:'none', resize:'vertical', lineHeight:1.6}}/>
        <div style={{display:'flex', justifyContent:'flex-end', alignItems:'center', gap:10, marginTop:8}}>
          {noteState === 'saved' && <span style={{fontSize:12, fontWeight:650, color:'#2e6b3f'}}>Saved</span>}
          {noteState === 'failed' && <span style={{fontSize:12, fontWeight:650, color:'#c02d23'}}>
            Not saved — your note is still here, try again</span>}
          <button className="btn mini quiet" disabled={noteState === 'saving'}
            style={noteState === 'saving' ? {opacity:.5} : {}}
            onClick={saveNote}>{noteState === 'saving' ? 'Saving…' : 'Save note'}</button>
        </div>
        </div>
        <div className="ld-foot">
          <button className="btn mini quiet" onClick={async () => {
            const fd = new FormData(); fd.set('action','called'); fd.set('id', openLead.id);
            await fetch('/api/act', { method:'POST', body: fd });
            setOpenLead(o => ({ ...o, first_called_at: o.first_called_at || new Date().toISOString(),
              contacted_at: o.contacted_at || new Date().toISOString(),
              status: o.status === 'new' ? 'contacted' : o.status }));
            setLeads(ls => ls.map(l => l.id === openLead.id ? { ...l,
              first_called_at: l.first_called_at || new Date().toISOString(),
              status: l.status === 'new' ? 'contacted' : l.status } : l));
          }}>{openLead.first_called_at ? '✓ Called' : 'Log call'}</button>
          <OfferComposer key={openLead.id} quiet collectorId={openLead.collector_id}
            collectorName={[c.first_name, c.last_name].filter(Boolean).join(' ')}
            defaultWork={a && a.available ? a : null}/>
          {!['invoice','paid'].includes(openLead.status) &&
            <button className="btn mini" style={{marginLeft:'auto'}} onClick={() => setWizard(true)}>Start sale</button>}
        </div>
      </>}
    </div>
    {wizard && openLead && <SaleWizard lead={openLead} onClose={() => setWizard(false)}/>}
  </>;
}
