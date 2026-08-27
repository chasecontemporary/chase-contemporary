'use client';
import { useEffect, useState } from 'react';
export default function RepPicker() {
  const [team, setTeam] = useState([]);
  const [me, setMe] = useState('');
  useEffect(() => {
    fetch('/api/team').then(r => r.json()).then(setTeam).catch(() => {});
    setMe(decodeURIComponent(document.cookie.match(/cc_rep=([^;]+)/)?.[1] || ''));
  }, []);
  const set = async (rep) => {
    const fd = new FormData(); fd.set('rep', rep);
    await fetch('/api/rep', { method: 'POST', body: fd });
    setMe(rep); window.location.reload();
  };
  return <div style={{position:'absolute', bottom:28, left:16, right:16}}>
    <div style={{fontSize:11, color:'#86868b', fontWeight:600, padding:'0 2px 6px'}}>Signed in as</div>
    <select value={me} onChange={e => set(e.target.value)} className="sel" style={{width:'100%', maxWidth:'none'}}>
      <option value="" disabled>Choose…</option>
      {team.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
    </select>
  </div>;
}
