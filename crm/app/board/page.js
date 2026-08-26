import Shell from '../../components/Shell';
import { db } from '../../lib/db';
export const dynamic = 'force-dynamic';

export default async function Board() {
  const { count: collectors } = await db.from('collectors').select('id', { count: 'exact', head: true });
  const { count: works } = await db.from('artworks').select('id', { count: 'exact', head: true });
  const { data: inqs } = await db.from('inquiries').select('status, artist, source, created_at, contacted_at, owner');
  const rows = inqs || [];
  const openN = rows.filter(r => ['new','contacted','in_conversation','hold','invoice'].includes(r.status)).length;
  const answered = rows.filter(r => r.contacted_at);
  const avgMins = answered.length
    ? Math.round(answered.reduce((s, r) => s + (new Date(r.contacted_at) - new Date(r.created_at)) / 60000, 0) / answered.length)
    : null;
  const by = (key) => Object.entries(rows.reduce((m, r) => {
    const k = r[key] || '—'; m[k] = (m[k] || 0) + 1; return m; }, {}))
    .sort((a, b) => b[1] - a[1]).slice(0, 8);
  return <Shell active="board">
    <div className="h1">WHAT BERNIE SEES</div>
    <div className="sub">LIVE · NOT MONTH-END REPORTS</div>
    <div className="stats">
      <div className="stat"><div className="n">{rows.length}</div><div className="l">INQUIRIES ALL-TIME</div></div>
      <div className="stat"><div className="n">{openN}</div><div className="l">OPEN PIPELINE</div></div>
      <div className="stat"><div className="n">{avgMins === null ? '—' : avgMins + 'M'}</div><div className="l">AVG FIRST RESPONSE</div></div>
      <div className="stat"><div className="n">{collectors || 0}</div><div className="l">COLLECTORS</div></div>
    </div>
    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:40, marginTop:50}}>
      {[['BY ARTIST','artist'],['BY SOURCE','source'],['BY OWNER','owner']].map(([label,key]) =>
      <div key={key}>
        <div className="sub" style={{color:'#000', fontWeight:600}}>{label}</div>
        <table className="tbl"><tbody>
          {by(key).map(([k, n]) => <tr key={k}><td>{k}</td><td style={{textAlign:'right', fontWeight:600}}>{n}</td></tr>)}
        </tbody></table>
      </div>)}
    </div>
    <div className="sub" style={{marginTop:50}}>{works || 0} WORKS IN THE BOOK · REP LEADERBOARD ACTIVATES WITH SALES DATA</div>
  </Shell>;
}
