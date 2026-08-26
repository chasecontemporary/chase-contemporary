import Shell from '../../components/Shell';
import { db } from '../../lib/db';
export const dynamic = 'force-dynamic';
const usd = (c) => '$' + Math.round((c || 0) / 100).toLocaleString();

export default async function Collectors({ searchParams }) {
  const q = (await searchParams)?.q || '';
  let query = db.from('collectors').select('*').order('created_at', { ascending: false }).limit(200);
  if (q) query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,city.ilike.%${q}%,company.ilike.%${q}%`);
  const { data: rows } = await query;
  const ids = (rows || []).map(r => r.id);
  const spend = {};
  if (ids.length) {
    const { data: buys } = await db.from('purchases').select('collector_id, amount_cents').in('collector_id', ids);
    (buys || []).forEach(b => { spend[b.collector_id] = (spend[b.collector_id] || 0) + b.amount_cents; });
  }
  const sorted = (rows || []).sort((a, b) => (spend[b.id] || 0) - (spend[a.id] || 0));
  return <Shell active="collectors">
    <div className="h1">Collectors</div>
    <div className="sub">{sorted.length} shown · ranked by lifetime value</div>
    <form><input className="search" name="q" defaultValue={q} placeholder="Search name, email, city, company" /></form>
    <div className="tblcard"><table className="tbl"><thead><tr>
      <th>Name</th><th>Lifetime</th><th>Email</th><th>City</th><th>Budget</th><th>Source</th><th>Flags</th>
    </tr></thead><tbody>
      {sorted.map(c => <tr key={c.id}>
        <td><a href={'/collectors/'+c.id} style={{fontWeight:600}}>{c.first_name} {c.last_name}</a></td>
        <td style={{fontVariantNumeric:'tabular-nums', fontWeight:600}}>{spend[c.id] ? usd(spend[c.id]) : '—'}</td>
        <td>{c.email}</td><td>{c.city}</td><td>{c.budget_range}</td><td>{c.source}</td>
        <td>{c.trade ? <span className="pill blue">Trade</span> : null} {c.newsletter ? <span className="pill">News</span> : null}</td>
      </tr>)}
    </tbody></table></div>
  </Shell>;
}
