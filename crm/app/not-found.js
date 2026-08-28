export default function NotFound() {
  return <div style={{minHeight:'100vh', background:'#f7f7f4', display:'flex',
    alignItems:'center', justifyContent:'center', padding:24,
    fontFamily:"'Helvetica Neue', Helvetica, Arial, sans-serif", color:'#1a1a18'}}>
    <div style={{background:'#fff', border:'1px solid #e3e3dd', boxShadow:'0 1px 2px rgba(20,20,10,.05)',
      padding:'34px 32px', maxWidth:440, width:'100%'}}>
      <div style={{fontSize:12.5, fontWeight:600, letterSpacing:'.18em', textTransform:'uppercase'}}>
        Chase&nbsp;Engine</div>
      <div style={{fontSize:19, fontWeight:600, letterSpacing:'.04em', textTransform:'uppercase',
        marginTop:22}}>Nothing here</div>
      <p style={{fontSize:14, lineHeight:1.65, color:'#3a3a35', margin:'12px 0 0'}}>
        This page doesn&apos;t exist, or whatever was here has been removed.
        The search box on Today will find any collector or work.</p>
      <a href="/today" style={{background:'#1a1a18', color:'#fff', borderRadius:2, height:36,
        padding:'0 16px', fontFamily:'inherit', fontSize:13, fontWeight:600, display:'inline-flex',
        alignItems:'center', textDecoration:'none', marginTop:22}}>Back to Today</a>
    </div>
  </div>;
}
