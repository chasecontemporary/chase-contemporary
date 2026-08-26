'use client';
import { useState } from 'react';

const STAGES = ['new','contacted','in_conversation','hold','invoice','paid','nurture'];
const LABEL = { new:'New', contacted:'Contacted', in_conversation:'In conversation',
  hold:'Hold', invoice:'Invoice', paid:'Paid', nurture:'Nurture' };
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

  const move = async (id, status) => {
    setLeads(ls => ls.map(l => l.id === id ? { ...l, status } : l));
    const fd = new FormData();
    fd.set('action', 'status'); fd.set('id', id); fd.set('status', status); fd.set('back', '/pipeline');
    fetch('/api/act', { method: 'POST', body: fd }).catch(() => {});
  };
  const markAnswered = async (id) => {
    setLeads(ls => ls.map(l => l.id === id ? { ...l, status: 'contacted', contacted_at: new Date().toISOString() } : l));
    if (openLead?.id === id) setOpenLead(o => ({ ...o, status: 'contacted', contacted_at: new Date().toISOString() }));
    const fd = new FormData();
    fd.set('action', 'contacted'); fd.set('id', id);
    fetch('/api/act', { method: 'POST', body: fd }).catch(() => {});
  };

  const c = openLead?.collectors || {};
  const a = openLead?.artwork;
  const [agreed, setAgreed] = useState('');
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
        <h3>{LABEL[s]} · {leads.filter(l => l.status === s).length}
          <span style={{float:'right', fontVariantNumeric:'tabular-nums'}}>
            {(() => { const v = leads.filter(l => l.status === s).reduce((t, l) => t + leadValue(l), 0);
              return v ? usd(v) : ''; })()}</span></h3>
        {leads.filter(l => l.status === s).map(l => <div key={l.id}
          className={'kcard' + (dragId === l.id ? ' dragging' : '')}
          draggable
          onDragStart={() => setDragId(l.id)}
          onDragEnd={() => setDragId(null)}
          onClick={() => setOpenLead(l)}>
          <div style={{display:'flex', gap:10}}>
            {l.artwork?.image_url && <img src={l.artwork.image_url + (l.artwork.image_url.includes('?') ? '&' : '?') + 'width=88'}
              alt="" style={{width:40, height:40, objectFit:'cover', borderRadius:8, flexShrink:0}}/>}
            <div style={{minWidth:0}}>
              <div className="t">{l.collectors?.first_name} {l.collectors?.last_name}</div>
              <div className="s" style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{l.artwork_title || l.purpose}</div>
            </div>
          </div>
          <div className="s" style={{display:'flex', justifyContent:'space-between', marginTop:6}}>
            <span style={{fontWeight:600, color:'#1d1d1f'}}>{leadValue(l) ? usd(leadValue(l)) : '—'}</span>
            {s === 'hold'
              ? <span style={{color: holdLeft(l).includes('expired') || holdLeft(l).startsWith('1h') ? '#ff3b30' : '#b8860b', fontWeight:600}}>{holdLeft(l)}</span>
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
        <button className="close" onClick={() => setOpenLead(null)}>✕</button>
        {a?.image_url && <img className="art" src={a.image_url + (a.image_url.includes('?') ? '&' : '?') + 'width=760'} alt="" />}
        <h2>{c.first_name} {c.last_name}{c.trade ? ' · Trade' : ''}</h2>
        <div className="sub">{[c.email, c.phone].filter(Boolean).join(' · ')}</div>
        <dl className="kv">
          <dt>Inquiring about</dt><dd>{openLead.artwork_title || openLead.purpose}</dd>
          {a && <><dt>Artist</dt><dd>{a.artist}</dd>
            <dt>Price</dt><dd>{(a.price_cents || 0) > 0 ? usd(a.price_cents) : 'Price on request'}</dd>
            {a.medium ? <><dt>Medium</dt><dd>{a.medium}</dd></> : null}
            {a.dims_h_in ? <><dt>Size</dt><dd>{a.dims_h_in} × {a.dims_w_in} in</dd></> : null}
            <dt>Availability</dt><dd>{a.available ? 'Available' : 'Sold'}</dd></>}
          <dt>Budget</dt><dd>{openLead.budget_range || c.budget_range || 'Not stated'}</dd>
          <dt>Timeframe</dt><dd>{openLead.timeframe || '—'}</dd>
          <dt>City</dt><dd>{[c.city, c.timezone].filter(Boolean).join(' · ') || '—'}</dd>
          <dt>Found us via</dt><dd>{openLead.source || c.source || '—'}</dd>
          <dt>Device</dt><dd>{openLead.device || '—'}</dd>
          <dt>Time on page</dt><dd>{openLead.seconds_on_page ? openLead.seconds_on_page + 's' : '—'}</dd>
          <dt>Owner</dt><dd>{openLead.owner || 'Unclaimed'}</dd>
          <dt>Stage</dt><dd style={{textTransform:'capitalize'}}>{(openLead.status || '').replace('_',' ')}</dd>
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
          {!inSale && <div style={{display:'flex', gap:8, marginTop:8}}>
            <input type="number" step="0.01" placeholder={a?.price_cents ? 'Agreed $ (' + Math.round(a.price_cents/100).toLocaleString() + ')' : 'Agreed price $'}
              value={agreed} onChange={e => setAgreed(e.target.value)}
              style={{flex:1, border:'1px solid #e8e8ed', borderRadius:10, fontFamily:'inherit',
                fontSize:13.5, padding:'8px 12px', outline:'none'}}/>
            <button className="btn" onClick={addToSale}>{sale ? 'Add to sale' : 'Start sale'}</button>
          </div>}
          {sale && sale.sale_items.length > 0 && <button className="btn" style={{width:'100%', marginTop:10}}
            onClick={invoiceSale}>Generate invoice · {usd(saleTotal)}</button>}
        </div>}
        <div className="acts">
          {!openLead.contacted_at && <button className="btn ghost" onClick={() => markAnswered(openLead.id)}>Mark answered</button>}
          <a className="btn ghost" href={'/collectors/' + openLead.collector_id}>Full collector card</a>
          {STAGES.filter(s => s !== openLead.status).slice(0, 3).map(s =>
            <button key={s} className="btn ghost" onClick={() => { move(openLead.id, s); setOpenLead(o => ({...o, status: s})); }}>
              → {LABEL[s]}</button>)}
        </div>
      </>}
    </div>
  </>;
}
