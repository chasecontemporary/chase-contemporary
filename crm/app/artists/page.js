import Shell from '../../components/Shell';
import { db } from '../../lib/db';
export const dynamic = 'force-dynamic';
const usd = (c) => '$' + Math.round((c || 0) / 100).toLocaleString();

export default async function Artists() {
  const { data: rows } = await db.from('artist_performance').select('*')
    .order('revenue_cents', { ascending: false }).limit(120);
  const list = (rows || []).filter(r => r.sold > 0 || r.on_hand > 0);
  const verdict = (r) => {
    const st = Number(r.sell_through);
    if (r.sold >= 10 && st >= 70) return ['DOUBLE DOWN', {background:'#e4f7e9', color:'#1d7a3d'}];
    if (Number(r.on_hand_value_cents) > 10000000 && (st < 40 || !r.sold)) return ['MOVE STOCK', {background:'#ffefdc', color:'#b25a00'}];
    return null;
  };
  const totRev = list.reduce((s, r) => s + Number(r.revenue_cents || 0), 0);
  const totHold = list.reduce((s, r) => s + Number(r.on_hand_value_cents || 0), 0);
  return <Shell active="artists">
    <div className="h1">Artists</div>
    <div className="sub">Capital allocation, straight from realized sales — buy deeper into velocity, move what sits</div>
    <div className="stats">
      <div className="stat"><div className="n">{list.length}</div><div className="l">Artists in the book</div></div>
      <div className="stat"><div className="n">{usd(totRev)}</div><div className="l">Lifetime realized revenue</div></div>
      <div className="stat"><div className="n">{usd(totHold)}</div><div className="l">Capital on hand (priced retail)</div></div>
      <div className="stat"><div className="n">{list.filter(r => verdict(r)?.[0] === 'MOVE STOCK').length}</div><div className="l">Artists flagged move stock</div></div>
    </div>
    <div className="tblcard"><table className="tbl"><thead><tr>
      <th>Artist</th><th>Sell-through</th><th>Sold</th><th>Revenue</th><th>Avg sale</th><th>Last sale</th><th>On hand</th><th>On-hand value</th><th></th>
    </tr></thead><tbody>
      {list.map(r => {
        const st = r.sell_through === null ? null : Number(r.sell_through);
        const v = verdict(r);
        return <tr key={r.artist}>
        <td style={{fontWeight:650}}><a href={'/inventory?view=all&artist=' + encodeURIComponent(r.artist)}>{r.artist}</a></td>
        <td>{st === null ? '—' : <span className="pill" style={{fontSize:10.5, fontWeight:700,
          ...(st >= 70 ? {background:'#e4f7e9', color:'#1d7a3d'} : st >= 40 ? {background:'#f0f0f2'} : {background:'#ffefdc', color:'#b25a00'})}}>{st}%</span>}</td>
        <td>{r.sold || '—'}</td>
        <td style={{fontVariantNumeric:'tabular-nums', fontWeight:650}}>{r.revenue_cents > 0 ? usd(r.revenue_cents) : '—'}</td>
        <td style={{fontVariantNumeric:'tabular-nums'}}>{r.avg_sale_cents > 0 ? usd(r.avg_sale_cents) : '—'}</td>
        <td style={{fontSize:12.5, color:'#86868b'}}>{r.last_sale ? new Date(r.last_sale).toLocaleDateString() : '—'}</td>
        <td>{r.on_hand || '—'}</td>
        <td style={{fontVariantNumeric:'tabular-nums'}}>{r.on_hand_value_cents > 0 ? usd(r.on_hand_value_cents) : '—'}</td>
        <td>{v && <span className="pill" style={{fontSize:10, fontWeight:700, ...v[1]}}>{v[0]}</span>}</td>
      </tr>; })}
    </tbody></table></div>
  </Shell>;
}
