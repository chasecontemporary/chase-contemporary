import Shell from '../../components/Shell';
import { db } from '../../lib/db';
export const dynamic = 'force-dynamic';

export default async function Collectors({ searchParams }) {
  const q = (await searchParams)?.q || '';
  let query = db.from('collectors').select('*').order('created_at', { ascending: false }).limit(100);
  if (q) query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,city.ilike.%${q}%`);
  const { data: rows } = await query;
  return <Shell active="collectors">
    <div className="h1">COLLECTORS</div>
    <div className="sub">{rows?.length || 0} SHOWN</div>
    <form style={{marginTop:26}}>
      <input name="q" defaultValue={q} placeholder="SEARCH NAME, EMAIL, CITY"
        style={{width:340, border:0, borderBottom:'1px solid #000', fontFamily:'inherit',
          fontSize:12, padding:'8px 0', outline:'none', letterSpacing:'.04em'}} />
    </form>
    <table className="tbl"><thead><tr>
      <th>NAME</th><th>EMAIL</th><th>CITY</th><th>BUDGET</th><th>SOURCE</th><th>FLAGS</th>
    </tr></thead><tbody>
      {(rows||[]).map(c => <tr key={c.id}>
        <td><a href={'/collectors/'+c.id} style={{fontWeight:600}}>{c.first_name} {c.last_name}</a></td>
        <td style={{textTransform:'lowercase'}}>{c.email}</td>
        <td>{c.city}</td><td>{c.budget_range}</td><td>{c.source}</td>
        <td>{[c.trade && 'TRADE', c.newsletter && 'NEWS'].filter(Boolean).join(' · ')}</td>
      </tr>)}
    </tbody></table>
  </Shell>;
}
