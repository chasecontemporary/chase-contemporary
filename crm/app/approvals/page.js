import Shell from '../../components/Shell';
import ConfirmButton from '../../components/ConfirmButton';
import { db } from '../../lib/db';
import { publishReadiness, publishCounts } from '../../lib/publishing';
import { shopifyReady } from '../../lib/shopify';
export const dynamic = 'force-dynamic';

// What goes on the website, and Bernie saying yes to it.
//
// This is the one screen the owner actually works in. It is built around the only question he
// is being asked: should the public see this piece. So the work is large, the wall label is
// underneath it the way it would be on a wall, and there are two answers.
//
// It is also the only honest reason to have an owner page at all. The dashboard idea was
// parked in August because it was a placeholder with nothing to do. This has 1,215 things to do.

const usd = (c) => '$' + Math.round((c || 0) / 100).toLocaleString();
const PAGE = 24;

export default async function Approvals({ searchParams }) {
  const sp = (await searchParams) || {};
  const artist = sp.artist || '';
  const view = sp.view || 'staged';
  const page = Math.max(1, Number(sp.page) || 1);
  const connected = shopifyReady();

  const counts = await publishCounts();
  let q = db.from('artworks')
    .select('id, title, artist, medium, dims_h_in, dims_w_in, price_cents, image_url, is_edition, site_status, handle, review_note, publish_error, edition')
    .eq('available', true).order('artist').order('title')
    .range((page - 1) * PAGE, page * PAGE - 1);
  q = view === 'none' ? q.is('site_status', null) : q.eq('site_status', view);
  if (artist) q = q.eq('artist', artist);
  const { data: works } = await q;

  // the artists with something waiting, so a whole body of work can go up in one press
  const { data: waiting } = await db.from('artworks').select('artist')
    .eq('available', true).eq('site_status', 'staged').limit(2000);
  const byArtist = {};
  (waiting || []).forEach(w => { if (w.artist) byArtist[w.artist] = (byArtist[w.artist] || 0) + 1; });
  const artists = Object.entries(byArtist).sort((a, b) => b[1] - a[1]);

  const sec = { fontSize: 11, fontWeight: 650, letterSpacing: '.07em', textTransform: 'uppercase',
    color: '#73736c', margin: '30px 0 10px' };
  const card = { background: '#fff', border: '1px solid #e3e3dd', borderRadius: 3 };
  const VIEWS = [['staged', 'Waiting on you', counts.staged], ['none', 'Not chosen yet', counts.none],
    ['queued', 'Queued', counts.queued], ['approved', 'Going live', counts.approved],
    ['live', 'On the site', counts.live], ['held', 'Sent back', counts.held]];

  return <Shell active="approvals" counts={{ approvals: counts.staged }}>
    <div className="h1">What goes on the website</div>
    <div className="sub">Nothing here is public until you approve it. Approving puts it on chasecontemporary.com.</div>

    {!connected && <div style={{ background: '#fdf3e3', border: '1px solid #e8d5ae', color: '#7a5310',
      padding: '13px 16px', marginTop: 16, fontSize: 13.5, lineHeight: 1.6 }}>
      <b style={{ letterSpacing: '.06em', fontSize: 10.5 }}>NOT CONNECTED YET</b><br/>
      The website connection is not switched on, so works can be chosen and approved here but
      nothing will move until it is. Everything you decide is remembered.
    </div>}

    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 18 }}>
      {VIEWS.map(([k, label, n]) => <a key={k} className="pill"
        href={`/approvals?view=${k}${artist ? '&artist=' + encodeURIComponent(artist) : ''}`}
        style={{ background: view === k ? '#111' : '#fff', color: view === k ? '#fff' : '#111',
          border: '1px solid ' + (view === k ? '#111' : '#e3e3dd'), textDecoration: 'none' }}>
        {label}{typeof n === 'number' ? ` · ${n}` : ''}</a>)}
    </div>

    {view === 'none' && counts.none > 0 && <div style={{ ...card, marginTop: 16, padding: '14px 16px' }}>
      <div style={{ fontSize: 13.5, marginBottom: 10 }}>
        <b>{counts.none} works are not on the website and have never been considered.</b> Choosing
        them stages a private draft for each one. Nothing becomes public until you approve it here.
        A work that looks like a twin of one already on the site, or whose photo is too small
        for a gallery wall, is held under Sent back with the reason, for you to decide.</div>
      <form method="POST" action="/api/act" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="hidden" name="action" value="publish_queue"/>
        <input type="hidden" name="back" value="/approvals?view=queued"/>
        <input name="artist" defaultValue={artist} placeholder="One artist, or leave empty for all"
          style={{ padding: '8px 10px', border: '1px solid #e3e3dd', borderRadius: 2, fontSize: 13, minWidth: 260, fontFamily: 'inherit' }}/>
        <ConfirmButton message="Stage these as private drafts? Nothing becomes public until you approve it."
          style={{ background: '#111', color: '#fff', border: '1px solid #111' }}>Choose them for the site</ConfirmButton>
      </form>
    </div>}

    {(counts.queued > 0 || counts.approved > 0) && <div style={{ ...card, marginTop: 16, padding: '14px 16px',
      display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 13.5, flex: 1, minWidth: 260 }}>
        {counts.queued > 0 && <>{counts.queued} waiting to be staged. </>}
        {counts.approved > 0 && <>{counts.approved} approved and waiting to go live. </>}
        They move in batches on their own, or push the next batch now.</span>
      <form method="POST" action="/api/cron/publish">
        <ConfirmButton style={{ background: '#fff', color: '#111', border: '1px solid #111' }}>Push the next batch</ConfirmButton>
      </form>
    </div>}

    {artists.length > 0 && view === 'staged' && <>
      <div style={sec}>Approve a whole artist</div>
      <div style={{ ...card, padding: '6px 0' }}>
        {artists.slice(0, 14).map(([name, n], i) => <div key={name}
          style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '9px 16px',
            borderTop: i ? '1px solid #f0f0eb' : 'none', fontSize: 13.5 }}>
          <a href={`/approvals?view=staged&artist=${encodeURIComponent(name)}`}
            style={{ flex: 1, fontWeight: 600, color: 'inherit' }}>{name}</a>
          <span style={{ color: '#73736c', fontSize: 12 }}>{n} work{n === 1 ? '' : 's'}</span>
          <form method="POST" action="/api/act">
            <input type="hidden" name="action" value="publish_approve"/>
            <input type="hidden" name="artist" value={name}/>
            <input type="hidden" name="back" value="/approvals"/>
            <ConfirmButton message={`Put all ${n} works by ${name} on the website?`}
              style={{ background: '#111', color: '#fff', border: '1px solid #111' }}>Approve all</ConfirmButton>
          </form>
        </div>)}
      </div>
    </>}

    <div style={sec}>{artist ? artist : 'Every work'} · {works?.length || 0} shown</div>
    {(!works || works.length === 0)
      ? <div style={{ ...card, padding: '16px', fontSize: 13.5, color: '#73736c' }}>Nothing here.</div>
      : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 18 }}>
          {works.map(a => {
            const r = publishReadiness(a);
            return <div key={a.id} style={{ ...card, display: 'flex', flexDirection: 'column' }}>
              <div style={{ background: '#f6f6f2', aspectRatio: '4 / 3', display: 'flex',
                alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {a.image_url
                  ? <img src={a.image_url} alt={a.title} loading="lazy"
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}/>
                  : <span style={{ fontSize: 11, color: '#9a551a', letterSpacing: '.06em' }}>NO IMAGE</span>}
              </div>
              <div style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>{a.artist}</div>
                <div style={{ fontStyle: 'italic', fontSize: 14 }}>{a.title}</div>
                <div style={{ fontSize: 12, color: '#73736c' }}>
                  {[a.medium, a.dims_h_in ? `${a.dims_h_in} x ${a.dims_w_in} in` : null, a.edition].filter(Boolean).join(' · ') || 'no details on file'}</div>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>
                  {a.is_edition && a.price_cents > 0 ? usd(a.price_cents) + ' · can be bought online' : 'Price on request'}</div>
                {r.warnings.length > 0 && <div style={{ fontSize: 11.5, color: '#9a551a' }}>{r.warnings.join(' · ')}</div>}
                {r.blocking.length > 0 && <div style={{ fontSize: 11.5, color: '#a3372f', fontWeight: 600 }}>{r.blocking.join(' · ')}</div>}
                {a.review_note && <div style={{ fontSize: 11.5, color: '#73736c' }}>Sent back: {a.review_note}</div>}
                {a.publish_error && <div style={{ fontSize: 11.5, color: '#a3372f' }}>The website said: {a.publish_error}</div>}
              </div>
              <div style={{ display: 'flex', gap: 6, padding: '0 14px 14px', flexWrap: 'wrap' }}>
                {a.site_status === 'staged' && <>
                  <form method="POST" action="/api/act">
                    <input type="hidden" name="action" value="publish_approve"/>
                    <input type="hidden" name="id" value={a.id}/>
                    <input type="hidden" name="back" value={`/approvals?view=staged${artist ? '&artist=' + encodeURIComponent(artist) : ''}`}/>
                    <ConfirmButton style={{ background: '#111', color: '#fff', border: '1px solid #111' }}>Put it on the site</ConfirmButton>
                  </form>
                  <form method="POST" action="/api/act" style={{ display: 'flex', gap: 6 }}>
                    <input type="hidden" name="action" value="publish_hold"/>
                    <input type="hidden" name="id" value={a.id}/>
                    <input type="hidden" name="back" value={`/approvals?view=staged${artist ? '&artist=' + encodeURIComponent(artist) : ''}`}/>
                    <input name="note" placeholder="Why not"
                      style={{ padding: '6px 8px', border: '1px solid #e3e3dd', borderRadius: 2, fontSize: 12, width: 110, fontFamily: 'inherit' }}/>
                    <ConfirmButton style={{ background: '#fff', color: '#73736c', border: '1px solid #e3e3dd' }}>Send back</ConfirmButton>
                  </form>
                </>}
                {a.site_status === 'held' && <form method="POST" action="/api/act">
                  <input type="hidden" name="action" value="publish_reconsider"/>
                  <input type="hidden" name="id" value={a.id}/>
                  <input type="hidden" name="back" value="/approvals?view=held"/>
                  <ConfirmButton style={{ background: '#fff', color: '#111', border: '1px solid #111' }}>Look at it again</ConfirmButton>
                </form>}
                {a.site_status === 'live' && <>
                  <a className="pill" href={`https://www.chasecontemporary.com/products/${a.handle}`}
                    target="_blank" rel="noopener" style={{ background: '#fff', border: '1px solid #e3e3dd', textDecoration: 'none' }}>See it live</a>
                  <form method="POST" action="/api/act">
                    <input type="hidden" name="action" value="publish_unpublish"/>
                    <input type="hidden" name="id" value={a.id}/>
                    <input type="hidden" name="back" value="/approvals?view=live"/>
                    <ConfirmButton message="Take this off the website?"
                      style={{ background: '#fff', color: '#73736c', border: '1px solid #e3e3dd' }}>Take it down</ConfirmButton>
                  </form>
                </>}
              </div>
            </div>; })}
        </div>}

    <div style={{ display: 'flex', gap: 10, marginTop: 22, alignItems: 'center' }}>
      {page > 1 && <a className="pill" href={`/approvals?view=${view}&page=${page - 1}${artist ? '&artist=' + encodeURIComponent(artist) : ''}`}
        style={{ background: '#fff', border: '1px solid #e3e3dd', textDecoration: 'none' }}>Previous</a>}
      {(works?.length || 0) === PAGE && <a className="pill" href={`/approvals?view=${view}&page=${page + 1}${artist ? '&artist=' + encodeURIComponent(artist) : ''}`}
        style={{ background: '#fff', border: '1px solid #e3e3dd', textDecoration: 'none' }}>Next</a>}
    </div>
  </Shell>;
}
