export default function Sla({ createdAt, contactedAt }) {
  if (contactedAt) return <span className="sla" style={{color:'#757575'}}>ANSWERED</span>;
  const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  const label = mins < 60 ? `${mins}M` : mins < 1440 ? `${Math.floor(mins/60)}H ${mins%60}M` : `${Math.floor(mins/1440)}D`;
  return <span className={'sla' + (mins >= 5 ? ' hot' : '')}>{label}</span>;
}
