'use client';
import { useState } from 'react';

// AR chase stage for an open invoice: select posts immediately; Promised asks for a date.
const STAGES = [['issued','Not sent'],['sent','Sent'],['nudged','Reminded'],['promised','Payment promised']];
export default function ArStage({ id, value, promiseDate }) {
  const [asking, setAsking] = useState(false);
  const post = async (st, date) => {
    const fd = new FormData();
    fd.set('action', 'invoice_ar'); fd.set('id', id); fd.set('ar_status', st);
    if (date) fd.set('promise_date', date);
    fd.set('back', 'json');
    await fetch('/api/act', { method: 'POST', body: fd });
    window.location.reload();
  };
  if (asking) return <input type="date" autoFocus className="sel rect" style={{maxWidth:150}}
    onChange={(e) => e.target.value && post('promised', e.target.value)}
    onBlur={() => setAsking(false)}/>;
  return <select className="sel rect" value={value || 'issued'} style={{maxWidth:120}}
    onChange={(e) => e.target.value === 'promised' ? setAsking(true) : post(e.target.value)}>
    {STAGES.map(([k, l]) => <option key={k} value={k}>{l}{k === 'promised' && promiseDate ? ' ' + new Date(promiseDate).toLocaleDateString() : ''}</option>)}
  </select>;
}
