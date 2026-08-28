'use client';
import { useSearchParams } from 'next/navigation';

// When an action fails, the user comes back with ?err=… — say so plainly at the top
// of the page rather than letting them believe it saved.
export default function ErrBanner() {
  const sp = useSearchParams();
  const err = sp.get('err') || sp.get('pusherr');
  if (!err) return null;
  const friendly = sp.get('pusherr')
    ? `This work isn't ready to list yet: ${err}`
    : err === 'shopify-not-connected' ? 'Shopify isn’t connected yet, so pay links and site pushes are switched off.'
    : err === 'klaviyo-not-connected' ? 'Klaviyo isn’t connected yet, so sending is switched off.'
    : `That didn’t save: ${err}`;
  return <div style={{background:'#fbeceb', border:'1px solid #e8c4c0', color:'#8f1f18',
    borderRadius:2, padding:'11px 14px', marginBottom:18, fontSize:13.5, fontWeight:600,
    display:'flex', gap:10, alignItems:'baseline'}}>
    <span style={{fontSize:10.5, fontWeight:700, letterSpacing:'.08em', flex:'0 0 auto'}}>NOT SAVED</span>
    <span style={{fontWeight:500, flex:1}}>{friendly}</span>
  </div>;
}
