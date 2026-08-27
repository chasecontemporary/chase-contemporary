// Collector-facing details page — Chase Contemporary's brand register, not the CRM's.
import { db } from '../../../lib/db';
import localFont from 'next/font/local';
export const dynamic = 'force-dynamic';

const nimbus = localFont({
  src: [
    { path: '../../../assets/fonts/nimbus-sans-novus-regular.ttf', weight: '400' },
    { path: '../../../assets/fonts/nimbus-sans-novus-medium.ttf', weight: '500' },
    { path: '../../../assets/fonts/nimbus-sans-novus-semibold.ttf', weight: '600' },
  ],
});

const label = { fontSize: 10, fontWeight: 600, letterSpacing: '.14em', display: 'block',
  marginBottom: 8, color: '#000' };
const input = { width: '100%', border: 0, borderBottom: '1px solid #000', borderRadius: 0,
  padding: '8px 0', fontSize: 14, fontFamily: 'inherit', background: 'transparent', outline: 'none' };

export default async function Details({ params }) {
  const { token } = await params;
  const { data: c } = await db.from('collectors')
    .select('id, first_name, details_completed_at').eq('details_token', token).single();
  const wrap = (children) => (
    <div className={nimbus.className} style={{ minHeight: '100vh', background: '#fff', color: '#000' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '64px 24px 80px' }}>
        <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '.22em', textAlign: 'center',
          marginBottom: 56 }}>CHASE&nbsp;CONTEMPORARY</div>
        {children}
      </div>
    </div>
  );
  if (!c) return wrap(<p style={{ fontSize: 14, lineHeight: 1.7, textAlign: 'center' }}>
    This link is no longer active. Please contact the gallery at info@chasecontemporary.com.</p>);
  if (c.details_completed_at) return wrap(<div style={{ textAlign: 'center' }}>
    <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase' }}>Thank you</div>
    <p style={{ fontSize: 14, lineHeight: 1.7, marginTop: 16 }}>Your details are on file. The gallery will be in touch shortly.</p>
  </div>);

  return wrap(<>
    <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase' }}>
      Acquisition details</div>
    <p style={{ fontSize: 13.5, lineHeight: 1.75, color: '#000', marginTop: 14, marginBottom: 40 }}>
      {c.first_name ? c.first_name + ', thank' : 'Thank'} you. To prepare your invoice and arrange
      delivery, please confirm the details below. This takes under a minute.</p>
    <form method="POST" action="/api/details">
      <input type="hidden" name="token" value={token} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '26px 20px' }}>
        <div><span style={label}>FIRST NAME</span><input style={input} name="first_name" defaultValue={c.first_name || ''} required /></div>
        <div><span style={label}>LAST NAME</span><input style={input} name="last_name" /></div>
        <div><span style={label}>EMAIL</span><input style={input} name="email" type="email" required /></div>
        <div><span style={label}>PHONE</span><input style={input} name="phone" required /></div>
      </div>
      <div style={{ ...label, marginTop: 44 }}>BILLING ADDRESS</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '26px 20px' }}>
        <div style={{ gridColumn: '1 / -1' }}><input style={input} name="address_line1" placeholder="Street address" required /></div>
        <div style={{ gridColumn: '1 / -1' }}><input style={input} name="address_line2" placeholder="Apt, suite, floor (optional)" /></div>
        <div><input style={input} name="city" placeholder="City" required /></div>
        <div><input style={input} name="state" placeholder="State / region" required /></div>
        <div><input style={input} name="zip" placeholder="Postal code" required /></div>
        <div><input style={input} name="country" placeholder="Country" defaultValue="United States" /></div>
      </div>
      <div style={{ ...label, marginTop: 44 }}>DELIVERY ADDRESS</div>
      <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13, marginBottom: 18 }}>
        <input type="checkbox" name="ship_same" value="1" defaultChecked /> Same as billing
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '26px 20px' }}>
        <div style={{ gridColumn: '1 / -1' }}><input style={input} name="shipping_line1" placeholder="Street address" /></div>
        <div style={{ gridColumn: '1 / -1' }}><input style={input} name="shipping_line2" placeholder="Apt, suite, floor (optional)" /></div>
        <div><input style={input} name="shipping_city" placeholder="City" /></div>
        <div><input style={input} name="shipping_state" placeholder="State / region" /></div>
        <div><input style={input} name="shipping_zip" placeholder="Postal code" /></div>
        <div><input style={input} name="shipping_country" placeholder="Country" /></div>
      </div>
      <button style={{ marginTop: 48, width: '100%', background: '#000', color: '#fff', border: 0,
        padding: '15px 0', fontSize: 11, fontWeight: 600, letterSpacing: '.14em', fontFamily: 'inherit',
        cursor: 'pointer' }}>CONFIRM DETAILS</button>
    </form>
    <p style={{ fontSize: 10.5, lineHeight: 1.7, color: '#6e6e73', marginTop: 28, textAlign: 'center' }}>
      Your information is used only to prepare your invoice and delivery. It is never shared.</p>
  </>);
}
