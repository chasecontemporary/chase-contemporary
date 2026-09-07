import AuthFrame from '../../components/AuthFrame';

export const metadata = { title: 'Sign in · Chase Engine' };

// The shared access code. Kept working only so nobody is locked out while the team moves
// to per-person sign-in; it gets deleted once all four have signed in with Clerk.
export default async function Login({ searchParams }) {
  const bad = (await searchParams)?.e;
  const clerkOn = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const label = { fontSize:11, fontWeight:650, letterSpacing:'.07em',
    textTransform:'uppercase', color:'#73736c', display:'block', marginBottom:6 };
  return <AuthFrame eyebrow="Sign in">
    <form method="POST" action="/api/login"
      style={{background:'#fff', border:'1px solid #e3e3dd', padding:'30px 30px 26px'}}>
      <div style={{fontSize:17, fontWeight:600, letterSpacing:'.05em',
        textTransform:'uppercase'}}>Access code</div>
      <p style={{fontSize:13, color:'#73736c', lineHeight:1.6, margin:'6px 0 22px'}}>
        The code the gallery shares. {clerkOn && <>If you have your own account,{' '}
        <a href="/sign-in" style={{color:'#2257c5', fontWeight:600}}>sign in with your email</a> instead.</>}
      </p>

      {bad && <div style={{background:'#fbeceb', border:'1px solid #e8c4c0', color:'#8f1f18',
        padding:'10px 12px', fontSize:13, fontWeight:600, marginBottom:16}}>
        {bad === 'slow'
          ? 'Too many attempts. Wait a few minutes and try again.'
          : 'That code wasn\u2019t right. Try again.'}</div>}

      <label style={label} htmlFor="code">Access code</label>
      <input id="code" name="code" type="password" autoFocus autoComplete="off"
        placeholder="••••••••"
        style={{width:'100%', height:38, border:'1px solid #e3e3dd', borderRadius:2,
          fontFamily:'inherit', fontSize:14, padding:'0 12px', outline:'none',
          background:'#fff', color:'#1a1a18'}}/>

      <button className="btn" type="submit"
        style={{width:'100%', height:38, marginTop:18}}>Continue</button>
    </form>
  </AuthFrame>;
}
