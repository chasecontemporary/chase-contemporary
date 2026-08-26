'use client';
import { useState } from 'react';

const STAGES = ['new','contacted','in_conversation','hold','invoice','paid','nurture'];
const LABEL = { new:'Inbound', contacted:'Contacted', in_conversation:'In conversation',
  hold:'Hold', invoice:'Invoiced', paid:'Closed', nurture:'Nurture' };
const COLOR = { new:'#0071e3', contacted:'#5e5ce6', in_conversation:'#af52de',
  hold:'#ff9500', invoice:'#ff9f0a', paid:'#34c759', nurture:'#8e8e93' };
const usd = (c) => '$' + Math.round((c || 0) / 100).toLocaleString();
const BUDGET_MID = { 'Under $10,000': 500000, '$10,000-25,000': 1750000, '$25,000-50,000': 3750000,
  '$50,000-100,000': 7500000, '$100,000+': 10000000 };
const leadValue = (l) => (l.artwork?.price_cents > 0 ? l.artwork.price_cents : (BUDGET_MID[l.budget_range] || 0));
const ageDays = (t) => Math.floor((Date.now() - new Date(t).getTime()) / 86400000);
const holdLeft = (l) => {
  const ms = new Date(l.stage_changed_at || l.created_at).getTime() + 72 * 3600000 - Date.now();
  if (ms <= 0) return 'Hold expired';
  const h = Math.floor(ms / 3600000);
  return h >= 24 ? Math.floor(h / 24) + 'd ' + (h % 24) + 'h left' : h + 'h left';
};

