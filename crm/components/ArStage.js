'use client';

// Chase-stage dropdown, color-coded, safe to use inside a <summary> row.
const STAGES = [['issued','Unsent'],['sent','Sent'],['fu1','Follow up 1'],['fu2','Follow up 2'],['fu3','Follow up 3']];
const COLOR = { issued:'#8e8e93', sent:'#0071e3', fu1:'#5e5ce6', fu2:'#af52de', fu3:'#ff9500' };
export default function ArStage({ id, value }) {
  const v = value || 'issued';
  const post = async (st) => {
    const fd = new FormData();
    fd.set('action', 'invoice_ar'); fd.set('id', id); fd.set('ar_status', st); fd.set('back', 'json');
    await fetch('/api/act', { method: 'POST', body: fd });
    window.location.reload();
  };
  return <select value={v} onChange={(e) => post(e.target.value)}
    onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
    style={{appearance:'none', WebkitAppearance:'none', background: COLOR[v] +
      " url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='white' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\") no-repeat right 9px center",
      color:'#fff', border:0, borderRadius:99, height:24, padding:'0 22px 0 11px',
      fontFamily:'inherit', fontSize:10.5, fontWeight:700, cursor:'pointer',
      letterSpacing:'.04em', textTransform:'uppercase', whiteSpace:'nowrap'}}>
    {STAGES.map(([k, l]) => <option key={k} value={k} style={{background:'#fff', color:'#1d1d1f', textTransform:'none'}}>{l}</option>)}
  </select>;
}
