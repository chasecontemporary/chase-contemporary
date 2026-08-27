'use client';
import BrandSelect from './BrandSelect';

const STAGES = [['issued','Unsent'],['sent','Sent'],['fu1','Follow up 1'],['fu2','Follow up 2'],['fu3','Follow up 3']];
const COLOR = { issued:'#82827b', sent:'#2257c5', fu1:'#56599f', fu2:'#7d4d9e', fu3:'#b7791f' };
export default function ArStage({ id, value }) {
  const post = async (st) => {
    const fd = new FormData();
    fd.set('action', 'invoice_ar'); fd.set('id', id); fd.set('ar_status', st); fd.set('back', 'json');
    await fetch('/api/act', { method: 'POST', body: fd });
    window.location.reload();
  };
  return <BrandSelect pill options={STAGES} value={value || 'issued'}
    pillColor={(v) => COLOR[v] || '#82827b'} onValue={post}/>;
}
