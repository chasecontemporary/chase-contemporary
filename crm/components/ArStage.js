'use client';

// AR chase stage for an open invoice — plain follow-up ladder. Paid is automatic.
const STAGES = [['issued','Unsent'],['sent','Sent'],['fu1','Follow up 1'],['fu2','Follow up 2'],['fu3','Follow up 3']];
export default function ArStage({ id, value }) {
  const post = async (st) => {
    const fd = new FormData();
    fd.set('action', 'invoice_ar'); fd.set('id', id); fd.set('ar_status', st); fd.set('back', 'json');
    await fetch('/api/act', { method: 'POST', body: fd });
    window.location.reload();
  };
  return <select className="sel rect" value={value || 'issued'} style={{maxWidth:130}}
    onChange={(e) => post(e.target.value)}>
    {STAGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
  </select>;
}
