export default function Sla({ createdAt, contactedAt }) {
  if (contactedAt) return <span className="sla ok">Answered</span>;
  const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  const label = mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.floor(mins/60)}h ${mins%60}m` : `${Math.floor(mins/1440)}d`;
  return <span className={'sla' + (mins >= 5 ? ' hot' : '')}>{label}</span>;
}
