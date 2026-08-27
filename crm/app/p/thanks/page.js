import localFont from 'next/font/local';
const nimbus = localFont({
  src: [
    { path: '../../../assets/fonts/nimbus-sans-novus-regular.ttf', weight: '400' },
    { path: '../../../assets/fonts/nimbus-sans-novus-semibold.ttf', weight: '600' },
  ],
});
export default function Thanks() {
  return <div className={nimbus.className} style={{ minHeight: '100vh', background: '#fff', color: '#000',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
    <div style={{ textAlign: 'center', maxWidth: 480 }}>
      <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '.22em', marginBottom: 40 }}>CHASE&nbsp;CONTEMPORARY</div>
      <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase' }}>Payment received</div>
      <p style={{ fontSize: 14, lineHeight: 1.75, marginTop: 16 }}>Thank you. Your acquisition is confirmed
        and the gallery will be in touch shortly to arrange delivery.</p>
    </div>
  </div>;
}
