'use client';
import BrandSelect from './BrandSelect';

const STAGES = [['issued','Unsent'],['sent','Sent'],['fu1','Follow up 1'],['fu2','Follow up 2'],['fu3','Follow up 3']];
const COLOR = { issued:'#8e8e93', sent:'#0071e3', fu1:'#5e5ce6', fu2:'#af52de', fu3:'#ff9500' };
export default function ArStage({ id, value }) {
  const post = async (st) => {
    const fd = new FormData();
    fd.set('action', 'invoice_ar'); fd.set('id', id); fd.set('ar_status', st); fd.set('back', 'json');
    await fetch('/api/act', { method: 'POST', body: fd });
    window.location.reload();
  };
  return <BrandSelect pill options={STAGES} value={value || 'issued'}
    pillColor={(v) => COLOR[v] || '#8e8e93'} onValue={post}/>;
}