export default function Kanban({ initial }) {
  const [leads, setLeads] = useState(initial);
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);
  const [openLead, setOpenLead] = useState(null);
  const [agreed, setAgreed] = useState('');
  const [note, setNote] = useState('');

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
  const sale = openLead?.openSale;
  const saleTotal = sale ? sale.sale_items.reduce((s, i) => s + i.agreed_cents, 0) : 0;
  const inSale = sale && sale.sale_items.some(i => i.inquiry_id === openLead?.id);
  const addToSale = async () => {
    const amount = agreed || (a?.price_cents ? a.price_cents / 100 : '');
    if (!amount) { alert('Enter the agreed price first.'); return; }
    const fd = new FormData();
    fd.set('action', 'sale_add_item'); fd.set('id', openLead.id); fd.set('amount', amount);
    await fetch('/api/act', { method: 'POST', body: fd });
    window.location.reload();
  };
  const invoiceSale = async () => {
    const fd = new FormData();
    fd.set('action', 'invoice_from_sale'); fd.set('id', sale.id);
    const res = await fetch('/api/act', { method: 'POST', body: fd });
    const j = await res.json().catch(() => ({}));
    if (j.ok) window.location.href = '/finance';
  };

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
              return v ? usd(v) : ''; })()}</span></h3>
        {leads.filter(l => l.status === s).map(l => <div key={l.id}
          className={'kcard' + (dragId === l.id ? ' dragging' : '')}
          draggable
          onDragStart={() => setDragId(l.id)}
          onDragEnd={() => setDragId(null)}
          onClick={() => setOpenLead(l)}>
          {l.artwork?.image_url && <img src={l.artwork.image_url + (l.artwork.image_url.includes('?') ? '&' : '?') + 'width=560'}
            alt="" style={{width:'calc(100% + 28px)', margin:'-12px -14px 10px', height:120,
              objectFit:'cover', borderRadius:'10px 10px 0 0', display:'block'}}/>}
          <div style={{minWidth:0}}>
            <div className="t">{l.collectors?.first_name} {l.collectors?.last_name}</div>
            <div className="s" style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{l.artwork_title || l.purpose}</div>
          </div>
          <div className="s" style={{display:'flex', justifyContent:'space-between', marginTop:6}}>
            <span style={{fontWeight:600, color:'#1d1d1f'}}>{leadValue(l) ? usd(leadValue(l)) : '—'}</span>
            {s === 'hold'
              ? <span style={{color: holdLeft(l).includes('expired') ? '#ff3b30' : '#b8860b', fontWeight:600}}>{holdLeft(l)}</span>
              : <span style={{color: ageDays(l.stage_changed_at || l.created_at) >= 5 ? '#b8860b' : '#86868b'}}>
                  {ageDays(l.stage_changed_at || l.created_at)}d in stage</span>}
          </div>
          {l.owner && <div className="s">{l.owner}</div>}
        </div>)}
      </div>)}
    </div>

    <div className={'ldscrim' + (openLead ? ' open' : '')} onClick={() => setOpenLead(null)} />
    <div className={'ldrawer' + (openLead ? ' open' : '')}>
      {openLead && <>
        <div className="ld-head">
          <button className="close" onClick={() => setOpenLead(null)}>✕</button>
          <h2><a className="namelink" href={'/collectors/' + openLead.collector_id}>
            {c.first_name} {c.last_name}</a>
            {openLead.inquiryCount > 1 && <span className="badge">{openLead.inquiryCount} open inquiries</span>}
            {c.trade ? <span className="badge">Trade</span> : null}</h2>
          <div className="sub">{[c.email, c.phone].filter(Boolean).join(' · ')}</div>
          <div style={{marginTop:12, display:'flex', gap:10, alignItems:'center'}}>
            <select className="stagesel" style={{background: COLOR[openLead.status]}}
              value={openLead.status} onChange={e => move(openLead.id, e.target.value)}>
              {STAGES.map(s => <option key={s} value={s}>{LABEL[s]}</option>)}
            </select>
            <button className="btn ghost mini" onClick={async () => {
              const fd = new FormData(); fd.set('action','called'); fd.set('id', openLead.id);
              await fetch('/api/act', { method:'POST', body: fd });
              setOpenLead(o => ({ ...o, first_called_at: o.first_called_at || new Date().toISOString(),
                contacted_at: o.contacted_at || new Date().toISOString(),
                status: o.status === 'new' ? 'contacted' : o.status }));
              setLeads(ls => ls.map(l => l.id === openLead.id ? { ...l,
                first_called_at: l.first_called_at || new Date().toISOString(),
                status: l.status === 'new' ? 'contacted' : l.status } : l));
            }}>{openLead.first_called_at ? '✓ Called' : 'Log call'}</button>
            {!openLead.contacted_at && <span style={{fontSize:12, color:'#ff3b30', fontWeight:600}}>
              Awaiting first response</span>}
          </div>
        </div>
        <div className="ld-body">
        {a && <a className="ld-artwork" href={'/inventory/' + a.id}>
          {a.image_url && <img src={a.image_url + (a.image_url.includes('?') ? '&' : '?') + 'width=800'} alt="" />}
          <div className="cap">
            <div><div className="t">{a.title}</div><div className="a">{a.artist}{a.medium ? ' · ' + a.medium : ''}</div></div>
            <div style={{textAlign:'right'}}>
              <div className="p">{(a.price_cents || 0) > 0 ? usd(a.price_cents) : 'POR'}</div>
              <div className="open">Open in inventory →</div>
            </div>
          </div>
        </a>}
        <dl className="kv">
          {!a && <><dt>Inquiring about</dt><dd>{openLead.artwork_title || openLead.purpose}</dd></>}
          <dt>Budget</dt><dd>{openLead.budget_range || c.budget_range || 'Not stated'}</dd>
          <dt>Timeframe</dt><dd>{openLead.timeframe || '—'}</dd>
          <dt>City</dt><dd>{[c.city, c.timezone].filter(Boolean).join(' · ') || '—'}</dd>
          <dt>Found us via</dt><dd>{openLead.source || c.source || '—'}</dd>
          <dt>Device</dt><dd>{openLead.device || '—'}</dd>
          <dt>Time on page</dt><dd>{openLead.seconds_on_page ? openLead.seconds_on_page + 's' : '—'}</dd>
          <dt>Owner</dt><dd>{openLead.owner || 'Unclaimed'}</dd>
        </dl>
        {openLead.page_journey && <div className="msg"><b style={{fontSize:12}}>Path through the site</b><br/>
          {openLead.page_journey}</div>}
        {openLead.message && <div className="msg">{openLead.message}</div>}

        {!['invoice','paid'].includes(openLead.status) && <div style={{marginTop:18, padding:'14px 16px',
          background:'#f5f5f7', borderRadius:12}}>
          <div style={{fontSize:12, fontWeight:600, marginBottom:8}}>
            {sale ? `Open sale · ${sale.sale_items.length} work${sale.sale_items.length > 1 ? 's' : ''} · ${usd(saleTotal)}` : 'Start a sale'}
          </div>
          {sale && sale.sale_items.map(i => <div key={i.id} style={{fontSize:12, color:'#515154',
            display:'flex', justifyContent:'space-between', padding:'3px 0'}}>
            <span>{i.title}</span><span style={{fontVariantNumeric:'tabular-nums'}}>{usd(i.agreed_cents)}</span>
          </div>)}
          {!inSale && <>
          {a?.price_cents > 0 && <div style={{display:'flex', gap:6, marginTop:8, flexWrap:'wrap'}}>
            {[[0, 'List ' + usd(a.price_cents)], [5, '−5%'], [10, '−10%'], [15, '−15%']].map(([pct, label]) =>
              <button key={pct} onClick={() => setAgreed(String(Math.round(a.price_cents * (100 - pct) / 100) / 100))}
                style={{border:'1px solid #e8e8ed', background: '#fff', borderRadius:980, fontFamily:'inherit',
                  fontSize:12, fontWeight:600, padding:'5px 12px', cursor:'pointer'}}>{label}</button>)}
          </div>}
          <div style={{display:'flex', gap:8, marginTop:8}}>
            <input type="number" step="0.01" placeholder="Agreed price $"
              value={agreed} onChange={e => setAgreed(e.target.value)}
              style={{flex:1, border:'1px solid #e8e8ed', borderRadius:10, fontFamily:'inherit',
                fontSize:13.5, padding:'8px 12px', outline:'none'}}/>
            <button className="btn" onClick={addToSale}>{sale ? 'Add to sale' : 'Start sale'}</button>
          </div>
          {agreed > 0 && (() => {
            const cents = Math.round(Number(agreed) * 100);
            const disc = a?.price_cents > 0 ? Math.round((1 - cents / a.price_cents) * 1000) / 10 : null;
            const col = disc === null ? '#86868b' : disc <= 0 ? '#34c759' : disc <= 10 ? '#86868b' : disc <= 20 ? '#b8860b' : '#ff3b30';
            return <div style={{fontSize:12, marginTop:8, fontWeight:600, color: col}}>
              {usd(cents)}{disc !== null && disc > 0 ? ` · ${disc}% below list` : disc !== null && disc < 0 ? ' · above list' : disc === 0 ? ' · at list' : ''}
              {disc !== null && disc > 20 ? ' — deep discount, visible on the board' : ''}
            </div>; })()}
          </>}
          {sale && sale.sale_items.length > 0 && <button className="btn" style={{width:'100%', marginTop:10}}
            onClick={invoiceSale}>Generate invoice · {usd(saleTotal)}</button>}
        </div>}

        <div style={{display:'flex', gap:8, marginTop:16}}>
          <input placeholder="Quick note — saves to the collector" value={note}
            onChange={e => setNote(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveNote(); }}
            style={{flex:1, border:'1px solid #e8e8ed', borderRadius:10, fontFamily:'inherit',
              fontSize:13.5, padding:'8px 12px', outline:'none'}}/>
          <button className="btn ghost mini" onClick={saveNote}>Save</button>
        </div>
        </div>
      </>}
    </div>
  </>;
}
