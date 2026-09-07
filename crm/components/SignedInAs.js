'use client';
import { SignOutButton } from '@clerk/nextjs';

// Who you are, and the way out. Replaces the old self-selected name picker once Clerk is
// on: identity is no longer something you choose from a dropdown, so showing a chooser
// would be both confusing and a lie.
export default function SignedInAs({ name, email, role }) {
  return <div style={{position:'absolute', bottom:24, left:16, right:16}}>
    <div style={{fontSize:10.5, color:'#73736c', fontWeight:650, letterSpacing:'.07em',
      textTransform:'uppercase', padding:'0 2px 6px'}}>Signed in</div>
    <div style={{border:'1px solid #e3e3dd', background:'#fff', padding:'9px 11px'}}>
      <div style={{fontSize:13, fontWeight:650, overflow:'hidden', textOverflow:'ellipsis',
        whiteSpace:'nowrap'}}>{name}</div>
      <div style={{fontSize:11, color:'#73736c', overflow:'hidden', textOverflow:'ellipsis',
        whiteSpace:'nowrap'}}>{role === 'owner' ? 'Owner' : 'Salesperson'}</div>
      <SignOutButton redirectUrl="/sign-in">
        <button style={{marginTop:8, width:'100%', height:28, background:'#efefea',
          border:0, borderRadius:2, fontFamily:'inherit', fontSize:12, fontWeight:600,
          color:'#1a1a18', cursor:'pointer'}}>Sign out</button>
      </SignOutButton>
    </div>
  </div>;
}
