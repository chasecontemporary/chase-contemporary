import Shell from '../../components/Shell';
import { db } from '../../lib/db';
export const dynamic = 'force-dynamic';

export default async function Collectors({ searchParams }) {
  const q = (await searchParams)?.q || '';
  let query = db.from('collectors').select('*').order('created_at', { ascending: false }).limit(100);
  if (q) query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,city.ilike.%${q}%`);
  const { data: rows } = await query;
  return <Shell active="collectors">
    <div className="h1">Collectors</div>
    <div className="sub">{rows?.length || 0} shown</div>
    <form><input className="search" name="q" defaultValue={q} placeholder="Search name, email, city" /></form>
    <div className="tblcard"><table className="tbl"><thead><tr>
      <th>Name</th><th>Email</th><th>City</th><th>Budget</th><th>Source</th><th>Flags</th>
    </tr></thead><tbody>
      {(rows||[]).map(c => <tr key={c.id}>
        <td><a href={'/collectors/'+c.id} style={{fontWeight:600}}>{c.first_name} {c.last_name}</a></td>
        <td>{c.email}</td><td>{c.city}</td><td>{c.budget_range}</td><td>{c.source}</td>
        <td>{c.trade ? <span className="pill blue">Trade</span> : null} {c.newsletter ? <span className="pill">News</span> : null}</td>
      </tr>)}
    </tbody></table></div>
  </Shell>;
}
