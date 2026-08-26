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
    </aside>
    <main className="main">{children}</main>
  </div>;
}
