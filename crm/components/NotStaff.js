// Someone signed in with an account the gallery doesn't recognise. Say so plainly and
// give them a way out — never show them anything from the book.
export default function NotStaff({ email }) {
  return <div style={{minHeight:'100vh', background:'#f7f7f4', display:'flex',
    alignItems:'center', justifyContent:'center', padding:24,
    fontFamily:"'Helvetica Neue', Helvetica, Arial, sans-serif", color:'#1a1a18'}}>
    <div style={{background:'#fff', border:'1px solid #e3e3dd', padding:'34px 32px', maxWidth:460}}>
      <div style={{fontSize:12.5, fontWeight:600, letterSpacing:'.18em', textTransform:'uppercase'}}>
        Chase&nbsp;Engine</div>
      <div style={{fontSize:19, fontWeight:600, letterSpacing:'.04em', textTransform:'uppercase',
        marginTop:22}}>This account isn&apos;t on the team</div>
      <p style={{fontSize:14, lineHeight:1.65, color:'#3a3a35', margin:'12px 0 0'}}>
        {email ? <>You&apos;re signed in as <b>{email}</b>, which isn&apos;t recognised as a
        Chase Contemporary account.</> : <>This account isn&apos;t recognised.</>} The engine is
        for gallery staff only.
      </p>
      <p style={{fontSize:13.5, lineHeight:1.65, color:'#73736c', margin:'12px 0 0'}}>
        If you should have access, ask Devyn to add you.</p>
      <a href="/sign-in" style={{background:'#1a1a18', color:'#fff', height:36, padding:'0 16px',
        fontSize:13, fontWeight:600, display:'inline-flex', alignItems:'center',
        textDecoration:'none', marginTop:22}}>Sign in as someone else</a>
    </div>
  </div>;
}
