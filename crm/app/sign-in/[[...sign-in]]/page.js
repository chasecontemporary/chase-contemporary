import { SignIn } from '@clerk/nextjs';

// Clerk's hosted sign-in, dressed in the engine's register. Email link only — the team
// signs in with their gallery mailbox and never manages a password.
export default function Page() {
  return <div style={{minHeight:'100vh', background:'#f7f7f4', display:'flex',
    flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24,
    fontFamily:"'Helvetica Neue', Helvetica, Arial, sans-serif"}}>
    <div style={{fontSize:12.5, fontWeight:600, letterSpacing:'.2em', textTransform:'uppercase',
      color:'#1a1a18', marginBottom:6}}>Chase&nbsp;Engine</div>
    <div style={{fontSize:12.5, color:'#73736c', marginBottom:26}}>Chase Contemporary</div>
    <SignIn appearance={{
      variables: { colorPrimary: '#1a1a18', colorText: '#1a1a18', colorBackground: '#ffffff',
                   borderRadius: '2px', fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" },
    }}/>
  </div>;
}
