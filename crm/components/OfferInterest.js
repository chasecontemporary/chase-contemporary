'use client';
import { useState } from 'react';

// One-tap interest on the private-selection page. We already know who they are —
// no form, no friction. Lands straight in the gallery's pipeline.
export default function OfferInterest({ token, artworkId, already }) {
  const [state, setState] = useState(already ? 'done' : 'idle');
  if (state === 'done') return <div style={{ marginTop: 14, fontSize: 11, fontWeight: 600,
    letterSpacing: '.12em', padding: '15px 0', textAlign: 'center', border: '1px solid #000' }}>
    NOTED — THE GALLERY WILL BE IN TOUCH</div>;
  return <button
    onClick={async () => {
      setState('busy');
      try {
        const r = await fetch('/api/offer', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, artwork_id: artworkId }),
        });
        setState(r.ok ? 'done' : 'idle');
      } catch { setState('idle'); }
    }}
    disabled={state === 'busy'}
    style={{ marginTop: 14, width: '100%', background: '#000', color: '#fff', border: 0,
      padding: '15px 0', fontSize: 11, fontWeight: 600, letterSpacing: '.14em',
      fontFamily: 'inherit', cursor: 'pointer', opacity: state === 'busy' ? .6 : 1 }}>
    I&apos;M&nbsp;INTERESTED</button>;
}
