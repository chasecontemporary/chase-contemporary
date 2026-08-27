import Shell from '../../components/Shell';
import Sla from '../../components/Sla';
import Omnisearch from '../../components/Omnisearch';
import { db } from '../../lib/db';
import { cookies } from 'next/headers';
export const dynamic = 'force-dynamic';

// The landing page. Three jobs, in order: what changed since you were last here,
// what is decaying if ignored, and where the money stands. It points at Pipeline
// and Finance — it never duplicates them. Empty sections mean the machine is healthy.

const usd = (c) => '$' + Math.round((c || 0) / 100).toLocaleString();
const ago = (t) => {
  const m = Math.floor((Date.now() - new Date(t).getTime()) / 60000);
  if (m < 60) return m + 'm ago';
  if (m < 1440) return Math.floor(m / 60) + 'h ago';
  const d = Math.floor(m / 1440);
  return d === 1 ? 'yesterday' : d + ' days ago';
};
const nameOf = (c) => [c?.first_name, c?.last_name].filter(Boolean).join(' ') || 'Unknown';
const pretty = (seg) => seg.replace(/-/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());

export default async function Today() {
  const jar = await cookies();
  const viewer = decodeURIComponent(jar.get('cc_rep')?.value || '');
  const H48 = new Date(Date.now() - 48 * 3600000).toISOString();
  const D5 = new Date(Date.now() - 5 * 86400000).toISOString();
  const D7 = new Date(Date.now() - 7 * 86400000).toISOString();
  const D30 = new Date(Date.now() - 30 * 86400000).toISOString();
  const H60 = new Date(Date.now() - 60 * 3600000).toISOString();
  const monthStart = new Date();
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const cutoff = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);

  const [
    { data: team }, { data: inqs }, { data: paysNew }, { data: formsDone }, { data: visits },
    { data: offersViewed },
    { data: chaseInv }, { data: openInv }, { data: paysAll }, { data: paysMonth },
    { data: respRows }, { data: agingRows },
  ] = await Promise.all([
    db.from('team_members').select('name, role'),
    db.from('inquiries')
      .select('id, status, owner, created_at, stage_changed_at, first_called_at, contacted_at, artwork_title, purpose, collector_id, collectors(first_name, last_name)')
      .in('status', ['new', 'contacted', 'in_conversation', 'hold']).order('created_at', { ascending: false }).limit(300),
    db.from('payments').select('amount_cents, settled_at, method, invoices(invoice_number, collectors(id, first_name, last_name))')
      .eq('status', 'settled').gte('settled_at', H48).order('settled_at', { ascending: false }).limit(20),
    db.from('collectors').select('id, first_name, last_name, details_completed_at')
      .gte('details_completed_at', H48).limit(20),
    db.from('site_events').select('collector_id, path, occurred_at, collectors(first_name, last_name)')
      .not('collector_id', 'is', null).gte('occurred_at', H48).order('occurred_at', { ascending: false }).limit(400),
    db.from('offers').select('id, title, view_count, last_viewed_at, collector_id, collectors(first_name, last_name)')
      .gte('last_viewed_at', H48).order('last_viewed_at', { ascending: false }).limit(20),
    db.from('invoices').select('id, invoice_number, amount_cents, tax_cents, shipping_cents, ar_status, issued_at, last_nudge_at, collectors(id, first_name, last_name)')
      .eq('status', 'open').order('issued_at').limit(200),
    db.from('invoices').select('id, amount_cents, tax_cents, shipping_cents').eq('status', 'open').limit(500),
    db.from('payments').select('invoice_id, amount_cents').eq('status', 'settled').not('invoice_id', 'is', null).limit(2000),
    db.from('payments').select('amount_cents').eq('status', 'settled').gte('settled_at', monthStart.toISOString()).limit(2000),
    db.from('inquiries').select('created_at, first_called_at').gte('created_at', D30).not('first_called_at', 'is', null).limit(500),
    db.from('artworks').select('id, title, artist, price_cents, internal_value_cents, image_url, acquired_at')
      .eq('available', true).lt('acquired_at', cutoff)
      .order('price_cents', { ascending: false, nullsFirst: false }).limit(6),
  ]);

  const personal = (team || []).find(t => t.name === viewer)?.role === 'rep';

  // ---- what's new (last two days) ----
  const pulse = [];
  (inqs || []).filter(r => r.created_at >= H48).forEach(r => pulse.push({
    at: r.created_at, kind: 'New inquiry', color: '#2257c5', href: '/pipeline',
    text: `${nameOf(r.collectors)} asked about ${r.artwork_title || r.purpose || 'the gallery'}`,
  }));
  (paysNew || []).forEach(p => pulse.push({
    at: p.settled_at, kind: 'Money in', color: '#2e6b3f', href: '/finance',
    text: `${usd(p.amount_cents)} received from ${nameOf(p.invoices?.collectors)} on invoice №${String(p.invoices?.invoice_number || 0).padStart(4, '0')}`,
  }));
  (formsDone || []).forEach(c => pulse.push({
    at: c.details_completed_at, kind: 'Form completed', color: '#56599f', href: '/collectors/' + c.id,
    text: `${nameOf(c)} filled in their billing details`,
  }));
  (offersViewed || []).forEach(o => pulse.push({
    at: o.last_viewed_at, kind: 'Selection opened', color: '#7d4d9e', href: '/collectors/' + o.collector_id,
    text: `${nameOf(o.collectors)} opened ${o.title ? `"${o.title}"` : 'their private selection'}${o.view_count > 1 ? ` — ${o.view_count} times now` : ''}`,
  }));
  const byVisitor = {};
  (visits || []).forEach(e => {
    const b = byVisitor[e.collector_id] = byVisitor[e.collector_id] ||
      { name: nameOf(e.collectors), id: e.collector_id, pages: 0, last: e.occurred_at, seen: new Set() };
    b.pages += 1;
    if (e.occurred_at > b.last) b.last = e.occurred_at;
    const m = String(e.path || '').match(/^\/(collections|products)\/([^/?#]+)/);
    if (m) b.seen.add(pretty(m[2]));
  });
  Object.values(byVisitor).forEach(v => pulse.push({
    at: v.last, kind: 'On the site', color: '#8f6f14', href: '/collectors/' + v.id,
    text: `${v.name} browsed ${v.pages} page${v.pages === 1 ? '' : 's'}${v.seen.size ? ' — ' + [...v.seen].slice(0, 3).join(', ') : ''}`,
  }));
  pulse.sort((a, b) => new Date(b.at) - new Date(a.at));

  // ---- needs attention ----
  const answerNow = (inqs || []).filter(r => r.status === 'new');
  const quiet = (inqs || []).filter(r => ['contacted', 'in_conversation'].includes(r.status)
    && (r.stage_changed_at || r.created_at) < D5
    && (!personal || r.owner === viewer));
  const paidIn = {};
  (paysAll || []).forEach(p => { paidIn[p.invoice_id] = (paidIn[p.invoice_id] || 0) + Number(p.amount_cents); });
  const tot = (i) => i.amount_cents + (i.tax_cents || 0) + (i.shipping_cents || 0);
  const balance = (i) => Math.max(0, tot(i) - (paidIn[i.id] || 0));
  const chase = (chaseInv || []).filter(i => balance(i) > 0).map(i => {
    const daysOld = Math.floor((Date.now() - new Date(i.issued_at).getTime()) / 86400000);
    if (i.ar_status === 'issued' && daysOld >= 1)
      return { ...i, why: `created ${daysOld} day${daysOld === 1 ? '' : 's'} ago, never sent` };
    const lastTouch = i.last_nudge_at || i.issued_at;
    if (i.ar_status !== 'issued' && lastTouch < D7) {
      const d = Math.floor((Date.now() - new Date(lastTouch).getTime()) / 86400000);
      return { ...i, why: `nothing received, quiet ${d} days` };
    }
    return null;
  }).filter(Boolean);
  const holdsOut = (inqs || []).filter(r => r.status === 'hold' && (r.stage_changed_at || r.created_at) < H60);
  const attentionCount = answerNow.length + quiet.length + chase.length + holdsOut.length;

  // ---- the numbers ----
  const collectedMonth = (paysMonth || []).reduce((s, p) => s + Number(p.amount_cents), 0);
  const owed = (openInv || []).reduce((s, i) => s + balance(i), 0);
  const inMotion = (inqs || []).filter(r => ['contacted', 'in_conversation', 'hold'].includes(r.status)).length;
  const respMins = (respRows || [])
    .map(r => (new Date(r.first_called_at) - new Date(r.created_at)) / 60000)
    .filter(m => m >= 0).sort((a, b) => a - b);
  const median = respMins.length ? respMins[Math.floor(respMins.length / 2)] : null;
  const respStr = median === null ? '—'
    : median < 60 ? Math.round(median) + 'm'
    : median < 1440 ? Math.floor(median / 60) + 'h ' + Math.round(median % 60) + 'm'
    : Math.round(median / 1440) + ' days';

  const sec = { fontSize: 11, fontWeight: 650, letterSpacing: '.07em', textTransform: 'uppercase',
    color: '#73736c', margin: '30px 0 10px' };
  const card = { background: '#fff', border: '1px solid #e3e3dd', borderRadius:3,
    boxShadow: '0 1px 2px rgba(0,0,0,.03)' };
  const rowSt = (i) => ({ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 16px',
    borderTop: i ? '1px solid #f0f0eb' : 'none', fontSize: 13.5, textDecoration: 'none', color: 'inherit' });

  return <Shell active="today" counts={{ today: attentionCount }}>
    <div className="h1">Today</div>
    <div className="sub">What changed, what needs you, and where the money stands{personal ? ` · showing ${viewer}'s follow-ups` : ''}</div>
    <Omnisearch/>

    <div style={sec}>What&apos;s new · last two days</div>
    <div style={card}>
      {pulse.length === 0 && <div style={{padding: '14px 16px', fontSize: 13.5, color: '#73736c'}}>
        Quiet — no new inquiries, payments, or site visits from known collectors.</div>}
      {pulse.slice(0, 14).map((p, i) => <a key={i} href={p.href} style={rowSt(i)}>
        <span style={{fontSize: 10, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase',
          color: p.color, width: 104, flex: '0 0 auto'}}>{p.kind}</span>
        <span style={{flex: 1, minWidth: 0}}>{p.text}</span>
        <span style={{fontSize: 12, color: '#73736c', flex: '0 0 auto'}}>{ago(p.at)}</span>
      </a>)}
    </div>

    <div style={sec}>Needs attention</div>
    {attentionCount === 0
      ? <div style={{...card, padding: '14px 16px', fontSize: 13.5, color: '#2e6b3f', fontWeight: 600}}>
          Nothing is waiting on anyone. The machine is healthy.</div>
      : <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
        {answerNow.length > 0 && <div style={card}>
          <div style={{padding: '12px 16px 4px', fontSize: 13, fontWeight: 700}}>
            Answer now — {answerNow.length} inquir{answerNow.length === 1 ? 'y' : 'ies'} with no first response</div>
          {answerNow.slice(0, 5).map((r, i) => <a key={r.id} href="/pipeline" style={rowSt(i)}>
            <Sla createdAt={r.created_at} contactedAt={r.contacted_at}/>
            <span style={{flex: 1}}><b>{nameOf(r.collectors)}</b>
              <span style={{color: '#73736c'}}> · {r.artwork_title || r.purpose}</span></span>
            <span style={{fontSize: 12, color: '#2257c5', fontWeight: 650}}>Open in Pipeline →</span>
          </a>)}
        </div>}
        {quiet.length > 0 && <div style={card}>
          <div style={{padding: '12px 16px 4px', fontSize: 13, fontWeight: 700}}>
            Gone quiet — {quiet.length} conversation{quiet.length === 1 ? '' : 's'} with no movement in 5+ days</div>
          {quiet.slice(0, 5).map((r, i) => <a key={r.id} href="/pipeline" style={rowSt(i)}>
            <span style={{flex: 1}}><b>{nameOf(r.collectors)}</b>
              <span style={{color: '#73736c'}}> · {r.artwork_title || r.purpose}{r.owner ? ' · ' + r.owner : ''}</span></span>
            <span style={{fontSize: 12.5, color: '#9a551a', fontWeight: 650}}>
              {Math.floor((Date.now() - new Date(r.stage_changed_at || r.created_at).getTime()) / 86400000)} days quiet</span>
          </a>)}
        </div>}
        {chase.length > 0 && <div style={card}>
          <div style={{padding: '12px 16px 4px', fontSize: 13, fontWeight: 700}}>
            Money to chase — {chase.length} open invoice{chase.length === 1 ? '' : 's'} need{chase.length === 1 ? 's' : ''} a follow-up</div>
          {chase.slice(0, 5).map((v, i) => <a key={v.id} href="/finance" style={rowSt(i)}>
            <span style={{flex: 1}}><b>№{String(v.invoice_number).padStart(4, '0')} · {nameOf(v.collectors)}</b>
              <span style={{color: '#9a551a'}}> · {v.why}</span></span>
            <span style={{fontWeight: 700, fontVariantNumeric: 'tabular-nums'}}>{usd(balance(v))}</span>
          </a>)}
        </div>}
        {holdsOut.length > 0 && <div style={card}>
          <div style={{padding: '12px 16px 4px', fontSize: 13, fontWeight: 700}}>
            Holds running out — decide: invoice or release</div>
          {holdsOut.slice(0, 5).map((r, i) => <a key={r.id} href="/pipeline" style={rowSt(i)}>
            <span style={{flex: 1}}><b>{nameOf(r.collectors)}</b>
              <span style={{color: '#73736c'}}> · {r.artwork_title || r.purpose}</span></span>
            <span style={{fontSize: 12.5, color: '#c02d23', fontWeight: 650}}>
              held {Math.floor((Date.now() - new Date(r.stage_changed_at || r.created_at).getTime()) / 3600000)}h</span>
          </a>)}
        </div>}
      </div>}

    <div style={sec}>Where the money stands</div>
    <div className="stats" style={{marginTop: 0}}>
      <div className="stat"><div className="n">{usd(collectedMonth)}</div><div className="l">Collected this month</div></div>
      <div className="stat"><div className="n">{usd(owed)}</div><div className="l">Owed to the gallery</div></div>
      <div className="stat"><div className="n">{inMotion}</div><div className="l">Conversations in motion</div></div>
      <div className="stat"><div className="n">{respStr}</div><div className="l">Typical first response</div></div>
    </div>

    {(agingRows || []).length > 0 && <>
      <div style={sec}>Move list · sitting over a year</div>
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12}}>
        {(agingRows || []).map(w => {
          const mo = Math.floor((Date.now() - new Date(w.acquired_at)) / 2629800000);
          return <a key={w.id} href={'/inventory/' + w.id} className="card"
            style={{padding: 8, display: 'block', textDecoration: 'none', color: 'inherit'}}>
            <div style={{aspectRatio: '1', background: '#fafaf7', borderRadius:2, overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              {w.image_url ? <img src={w.image_url + (w.image_url.includes('?') ? '&' : '?') + 'width=300'} alt=""
                style={{width: '100%', height: '100%', objectFit: 'contain'}}/>
                : <span style={{fontSize: 10, color: '#c2c2bb'}}>NO IMAGE</span>}
            </div>
            <div style={{fontSize: 11, fontWeight: 650, marginTop: 6, textTransform: 'uppercase', letterSpacing: '.04em'}}>{w.artist}</div>
            <div style={{fontSize: 12, fontStyle: 'italic', color: '#3a3a35', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{w.title}</div>
            <div style={{fontSize: 11.5, marginTop: 3, fontWeight: 600}}>
              {(w.price_cents || w.internal_value_cents) > 0 ? usd(w.price_cents || w.internal_value_cents) : 'POR'}
              <span className="pill" style={{marginLeft: 6, fontSize: 9.5, fontWeight: 700, background: '#f3e8d5', color: '#9a551a'}}>{mo} MO</span></div>
          </a>; })}
      </div>
    </>}
  </Shell>;
}
