import RepPicker from './RepPicker';
export default function Shell({ active, children, counts = {} }) {
  const emailOpen = ['audiences', 'campaigns'].includes(active);
  const items = [['today','Today'],['pipeline','Pipeline'],['collectors','Collectors'],
                 ['inventory','Inventory'],['artists','Artists'],['finance','Finance'],['commissions','Commissions'],
                 ['EMAIL_GROUP'],['team','Team']];
  return <div className="shell">
    <aside className="side">
      <div className="brand">Chase Engine<small>Chase Contemporary</small></div>
      <nav>{items.map((it) => {
        if (it[0] === 'EMAIL_GROUP') return <div key="email">
          <a href="/audiences" className={emailOpen ? 'on' : ''} style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <span>Email</span>
            <svg width="9" height="6" viewBox="0 0 10 6" style={{transform: emailOpen ? 'rotate(180deg)' : 'none', opacity:.45}}>
              <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </a>
          {emailOpen && <div style={{margin:'2px 0 4px'}}>
            {[['audiences','Audiences'],['campaigns','Campaigns']].map(([href, label]) =>
              <a key={href} href={'/' + href} className={active === href ? 'on' : ''}
                style={{paddingLeft:28, fontSize:13}}>{label}</a>)}
          </div>}
        </div>;
        const [href, label] = it;
        return <a key={href} href={'/' + href} className={active === href ? 'on' : ''}>
          <span>{label}</span>{counts[href] ? <span className="n">{counts[href]}</span> : null}
        </a>; })}
      </nav>
      <RepPicker />
    </aside>
    <main className="main">{children}</main>
  </div>;
}
