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
          <a href="/audiences" style={{display:'flex', justifyContent:'space-between', alignItems:'center',
            fontWeight: emailOpen ? 650 : undefined}}>
            <span>Email</span>
            <svg width="9" height="6" viewBox="0 0 10 6" style={{transform: emailOpen ? 'rotate(180deg)' : 'none', opacity:.4}}>
              <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </a>
          {emailOpen && <div style={{margin:'0 0 2px', position:'relative'}}>
            <span style={{position:'absolute', left:14, top:6, bottom:6, width:1, background:'#e8e8ed'}}/>
            {[['audiences','Audiences'],['campaigns','Campaigns']].map(([href, label]) =>
              <a key={href} href={'/' + href} className={active === href ? 'on' : ''}
                style={{paddingLeft:30, fontSize:13}}>{label}</a>)}
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
