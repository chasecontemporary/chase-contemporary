export default function Shell({ active, children, counts = {} }) {
  const items = [['today','Today'],['pipeline','Pipeline'],['collectors','Collectors'],
                 ['inventory','Inventory'],['finance','Finance'],['commissions','Commissions'],['board','Board']];
  return <div className="shell">
    <aside className="side">
      <div className="brand">Chase Engine<small>Chase Contemporary</small></div>
      <nav>{items.map(([href,label]) =>
        <a key={href} href={'/'+href} className={active===href?'on':''}>
          <span>{label}</span>{counts[href] ? <span className="n">{counts[href]}</span> : null}
        </a>)}
      </nav>
      <div style={{position:'absolute', bottom:28, left:16, right:16}}>
        <form method="POST" action="/api/rep">
          <select name="rep" defaultValue="" onChange={undefined}
            style={{width:'100%', background:'#fff', border:'1px solid #e8e8ed', borderRadius:10,
              fontFamily:'inherit', fontSize:13, padding:'8px 10px'}}>
            <option value="" disabled>I am…</option>
            {['Devyn','Wyatt','Bernie','Sara'].map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <button className="btn ghost mini" style={{width:'100%', marginTop:8}}>Set</button>
        </form>
      </div>
    </aside>
    <main className="main">{children}</main>
  </div>;
}
