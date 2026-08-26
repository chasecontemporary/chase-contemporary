export default function Shell({ active, children }) {
  const items = [['today','TODAY'],['pipeline','PIPELINE'],['collectors','COLLECTORS'],['board','BOARD']];
  return <div className="shell">
    <aside className="side">
      <div className="h1" style={{lineHeight:1.5}}>CHASE<br/>CONTEM<br/>PORARY</div>
      <nav>{items.map(([href,label]) =>
        <a key={href} href={'/'+href} className={active===href?'on':''}>{label}</a>)}
      </nav>
      <div className="sub" style={{position:'absolute',bottom:34}}>ENGINE V1</div>
    </aside>
    <main className="main">{children}</main>
  </div>;
}
