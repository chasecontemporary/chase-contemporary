import Shell from '../../components/Shell';
import { db } from '../../lib/db';
export const dynamic = 'force-dynamic';

export default async function Board() {
  const { count: collectors } = await db.from('collectors').select('id', { count: 'exact', head: true });
  const { count: works } = await db.from('artworks').select('id', { count: 'exact', head: true });
  const { data: inqs } = await db.from('inquiries').select('status, artist, source, created_at, contacted_at, first_called_at, owner');
  const rows = inqs || [];
  const openN = rows.filter(r => ['new','contacted','in_conversation','hold','invoice'].includes(r.status)).length;
  const answered = rows.filter(r => r.contacted_at);
  const avgMins = answered.length
    ? Math.round(answered.reduce((s, r) => s + (new Date(r.contacted_at) - new Date(r.created_at)) / 60000, 0) / answered.length)
    : null;
  const called = rows.filter(r => r.first_called_at);
  const avgCallMins = called.length
    ? Math.round(called.reduce((s, r) => s + (new Date(r.first_called_at) - new Date(r.created_at)) / 60000, 0) / called.length)
    : null;
  const fmtM = (m) => m === null ? '—' : m < 60 ? m + 'm' : m < 1440 ? Math.round(m/60) + 'h' : Math.round(m/1440) + 'd';
  const by = (key) => Object.entries(rows.reduce((m, r) => {
    const k = r[key] || '—'; m[k] = (m[k] || 0) + 1; return m; }, {}))
    .sort((a, b) => b[1] - a[1]).slice(0, 8);
  return <Shell active="board">
    <div className="h1">Board</div>
    <div className="sub">Live answers, not month-end reports.</div>
    <div className="stats" style={{gridTemplateColumns:"repeat(5,1fr)"}}>
      <div className="stat"><div className="n">{rows.length}</div><div className="l">Inquiries all-time</div></div>
      <div className="stat"><div className="n">{openN}</div><div className="l">Open pipeline</div></div>
      <div className="stat"><div className="n">{avgMins === null ? '—' : avgMins + 'm'}</div><div className="l">Avg first response</div></div>
      <div className="stat"><div className="n">{fmtM(avgCallMins)}</div><div className="l">Inquiry → first call</div></div>
      <div className="stat"><div className="n">{collectors || 0}</div><div className="l">Collectors</div></div>
    </div>
    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14}}>
      {[['By artist','artist'],['By source','source'],['By owner','owner']].map(([label,key]) =>
      <div className="tblcard" key={key}>
        <table className="tbl"><thead><tr><th>{label}</th><th style={{textAlign:'right'}}>Inquiries</th></tr></thead><tbody>
          {by(key).map(([k, n]) => <tr key={k}><td>{k}</td><td style={{textAlign:'right', fontWeight:600}}>{n}</td></tr>)}
        </tbody></table>
      </div>)}
    </div>
    <div className="empty">{works || 0} works in the book · Rep leaderboard activates with sales data.</div>
  </Shell>;
}
