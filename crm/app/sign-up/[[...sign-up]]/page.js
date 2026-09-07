import { SignUp } from '@clerk/nextjs';

// Creating an account does not grant access: lib/identity.js only lets through an email
// that matches an active row in team_members. Anyone else lands on the "not on the team"
// screen, so this page being reachable is not a way in.
export default function Page() {
  return <div style={{minHeight:'100vh', background:'#f7f7f4', display:'flex',
    flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24,
    fontFamily:"'Helvetica Neue', Helvetica, Arial, sans-serif"}}>
    <div style={{fontSize:12.5, fontWeight:600, letterSpacing:'.2em', textTransform:'uppercase',
      color:'#1a1a18', marginBottom:6}}>Chase&nbsp;Engine</div>
    <div style={{fontSize:12.5, color:'#73736c', marginBottom:26}}>Chase Contemporary</div>
    <SignUp appearance={{
      variables: { colorPrimary: '#1a1a18', colorText: '#1a1a18', colorBackground: '#ffffff',
                   borderRadius: '2px', fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" },
    }}/>
    <div style={{fontSize:12.5, color:'#73736c', marginTop:22, maxWidth:360, textAlign:'center',
      lineHeight:1.6}}>
      Use your Chase Contemporary address. Accounts that aren&apos;t on the gallery team
      won&apos;t be able to open the engine.
    </div>
  </div>;
}
