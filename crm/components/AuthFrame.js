// The frame both auth pages sit in. Deliberately quiet: a wordmark, one line of orientation,
// the form, and a footer that says who this is for. The gallery's register — warm paper,
// hairline rules, tracked caps — so signing in feels like the start of the engine rather
// than a detour through someone else's product.
export default function AuthFrame({ eyebrow, children, note }) {
  return <div style={{minHeight:'100vh', background:'#f7f7f4', display:'flex',
    alignItems:'center', justifyContent:'center', padding:'40px 24px',
    fontFamily:"'Helvetica Neue', Helvetica, Arial, sans-serif", color:'#1a1a18'}}>
    <div style={{width:'100%', maxWidth:400}}>

      <div style={{textAlign:'center', marginBottom:28}}>
        <div style={{fontSize:14, fontWeight:600, letterSpacing:'.24em',
          textTransform:'uppercase'}}>Chase&nbsp;Contemporary</div>
        <div style={{display:'flex', alignItems:'center', gap:10, margin:'14px auto 0',
          maxWidth:210}}>
          <span style={{flex:1, height:1, background:'#e3e3dd'}}/>
          <span style={{fontSize:9.5, fontWeight:600, letterSpacing:'.2em',
            textTransform:'uppercase', color:'#73736c', whiteSpace:'nowrap'}}>{eyebrow}</span>
          <span style={{flex:1, height:1, background:'#e3e3dd'}}/>
        </div>
      </div>

      {children}

      {note && <p style={{fontSize:12.5, color:'#73736c', lineHeight:1.65, textAlign:'center',
        margin:'20px auto 0', maxWidth:330}}>{note}</p>}

      <div style={{textAlign:'center', marginTop:34, paddingTop:18,
        borderTop:'1px solid #e3e3dd'}}>
        <div style={{fontSize:10, fontWeight:600, letterSpacing:'.18em',
          textTransform:'uppercase', color:'#73736c'}}>The&nbsp;Chase&nbsp;Engine</div>
        <div style={{fontSize:11.5, color:'#a3a29a', marginTop:6}}>
          For gallery staff</div>
      </div>
    </div>
  </div>;
}
