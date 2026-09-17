import Shell from '../../components/Shell';
import DocPreview from '../../components/DocPreview';
import ConfirmButton from '../../components/ConfirmButton';
import { signingBoard, missingPaper, DOC_LABEL, STATUS_LABEL, THRESHOLD } from '../../lib/signing';
import { docusignReady } from '../../lib/docusign';
export const dynamic = 'force-dynamic';

// Every piece of paper the gallery is waiting on, in one place. The order is the order a
// person cares about it: what has not been papered at all, what is out and going cold, what
// came back refused, and then the executed file.

const usd = (c) => '$' + Math.round((c || 0) / 100).toLocaleString();
const nameOf = (c) => [c?.first_name, c?.last_name].filter(Boolean).join(' ') || 'Unknown';
const days = (t) => Math.floor((Date.now() - new Date(t).getTime()) / 86400000);
const ago = (t) => { const d = days(t); return d === 0 ? 'today' : d === 1 ? 'yesterday' : d + ' days ago'; };

export default async function Signing() {
  const connected = docusignReady();
  const [board, missing] = await Promise.all([signingBoard(), missingPaper()]);
  const cold = board.waiting.filter(d => days(d.sent_at || d.created_at) >= 3);
  const attention = missing.length + board.stuck.length + cold.length;

  const sec = { fontSize: 11, fontWeight: 650, letterSpacing: '.07em', textTransform: 'uppercase',
    color: '#73736c', margin: '30px 0 10px' };
  const card = { background: '#fff', border: '1px solid #e3e3dd', borderRadius: 3,
    boxShadow: '0 1px 2px rgba(0,0,0,.03)' };
  const rowSt = (i) => ({ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 16px',
    borderTop: i ? '1px solid #f0f0eb' : 'none', fontSize: 13.5, flexWrap: 'wrap' });
  const pill = (colour) => ({ fontSize: 10, fontWeight: 700, letterSpacing: '.05em',
    textTransform: 'uppercase', color: colour, flex: '0 0 auto' });

  const person = (d) => d.collectors
    ? <a href={'/collectors/' + d.collectors.id} style={{ fontWeight: 600, color: 'inherit' }}>{nameOf(d.collectors)}</a>
    : <b>{d.signer_name || d.signer_email || 'Unknown'}</b>;

  return <Shell active="signing" counts={{ signing: attention }}>
    <div className="h1">Signing</div>
    <div className="sub">What still has to be signed, what is out, and what came back</div>

    {!connected && <div style={{ background: '#fdf3e3', border: '1px solid #e8d5ae', color: '#7a5310',
      padding: '13px 16px', marginTop: 16, fontSize: 13.5, lineHeight: 1.6 }}>
      <b style={{ letterSpacing: '.06em', fontSize: 10.5 }}>NOT CONNECTED YET</b><br/>
      DocuSign is not set up, so nothing can be sent for signature from here. Agreements and
      certificates still generate and can be sent by hand. The setup steps are in docs/SIGNING.md.
    </div>}

    <div style={sec}>Sales that still need paper</div>
    <div style={card}>
      {missing.length === 0
        ? <div style={{ padding: '14px 16px', fontSize: 13.5, color: '#73736c' }}>
            Nothing outstanding. Every sale over {usd(THRESHOLD())} has its agreement signed or out for signature.</div>
        : missing.map((i, n) => <div key={i.id} style={rowSt(n)}>
            <span style={pill('#9a551a')}>{i.state}</span>
            <span style={{ flex: 1, minWidth: 220 }}>
              <b>No. {String(i.invoice_number).padStart(4, '0')}</b>
              <span style={{ marginLeft: 8 }}>{nameOf(i.collectors)}</span>
              <div style={{ fontSize: 12, color: '#73736c', marginTop: 2 }}>
                Needs a purchase agreement because {i.why}. Invoiced {ago(i.issued_at)}.</div>
            </span>
            <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, flex: '0 0 auto' }}>{usd(i.total_cents)}</span>
            <a href="/finance" className="btn mini" style={{ background: '#111', color: '#fff', flex: '0 0 auto' }}>Open in Finance</a>
          </div>)}
    </div>

    <div style={sec}>Out for signature</div>
    <div style={card}>
      {board.waiting.length === 0
        ? <div style={{ padding: '14px 16px', fontSize: 13.5, color: '#73736c' }}>Nothing is waiting on a signature.</div>
        : board.waiting.map((d, n) => <div key={d.id} style={rowSt(n)}>
            <span style={pill(days(d.sent_at || d.created_at) >= 3 ? '#9a551a' : '#56599f')}>
              {STATUS_LABEL[d.status] || d.status}</span>
            <span style={{ flex: 1, minWidth: 220 }}>
              {person(d)}
              <span style={{ marginLeft: 8, color: '#73736c' }}>{DOC_LABEL[d.kind] || d.kind}</span>
              <div style={{ fontSize: 12, color: '#73736c', marginTop: 2 }}>
                Sent {ago(d.sent_at || d.created_at)}
                {d.viewed_at ? ', opened ' + ago(d.viewed_at) : ', not opened yet'}
                {d.created_by ? ' · ' + d.created_by : ''}</div>
            </span>
            {d.pdf_url && <DocPreview url={d.pdf_url} label={DOC_LABEL[d.kind] || 'Document'} compact/>}
            <form method="POST" action="/api/act" style={{ flex: '0 0 auto' }}>
              <input type="hidden" name="action" value="doc_remind"/>
              <input type="hidden" name="id" value={d.id}/>
              <input type="hidden" name="back" value="/signing"/>
              <button className="btn mini" style={{ background: '#fff', color: '#111', border: '1px solid #111' }}>Remind</button>
            </form>
            <form method="POST" action="/api/act" style={{ flex: '0 0 auto' }}>
              <input type="hidden" name="action" value="doc_void"/>
              <input type="hidden" name="id" value={d.id}/>
              <input type="hidden" name="back" value="/signing"/>
              <ConfirmButton message="Void this envelope? The collector's link stops working and the document has to be sent again."
                style={{ background: '#fff', color: '#73736c', border: '1px solid #e3e3dd' }}>Void</ConfirmButton>
            </form>
          </div>)}
    </div>

    {board.stuck.length > 0 && <>
      <div style={sec}>Came back unsigned</div>
      <div style={card}>
        {board.stuck.map((d, n) => <div key={d.id} style={rowSt(n)}>
          <span style={pill('#a3372f')}>{STATUS_LABEL[d.status] || d.status}</span>
          <span style={{ flex: 1, minWidth: 220 }}>
            {person(d)}
            <span style={{ marginLeft: 8, color: '#73736c' }}>{DOC_LABEL[d.kind] || d.kind}</span>
            <div style={{ fontSize: 12, color: '#73736c', marginTop: 2 }}>{ago(d.sent_at || d.created_at)}</div>
          </span>
          {d.pdf_url && <DocPreview url={d.pdf_url} label={DOC_LABEL[d.kind] || 'Document'} compact/>}
        </div>)}
      </div>
    </>}

    <div style={sec}>Signed</div>
    <div style={card}>
      {board.signed.length === 0
        ? <div style={{ padding: '14px 16px', fontSize: 13.5, color: '#73736c' }}>Nothing has been signed through the engine yet.</div>
        : board.signed.map((d, n) => <div key={d.id} style={rowSt(n)}>
            <span style={pill('#2e6b3f')}>Signed</span>
            <span style={{ flex: 1, minWidth: 220 }}>
              {person(d)}
              <span style={{ marginLeft: 8, color: '#73736c' }}>{DOC_LABEL[d.kind] || d.kind}</span>
              <div style={{ fontSize: 12, color: '#73736c', marginTop: 2 }}>Signed {ago(d.signed_at || d.created_at)}</div>
            </span>
            {d.signed_pdf_url
              ? <DocPreview url={d.signed_pdf_url} label="Executed copy" compact signed/>
              : d.pdf_url && <DocPreview url={d.pdf_url} label={DOC_LABEL[d.kind] || 'Document'} compact/>}
          </div>)}
    </div>
  </Shell>;
}
