import Shell from '../../components/Shell';
import { db } from '../../lib/db';
export const dynamic = 'force-dynamic';
const STAGES = ['new','contacted','in_conversation','hold','invoice','paid','nurture'];
const LABEL = { new:'NEW', contacted:'CONTACTED', in_conversation:'IN CONVERSATION', hold:'HOLD', invoice:'INVOICE', paid:'PAID', nurture:'NURTURE' };

export default async function Pipeline() {
  const { data: rows } = await db.from('inquiries')
    .select('*, collectors(first_name,last_name)')
    .neq('status','closed').order('created_at', { ascending: false }).limit(300);
  return <Shell active="pipeline">
    <div className="h1">PIPELINE</div>
    <div className="sub">{rows?.length || 0} OPEN</div>
    <div className="cols">
      {STAGES.map(s => <div className="col" key={s}>
        <h3>{LABEL[s]} · {(rows||[]).filter(r=>r.status===s).length}</h3>
        {(rows||[]).filter(r=>r.status===s).map(r => <div className="pcardk" key={r.id}>
          <div className="t">{r.collectors?.first_name} {r.collectors?.last_name}</div>
          <div className="s">{r.artwork_title || r.purpose}</div>
          <div className="s">{[r.budget_range, r.owner].filter(Boolean).join(' · ')}</div>
          <form method="POST" action="/api/act" style={{marginTop:8, display:'flex', gap:6}}>
            <input type="hidden" name="action" value="status"/>
            <input type="hidden" name="id" value={r.id}/>
            <input type="hidden" name="back" value="/pipeline"/>
            {STAGES.indexOf(s) > 0 && <button className="btn ghost" name="status" value={STAGES[STAGES.indexOf(s)-1]} style={{padding:'5px 9px'}}>&larr;</button>}
            {STAGES.indexOf(s) < STAGES.length-1 && <button className="btn" name="status" value={STAGES[STAGES.indexOf(s)+1]} style={{padding:'5px 9px'}}>&rarr;</button>}
          </form>
        </div>)}
      </div>)}
    </div>
  </Shell>;
}
