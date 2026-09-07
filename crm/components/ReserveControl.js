'use client';
import { useState } from 'react';
import BrandSelect from './BrandSelect';

// "I'm holding this until Friday." A reserve sits on the work so two salespeople can't
// promise the same canvas. The work never leaves the gallery.
const dayLabel = (n) => {
  const d = new Date(Date.now() + n * 86400000);
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
};

export default function ReserveControl({ artworkId, artworkTitle, collectorId, collectorName,
  inquiryId, reserve, compact }) {
  const [days, setDays] = useState('3');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [open, setOpen] = useState(false);

  const call = async (fields) => {
    setBusy(true); setErr(null);
    const fd = new FormData();
    Object.entries(fields).forEach(([k, v]) => fd.set(k, v));
    fd.set('back', 'json');
    try {
      const r = await fetch('/api/act', { method: 'POST', body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'That did not work.');
      window.location.reload();
    } catch (e) {
      setErr(e.message); setBusy(false);
    }
  };

  // already held — show by whom, until when, and how to let it go
  if (reserve) {
    const until = reserve.expires_at ? new Date(reserve.expires_at) : null;
    const lapsed = until && until < new Date();
    const who = [reserve.first_name, reserve.last_name].filter(Boolean).join(' ') || 'a collector';
    return <div style={{background: lapsed ? '#fdf3e3' : '#eef6f0',
      border: '1px solid ' + (lapsed ? '#e8d5ae' : '#cfe3d6'), padding: '12px 14px', fontSize: 13.5}}>
      <div style={{fontSize:10.5, fontWeight:700, letterSpacing:'.08em',
        color: lapsed ? '#7a5310' : '#1f5c36'}}>{lapsed ? 'HOLD HAS LAPSED' : 'ON HOLD'}</div>
      <div style={{marginTop:6, fontWeight:600}}>
        {who}{until ? (lapsed ? ` — was until ${until.toLocaleDateString()}` : ` until ${until.toLocaleDateString()}`) : ''}
      </div>
      {reserve.placed_by && <div style={{fontSize:12.5, color:'#3a3a35'}}>Placed by {reserve.placed_by}</div>}
      {reserve.note && <div style={{fontSize:12.5, fontStyle:'italic', marginTop:3}}>&ldquo;{reserve.note}&rdquo;</div>}
      <div style={{display:'flex', gap:8, marginTop:10, flexWrap:'wrap'}}>
        <button className="btn mini quiet" disabled={busy}
          onClick={() => call({ action:'reserve_release', hold_id: reserve.id, id: artworkId })}>
          {busy ? 'Working…' : 'Release the hold'}</button>
      </div>
      {err && <div style={{color:'#c02d23', fontSize:12.5, marginTop:8, fontWeight:600}}>{err}</div>}
    </div>;
  }

  if (!open) return <div>
    <button className="btn mini quiet" onClick={() => setOpen(true)}>Hold this work</button>
    {compact && <span style={{fontSize:11.5, color:'#73736c', marginLeft:10}}>
      stops anyone else selling it</span>}
  </div>;

  return <div style={{border:'1px solid #e3e3dd', padding:'12px 14px', background:'#fff'}}>
    <div style={{fontSize:13.5, marginBottom:10}}>
      Hold <b>{artworkTitle || 'this work'}</b>{collectorName ? <> for <b>{collectorName}</b></> : ''} —
      nobody else can invoice it until the hold ends or you release it.
    </div>
    <div style={{display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}>
      <BrandSelect options={[['1','Until tomorrow'],['3','3 days'],['7','A week'],['14','Two weeks']]}
        value={days} onValue={setDays} width={168}/>
      <span style={{fontSize:12.5, color:'#73736c'}}>ends {dayLabel(Number(days))}</span>
    </div>
    <input value={note} onChange={e => setNote(e.target.value)}
      placeholder="Why, in a few words — e.g. confirming with her partner"
      style={{width:'100%', marginTop:10, height:36, border:'1px solid #e3e3dd', borderRadius:2,
        fontFamily:'inherit', fontSize:13, padding:'0 11px', outline:'none'}}/>
    <div style={{display:'flex', gap:8, marginTop:10}}>
      <button className="btn mini" disabled={busy || !collectorId}
        style={busy || !collectorId ? {opacity:.5} : {}}
        onClick={() => call({ action:'reserve_create', id: artworkId, collector_id: collectorId,
          inquiry_id: inquiryId || '', days, note, artwork_title: artworkTitle || '' })}>
        {busy ? 'Holding…' : 'Hold it'}</button>
      <button className="btn mini quiet" onClick={() => { setOpen(false); setErr(null); }}>Cancel</button>
    </div>
    {!collectorId && <div style={{fontSize:12, color:'#9a551a', marginTop:8}}>
      A hold needs a collector — open this from their lead or card.</div>}
    {err && <div style={{color:'#c02d23', fontSize:12.5, marginTop:8, fontWeight:600}}>{err}</div>}
  </div>;
}
