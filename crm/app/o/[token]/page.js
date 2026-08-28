// Collector-facing private selection — Chase Contemporary's brand register, not the CRM's.
import { db } from '../../../lib/db';
import { cookies } from 'next/headers';
import localFont from 'next/font/local';
import OfferInterest from '../../../components/OfferInterest';
export const dynamic = 'force-dynamic';
// collector-facing and tokenised: never index, never follow
export const metadata = { robots: { index: false, follow: false } };

const nimbus = localFont({
  src: [
    { path: '../../../assets/fonts/nimbus-sans-novus-regular.ttf', weight: '400' },
    { path: '../../../assets/fonts/nimbus-sans-novus-medium.ttf', weight: '500' },
    { path: '../../../assets/fonts/nimbus-sans-novus-semibold.ttf', weight: '600' },
  ],
});

const usd = (c) => '$' + Math.round((c || 0) / 100).toLocaleString();
const dims = (a) => (a.dims_h_in > 0 && a.dims_w_in > 0)
  ? `${Number(a.dims_h_in)} × ${Number(a.dims_w_in)} in` : null;

export default async function Offer({ params }) {
  const { token } = await params;
  const { data: o } = await db.from('offers')
    .select('*, collectors(first_name, last_name)')
    .eq('token', token).single();

  const wrap = (children) => (
    <div className={nimbus.className} style={{ minHeight: '100vh', background: '#fff', color: '#000' }}>
      <div style={{ maxWidth: 620, margin: '0 auto', padding: '64px 24px 90px' }}>
        <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '.22em', textAlign: 'center',
          marginBottom: 56 }}>CHASE&nbsp;CONTEMPORARY</div>
        {children}
      </div>
    </div>
  );
  const gone = <p style={{ fontSize: 14, lineHeight: 1.7, textAlign: 'center' }}>
    This selection is no longer available. Please contact the gallery at info@chasecontemporary.com.</p>;
  if (!o || o.status !== 'active') return wrap(gone);
  if (o.expires_at && new Date(o.expires_at) < new Date()) return wrap(gone);

  // view tracking — the gallery's own opens (CRM cookie present) don't count
  const jar = await cookies();
  const isStaff = jar.get('cc_crm')?.value === process.env.CRM_ACCESS_CODE;
  if (!isStaff) {
    const now = new Date().toISOString();
    await db.from('offers').update({
      view_count: (o.view_count || 0) + 1,
      first_viewed_at: o.first_viewed_at || now,
      last_viewed_at: now,
    }).eq('id', o.id);
    if (!o.first_viewed_at) await db.from('activities').insert({
      entity_type: 'collector', entity_id: o.collector_id,
      kind: 'offer_viewed', body: o.title || 'Private selection',
    });
  }

  const ids = (o.items || []).map(x => x.id);
  const [{ data: works }, { data: responses }] = await Promise.all([
    ids.length ? db.from('artworks').select('id, title, artist, medium, dims_h_in, dims_w_in, edition, price_cents, image_url')
      .in('id', ids) : Promise.resolve({ data: [] }),
    db.from('offer_responses').select('artwork_id').eq('offer_id', o.id),
  ]);
  const responded = new Set((responses || []).map(r => r.artwork_id));
  const ordered = (o.items || [])
    .map(it => ({ ...((works || []).find(w => w.id === it.id) || {}), _price: it.price_cents }))
    .filter(w => w.id);
  const first = o.collectors?.first_name;

  return wrap(<>
    <div style={{ textAlign: 'center', marginBottom: 52 }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '.16em', border: '1px solid #000',
        display: 'inline-block', padding: '7px 16px' }}>PRIVATE&nbsp;SELECTION</div>
      <h1 style={{ fontSize: 21, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase',
        margin: '26px 0 0' }}>{o.title || (first ? `A selection for ${first}` : 'A selection')}</h1>
      {o.note && <p style={{ fontSize: 14, lineHeight: 1.75, margin: '20px auto 0', maxWidth: 480,
        textAlign: 'left' }}>{o.note}</p>}
    </div>

    {ordered.map((a) => {
      const price = a._price || a.price_cents;
      return <div key={a.id} style={{ marginBottom: 64 }}>
        {a.image_url && <img src={a.image_url + (a.image_url.includes('?') ? '&' : '?') + 'width=1200'}
          alt={a.title} style={{ width: '100%', display: 'block' }} />}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, marginTop: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em',
              textTransform: 'uppercase' }}>{a.artist}</div>
            <div style={{ fontSize: 13, fontStyle: 'italic', marginTop: 3 }}>{a.title}</div>
            <div style={{ fontSize: 11.5, letterSpacing: '.02em', color: '#3a3a35', marginTop: 3 }}>
              {[a.medium, dims(a), a.edition].filter(Boolean).join(' · ')}</div>
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.04em', whiteSpace: 'nowrap',
            paddingTop: 2 }}>{price > 0 ? usd(price) : 'PRICE ON REQUEST'}</div>
        </div>
        <OfferInterest token={token} artworkId={a.id} already={responded.has(a.id)} />
      </div>;
    })}

    <div style={{ textAlign: 'center', borderTop: '1px solid #e3e3dd', paddingTop: 36 }}>
      <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.2em' }}>CHASE&nbsp;CONTEMPORARY</div>
      <div style={{ fontSize: 11, letterSpacing: '.04em', color: '#3a3a35', marginTop: 10, lineHeight: 1.8 }}>
        This selection was prepared personally for you{first ? `, ${first}` : ''}.<br/>
        info@chasecontemporary.com</div>
    </div>
  </>);
}
