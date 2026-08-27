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
const btn = { width: '100%', background: '#000', color: '#fff', border: 0, padding: '15px 0',
  fontSize: 11, fontWeight: 600, letterSpacing: '.14em', fontFamily: 'inherit', cursor: 'pointer' };

const maskStreet = (s) => s ? s.replace(/[A-Za-z0-9]/g, (ch, i) => i === 0 ? ch : '\u2022').slice(0, 14) + ' (street on file)' : null;
const maskPhone = (s) => s ? '(\u2022\u2022\u2022) \u2022\u2022\u2022 ' + s.replace(/\D/g, '').slice(-4) : null;
const maskEmail = (s) => s ? s[0] + '\u2022\u2022\u2022@' + (s.split('@')[1] || '') : null;

export default async function Details({ params, searchParams }) {
  const { token } = await params;
  const sp = (await searchParams) || {};
  const { data: c } = await db.from('collectors')
    .select('id, first_name, last_name, email, phone, address_line1, address_line2, city, state, zip, country, shipping_line1, shipping_city, shipping_state, shipping_zip, details_completed_at')
    .eq('details_token', token).single();
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

  const known = !!(c.address_line1 && c.city && (c.email || c.phone));
  // ---------- confirm mode: we already hold their details — one tap ----------
  if (known && !sp.edit) {
    const row = (k, v) => v ? <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16,
      padding: '13px 0', borderBottom: '1px solid #e8e8ed', fontSize: 13.5 }}>
      <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.12em', paddingTop: 3 }}>{k}</span>
      <span style={{ textAlign: 'right', lineHeight: 1.6 }}>{v}</span></div> : null;
    const billing = <>{maskStreet(c.address_line1)}<br/>{[c.city, c.state, c.zip].filter(Boolean).join(', ')}{c.country ? <><br/>{c.country}</> : null}</>;
    const delivery = c.shipping_line1
      ? <>{maskStreet(c.shipping_line1)}<br/>{[c.shipping_city, c.shipping_state, c.shipping_zip].filter(Boolean).join(', ')}</>
      : 'Same as billing';
    return wrap(<>
      <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase' }}>
        Confirm your details</div>
      <p style={{ fontSize: 13.5, lineHeight: 1.75, marginTop: 14, marginBottom: 34 }}>
        {c.first_name ? c.first_name + ', we' : 'We'} have your details on file. To prepare your
        invoice and arrange delivery, please confirm they are current.</p>
      {row('CONTACT', <>{maskEmail(c.email?.endsWith('import.chasecontemporary.com') ? null : c.email)}{c.phone ? <><br/>{maskPhone(c.phone)}</> : null}</>)}
      {row('BILLING', billing)}
      {row('DELIVERY', delivery)}
      <form method="POST" action="/api/details" style={{ marginTop: 40 }}>
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="mode" value="confirm" />
        <button style={btn}>CONFIRM, ALL CURRENT</button>
      </form>
      <div style={{ textAlign: 'center', marginTop: 22 }}>
        <a href={'/d/' + token + '?edit=1'} style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.1em',
          color: '#000', textDecoration: 'none', borderBottom: '1px solid #000', paddingBottom: 2 }}>
          SOMETHING CHANGED? UPDATE DETAILS</a>
      </div>
      <p style={{ fontSize: 10.5, lineHeight: 1.7, color: '#6e6e73', marginTop: 34, textAlign: 'center' }}>
        Details are shown in part for your privacy. Your information is used only to prepare your
        invoice and delivery. It is never shared.</p>
    </>);
  }

  // ---------- full form (new collector, or updating) ----------
  return wrap(<>
    <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase' }}>
      Acquisition details</div>
    <p style={{ fontSize: 13.5, lineHeight: 1.75, color: '#000', marginTop: 14, marginBottom: 40 }}>
      {c.first_name ? c.first_name + ', thank' : 'Thank'} you. To prepare your invoice and arrange
      delivery, please {known ? 'update' : 'confirm'} the details below. This takes under a minute.</p>
    <form method="POST" action="/api/details">
      <input type="hidden" name="token" value={token} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '26px 20px' }}>
        <div><span style={label}>FIRST NAME</span><input style={input} name="first_name" autoComplete="given-name" defaultValue={c.first_name || ''} required /></div>
        <div><span style={label}>LAST NAME</span><input style={input} name="last_name" autoComplete="family-name" defaultValue={c.last_name || ''} /></div>
        <div><span style={label}>EMAIL</span><input style={input} name="email" type="email" autoComplete="email"
          placeholder={known && c.email && !c.email.endsWith('import.chasecontemporary.com') ? 'currently ' + maskEmail(c.email) : ''} required={!known} /></div>
        <div><span style={label}>PHONE</span><input style={input} name="phone" type="tel" autoComplete="tel"
          placeholder={known && c.phone ? 'currently ' + maskPhone(c.phone) : ''} required={!known} /></div>
      </div>
      <div style={{ ...label, marginTop: 44 }}>BILLING ADDRESS</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '26px 20px' }}>
        <div style={{ gridColumn: '1 / -1' }}><input style={input} name="address_line1" autoComplete="section-billing address-line1"
          placeholder={known && c.address_line1 ? 'currently ' + maskStreet(c.address_line1) : 'Street address'} required={!known} /></div>
        <div style={{ gridColumn: '1 / -1' }}><input style={input} name="address_line2" autoComplete="section-billing address-line2" placeholder="Apt, suite, floor (optional)" /></div>
        <div><input style={input} name="city" autoComplete="section-billing address-level2" placeholder="City" defaultValue={known ? (c.city || '') : ''} required={!known} /></div>
        <div><input style={input} name="state" autoComplete="section-billing address-level1" placeholder="State / region" defaultValue={known ? (c.state || '') : ''} required={!known} /></div>
        <div><input style={input} name="zip" autoComplete="section-billing postal-code" placeholder="Postal code" defaultValue={known ? (c.zip || '') : ''} required={!known} /></div>
        <div><input style={input} name="country" autoComplete="section-billing country-name" placeholder="Country" defaultValue={c.country || 'United States'} /></div>
      </div>
      <div style={{ ...label, marginTop: 44 }}>DELIVERY ADDRESS</div>
      <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13, marginBottom: 18 }}>
        <input type="checkbox" name="ship_same" value="1" defaultChecked /> Same as billing
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '26px 20px' }}>
        <div style={{ gridColumn: '1 / -1' }}><input style={input} name="shipping_line1" autoComplete="section-shipping shipping address-line1" placeholder="Street address" /></div>
        <div style={{ gridColumn: '1 / -1' }}><input style={input} name="shipping_line2" autoComplete="section-shipping shipping address-line2" placeholder="Apt, suite, floor (optional)" /></div>
        <div><input style={input} name="shipping_city" autoComplete="section-shipping shipping address-level2" placeholder="City" /></div>
        <div><input style={input} name="shipping_state" autoComplete="section-shipping shipping address-level1" placeholder="State / region" /></div>
        <div><input style={input} name="shipping_zip" autoComplete="section-shipping shipping postal-code" placeholder="Postal code" /></div>
        <div><input style={input} name="shipping_country" autoComplete="section-shipping shipping country-name" placeholder="Country" /></div>
      </div>
      <button style={{ ...btn, marginTop: 48 }}>CONFIRM DETAILS</button>
    </form>
    <p style={{ fontSize: 10.5, lineHeight: 1.7, color: '#6e6e73', marginTop: 28, textAlign: 'center' }}>
      Your information is used only to prepare your invoice and delivery. It is never shared.</p>
  </>);
}
