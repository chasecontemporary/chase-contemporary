'use client';

// What staff see when a page throws. Never a raw white screen: say it plainly,
// give them a way back, and keep the digest so we can find it in the logs.
export default function Error({ error, reset }) {
  return <div style={{minHeight:'100vh', background:'#f7f7f4', display:'flex',
    alignItems:'center', justifyContent:'center', padding:24,
    fontFamily:"'Helvetica Neue', Helvetica, Arial, sans-serif", color:'#1a1a18'}}>
    <div style={{background:'#fff', border:'1px solid #e3e3dd', boxShadow:'0 1px 2px rgba(20,20,10,.05)',
      padding:'34px 32px', maxWidth:440, width:'100%'}}>
      <div style={{fontSize:12.5, fontWeight:600, letterSpacing:'.18em', textTransform:'uppercase'}}>
        Chase&nbsp;Engine</div>
      <div style={{fontSize:19, fontWeight:600, letterSpacing:'.04em', textTransform:'uppercase',
        marginTop:22}}>This page didn&apos;t load</div>
      <p style={{fontSize:14, lineHeight:1.65, color:'#3a3a35', margin:'12px 0 0'}}>
        Something went wrong on our side, not yours. Nothing you did was saved or lost.
        Try again — if it keeps happening, send Devyn the reference below.</p>
      <div style={{display:'flex', gap:8, marginTop:22, flexWrap:'wrap'}}>
        <button onClick={() => reset()} style={{background:'#1a1a18', color:'#fff', border:0,
          borderRadius:2, height:36, padding:'0 16px', fontFamily:'inherit', fontSize:13,
          fontWeight:600, cursor:'pointer'}}>Try again</button>
        <a href="/today" style={{background:'#efefea', color:'#1a1a18', borderRadius:2, height:36,
          padding:'0 16px', fontFamily:'inherit', fontSize:13, fontWeight:600, display:'inline-flex',
          alignItems:'center', textDecoration:'none'}}>Back to Today</a>
      </div>
      {error?.digest && <div style={{fontSize:11.5, color:'#73736c', marginTop:20,
        borderTop:'1px solid #eeeee9', paddingTop:12}}>
        Reference: {error.digest}</div>}
    </div>
  </div>;
}
