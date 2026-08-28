'use client';
import { useRef, useState } from 'react';

// A submit button that can't fire twice, and optionally asks first.
// `message` = confirm before submitting (for anything that can't be undone).
// Without a message it's still a one-shot button — the fix for double-tapped
// payments on gallery wifi.
export default function ConfirmButton({ message, children, className = 'btn mini quiet',
  style, name, value, busyLabel = 'Saving…' }) {
  const [busy, setBusy] = useState(false);
  const fired = useRef(false);
  return <button className={className} name={name} value={value}
    style={busy ? { ...style, opacity: .5, pointerEvents: 'none' } : style}
    onClick={(e) => {
      if (fired.current) { e.preventDefault(); return; }        // second tap does nothing
      if (message && !window.confirm(message)) { e.preventDefault(); return; }
      fired.current = true;
      setTimeout(() => setBusy(true), 0);                        // after the submit is queued
    }}>{busy ? busyLabel : children}</button>;
}
