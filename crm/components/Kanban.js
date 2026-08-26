'use client';
import { useState } from 'react';

const STAGES = ['new','contacted','in_conversation','hold','invoice','paid','nurture'];
const LABEL = { new:'New', contacted:'Contacted', in_conversation:'In conversation',
  hold:'Hold', invoice:'Invoice', paid:'Paid', nurture:'Nurture' };
const usd = (c) => '$' + Math.round((c || 0) / 100).toLocaleString();

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

  return <>
    <div className="cols">
      {STAGES.map(s => <div key={s}
        className={'col kcol' + (overCol === s ? ' over' : '')}
        onDragOver={e => { e.preventDefault(); setOverCol(s); }}
        onDragLeave={() => setOverCol(null)}
        onDrop={e => { e.preventDefault(); setOverCol(null); if (dragId) move(dragId, s); setDragId(null); }}>
        <h3>{LABEL[s]} · {leads.filter(l => l.status === s).length}</h3>
        {leads.filter(l => l.status === s).map(l => <div key={l.id}
          className={'kcard' + (dragId === l.id ? ' dragging' : '')}
          draggable
          onDragStart={() => setDragId(l.id)}
          onDragEnd={() => setDragId(null)}
          onClick={() => setOpenLead(l)}>
          <div className="t">{l.collectors?.first_name} {l.collectors?.last_name}</div>
          <div className="s">{l.artwork_title || l.purpose}</div>
          <div className="s">{[l.budget_range, l.owner].filter(Boolean).join(' · ')}</div>
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
        <div className="acts">
          {!openLead.contacted_at && <button className="btn" onClick={() => markAnswered(openLead.id)}>Mark answered</button>}
          <a className="btn ghost" href={'/collectors/' + openLead.collector_id}>Full collector card</a>
          {STAGES.filter(s => s !== openLead.status).slice(0, 3).map(s =>
            <button key={s} className="btn ghost" onClick={() => { move(openLead.id, s); setOpenLead(o => ({...o, status: s})); }}>
              → {LABEL[s]}</button>)}
        </div>
      </>}
    </div>
  </>;
}
