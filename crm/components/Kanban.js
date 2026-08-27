'use client';
import BrandSelect from './BrandSelect';
import SaleWizard from './SaleWizard';
import { useState } from 'react';

const STAGES = ['new','contacted','in_conversation','hold','invoice','paid','nurture'];
const LABEL = { new:'Inbound', contacted:'Contacted', in_conversation:'In conversation',
  hold:'Hold', invoice:'Invoiced', paid:'Closed', nurture:'Nurture' };
const COLOR = { new:'#0071e3', contacted:'#5e5ce6', in_conversation:'#af52de',
  hold:'#ff9500', invoice:'#ff9f0a', paid:'#34c759', nurture:'#8e8e93' };
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

  const move = async (id, status) => {
    setLeads(ls => ls.map(l => l.id === id ? { ...l, status, stage_changed_at: new Date().toISOString() } : l));
    if (openLead?.id === id) setOpenLead(o => ({ ...o, status }));
    const fd = new FormData();
    fd.set('action', 'status'); fd.set('id', id); fd.set('status', status);
    fetch('/api/act', { method: 'POST', body: fd }).catch(() => {});
  };
  const saveNote = async () => {
    if (!note.trim()) return;
    const fd = new FormData();
    fd.set('action', 'note'); fd.set('id', openLead.collector_id);
    fd.set('entity_type', 'collector'); fd.set('body', note);
    fetch('/api/act', { method: 'POST', body: fd }).catch(() => {});
    setNote('');
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
    color:'#86868b', margin:'18px 0 8px' };

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
          style={str === 2 ? {borderLeft:'3px solid #1d7a3d'} : str === 1 ? {borderLeft:'3px solid #d2d2d7'} : {}}>
          {l.artwork?.image_url && <img src={l.artwork.image_url + (l.artwork.image_url.includes('?') ? '&' : '?') + 'width=560'}
            alt="" style={{width:'calc(100% + 28px)', margin:'-12px -14px 10px', height:120,
              objectFit:'cover', borderRadius:'10px 10px 0 0', display:'block'}}/>}
          <div style={{minWidth:0}}>
            <div className="t" style={{display:'flex', gap:6, alignItems:'center'}}>
              <span style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{l.collectors?.first_name} {l.collectors?.last_name}</span>
              {l.vip && <span className="pill" style={{fontSize:9, fontWeight:700, background:'#1d1d1f', color:'#fff', flex:'0 0 auto'}}>VIP</span>}
            </div>
            {l.ltv > 0 && <div style={{fontSize:10.5, fontWeight:700, color:'#1d7a3d', marginTop:1}}>
              {usdK(l.ltv)} collector{l.worksOwned ? ` · ${l.worksOwned} owned` : ''}</div>}
            <div className="s" style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{l.artwork_title || l.purpose}</div>
          </div>
          {l.competition?.others > 0 && <div style={{fontSize:11, fontWeight:700, marginTop:6,
            color: l.competition.committed ? '#ff3b30' : '#b8860b'}}>
            {l.competition.committed ? '⛔ Committed elsewhere' : '⚡ ' + l.competition.others + ' other interested'}</div>}
          <div className="s" style={{display:'flex', justifyContent:'space-between', marginTop:6}}>
            <span style={{fontWeight:700, color:'#1d1d1f', fontVariantNumeric:'tabular-nums'}}>{leadValue(l) ? usd(leadValue(l)) : '—'}</span>
            {s === 'hold'
              ? <span style={{color: holdLeft(l).includes('expired') ? '#ff3b30' : '#b8860b', fontWeight:600}}>{holdLeft(l)}</span>
              : <span style={{color: ageDays(l.stage_changed_at || l.created_at) >= 5 ? '#b8860b' : '#86868b'}}>
                  {ageDays(l.stage_changed_at || l.created_at)}d</span>}
          </div>
          {l.owner && <div className="s">{l.owner}</div>}
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
            {openLead.vip && <span className="badge" style={{background:'#1d1d1f', color:'#fff'}}>VIP</span>}
            {openLead.inquiryCount > 1 && <span className="badge">{openLead.inquiryCount} open inquiries</span>}
            {c.trade ? <span className="badge">Trade</span> : null}</h2>
          <div className="sub">{[c.email && !c.email.endsWith?.('import.chasecontemporary.com') ? c.email : null,
            fmtPhone(c.phone)].filter(Boolean).join(' · ') || 'No contact details yet'}</div>
          <div style={{marginTop:12, display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}>
            <BrandSelect options={STAGES.map(s => [s, LABEL[s]])} value={openLead.status}
              control pillColor={(v) => COLOR[v] || '#8e8e93'} onValue={(v) => move(openLead.id, v)}/>
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
            {!['invoice','paid'].includes(openLead.status) &&
              <button className="btn mini" onClick={() => setWizard(true)}>Start sale</button>}
            {!openLead.contacted_at && <span style={{fontSize:12, color:'#ff3b30', fontWeight:600}}>
              Awaiting first response</span>}
          </div>
        </div>
        <div className="ld-body">
        {openLead.competition?.committed && <div style={{background:'rgba(255,59,48,.1)', color:'#c0271d',
          borderRadius:12, padding:'12px 14px', fontSize:13, fontWeight:600, marginBottom:14}}>
          This work is {openLead.competition.committed.stage === 'hold' ? 'on hold' :
            openLead.competition.committed.stage === 'invoice' ? 'invoiced' : 'sold'} for {openLead.competition.committed.name}.
          Offer alternatives, or wait for the hold to lapse.</div>}
        {!openLead.competition?.committed && openLead.competition?.others > 0 &&
          <div style={{background:'rgba(255,149,0,.12)', color:'#8a5300',
          borderRadius:12, padding:'12px 14px', fontSize:13, fontWeight:600, marginBottom:14}}>
          ⚡ {openLead.competition.others} other active {openLead.competition.others === 1 ? 'inquiry' : 'inquiries'} on this work.
          Genuine scarcity — use it honestly. First hold deposit wins.</div>}
        {a && !a.available && !openLead.competition?.committed && ['new','contacted','in_conversation'].includes(openLead.status) &&
          <div style={{background:'rgba(255,59,48,.1)', color:'#c0271d', borderRadius:12,
            padding:'12px 14px', fontSize:13, fontWeight:600, marginBottom:14}}>
          This work is marked sold in inventory. Offer alternatives.</div>}

        {a && <a className="ld-artwork" href={'/inventory/' + a.id}>
          {a.image_url && <img src={a.image_url + (a.image_url.includes('?') ? '&' : '?') + 'width=800'} alt="" />}
          <div className="cap">
            <div><div className="t">{a.title}</div><div className="a">{a.artist}{a.medium ? ' · ' + a.medium : ''}</div></div>
            <div style={{textAlign:'right'}}>
              <div className="p">{(a.price_cents || 0) > 0 ? usd(a.price_cents)
                : a.internal_value_cents > 0 ? <>POR <span style={{fontSize:11, color:'#86868b', fontWeight:500}}>· est {usd(a.internal_value_cents)}</span></>
                : 'POR'}</div>
              <div className="open">Open in inventory →</div>
            </div>
          </div>
        </a>}

        <div style={secTitle}>Money picture</div>
        <div style={{background:'#f5f5f7', borderRadius:12, padding:'12px 14px', fontSize:13}}>
          <div style={{display:'flex', gap:16, flexWrap:'wrap'}}>
            <span><b style={{fontVariantNumeric:'tabular-nums'}}>{openLead.ltv > 0 ? usd(openLead.ltv) : '—'}</b>
              <span style={{color:'#86868b'}}> lifetime{openLead.worksOwned ? ` · ${openLead.worksOwned} works owned` : ''}</span></span>
            <span><b>{openLead.budget_range || c.budget_range || 'No stated budget'}</b>
              {anchor > 0 && budgetMid > 0 && (() => {
                const pct = Math.round(100 * budgetMid * 100 / anchor);
                const col = pct >= 90 ? '#1d7a3d' : pct >= 65 ? '#3a3a3c' : '#b25a00';
                return <span style={{color:col, fontWeight:700}}> · ≈{pct}% of {anchorIsEst ? 'estimate' : 'list'}</span>;
              })()}</span>
          </div>
          {openLead.openInvoice && <div style={{marginTop:8, fontSize:12.5}}>
            <a href="/finance" style={{color:'#0071e3', fontWeight:650}}>
              Open invoice №{String(openLead.openInvoice.invoice_number).padStart(4,'0')} · {usd(openLead.openInvoice.amount_cents + (openLead.openInvoice.tax_cents || 0) + (openLead.openInvoice.shipping_cents || 0))} →</a>
          </div>}
          {openLead.openSale && !openLead.openInvoice && <div style={{marginTop:8, fontSize:12.5, color:'#86868b'}}>
            Open sale · {openLead.openSale.sale_items.length} work{openLead.openSale.sale_items.length > 1 ? 's' : ''} · {usd(openLead.openSale.sale_items.reduce((s, i) => s + i.agreed_cents, 0))} — finish it with Start sale above</div>}
        </div>

        <div style={secTitle}>The inquiry</div>
        <dl className="kv" style={{marginTop:0}}>
          {!a && <><dt>Inquiring about</dt><dd>{openLead.artwork_title || openLead.purpose}</dd></>}
          <dt>Timeframe</dt><dd>{openLead.timeframe || '—'}</dd>
          <dt>City</dt><dd>{[c.city, c.timezone].filter(Boolean).join(' · ') || '—'}</dd>
          <dt>Found us via</dt><dd>{openLead.source || c.source || '—'}</dd>
          <dt>Owner</dt><dd>
            <BrandSelect options={[['', 'Unassigned'], ...team.map(t => [t, t])]} value={openLead.owner || ''}
              onValue={async (owner) => {
                const fd = new FormData();
                fd.set('action','assign'); fd.set('id', openLead.id); fd.set('owner', owner); fd.set('back','json');
                await fetch('/api/act', { method:'POST', body: fd });
                setOpenLead(o => ({ ...o, owner }));
                setLeads(ls => ls.map(l => l.id === openLead.id ? { ...l, owner } : l));
              }}/></dd>
          <dt>Billing details</dt><dd>{missing.length
            ? <span style={{display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}>
                <span style={{color:'#b25a00', fontWeight:600}}>Missing {missing.join(', ')}</span>
                <button className="btn mini quiet" onClick={async () => {
                  const fd = new FormData();
                  fd.set('action','details_link'); fd.set('id', c.id); fd.set('back','json');
                  const r = await fetch('/api/act', { method:'POST', body: fd }).then(x => x.json());
                  try { await navigator.clipboard.writeText(r.url); } catch {}
                  setDlink(r.url);
                }}>Text them a secure form</button>
              </span>
            : <span style={{color:'#1d7a3d', fontWeight:600}}>All on file — ready to invoice</span>}
            {dlink && <div style={{marginTop:6, fontSize:12}}>Link copied — send it to the collector:{' '}
              <a href={dlink} target="_blank" style={{color:'#0071e3', wordBreak:'break-all'}}>{dlink}</a></div>}
          </dd>
          {a?.available && <><dt>Take-home trial</dt><dd>
            {openLead._approval
              ? <span style={{fontSize:12.5, color:'#1d7a3d', fontWeight:600}}>
                  Out with {openLead._approval.out_to} · due back {openLead._approval.due}</span>
              : <span style={{display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}>
                  <button className="btn mini quiet" onClick={async () => {
                    if (!a?.id || !c.id) return;
                    const fd = new FormData();
                    fd.set('action','approval_out'); fd.set('id', a.id);
                    fd.set('collector_id', c.id);
                    fd.set('inquiry_id', openLead.id); fd.set('back','json');
                    const r = await fetch('/api/act', { method:'POST', body: fd }).then(x => x.json());
                    setLeads(ls => ls.map(l => l.id === openLead.id ? { ...l, status: 'hold' } : l));
                    setOpenLead(o => ({ ...o, status: 'hold', _approval: r }));
                  }}>Send the work home with them</button>
                  <span style={{fontSize:11.5, color:'#86868b'}}>7-day trial · tracked on Today</span>
                </span>}
          </dd></>}
        </dl>

        {openLead.message && <><div style={secTitle}>Their message</div>
          <div className="msg" style={{marginTop:0}}>{openLead.message}</div></>}
        {openLead.page_journey && <div className="msg" style={{fontSize:12}}>
          <b style={{fontSize:11.5}}>Path through the site</b><br/>{openLead.page_journey}</div>}

        <div style={secTitle}>Notes</div>
        <textarea placeholder="What happened on the call, what they responded to, what to do next — saves to the collector's record"
          value={note} onChange={e => setNote(e.target.value)} rows={3}
          style={{width:'100%', border:'1px solid #e8e8ed', borderRadius:10, fontFamily:'inherit',
            fontSize:13.5, padding:'10px 12px', outline:'none', resize:'vertical', lineHeight:1.6}}/>
        <div style={{display:'flex', justifyContent:'flex-end', marginTop:8}}>
          <button className="btn mini quiet" onClick={saveNote}>Save note</button>
        </div>
        </div>
      </>}
    </div>
    {wizard && openLead && <SaleWizard lead={openLead} onClose={() => setWizard(false)}/>}
  </>;
}
