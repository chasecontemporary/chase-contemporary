import crypto from 'crypto';
import { db } from './db';

// DocuSign eSignature, JWT grant, no SDK. Env-gated:
//   DOCUSIGN_INTEGRATION_KEY  the app's client id
//   DOCUSIGN_USER_ID          the API user (impersonated) GUID
//   DOCUSIGN_ACCOUNT_ID       the account GUID
//   DOCUSIGN_PRIVATE_KEY      RSA private key PEM (\n escaped is fine)
//   DOCUSIGN_BASE             'demo' (account-d.docusign.com / demo.docusign.net) or 'prod'
//   DOCUSIGN_CONNECT_SECRET   HMAC key for the Connect webhook (optional but recommended)
//
// Flow: a PDF the engine already made (invoice, certificate, agreement) goes out as an
// envelope with the collector as signer and, optionally, the gallery as countersigner.
// Connect posts status back to /api/docusign-webhook; when completed, the executed PDF is
// pulled and stored on Blob next to the original.

export const docusignReady = () =>
  !!process.env.DOCUSIGN_INTEGRATION_KEY && !!process.env.DOCUSIGN_USER_ID &&
  !!process.env.DOCUSIGN_ACCOUNT_ID && !!process.env.DOCUSIGN_PRIVATE_KEY;

const isProd = () => (process.env.DOCUSIGN_BASE || 'demo') === 'prod';
const AUTH_HOST = () => isProd() ? 'account.docusign.com' : 'account-d.docusign.com';
const API_BASE = () => process.env.DOCUSIGN_API_BASE ||
  (isProd() ? 'https://na4.docusign.net/restapi' : 'https://demo.docusign.net/restapi');

const b64url = (b) => Buffer.from(b).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
let cached = { token: null, exp: 0 };

async function accessToken() {
  if (cached.token && Date.now() < cached.exp - 60000) return cached.token;
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: process.env.DOCUSIGN_INTEGRATION_KEY, sub: process.env.DOCUSIGN_USER_ID,
    aud: AUTH_HOST(), iat: now, exp: now + 3600, scope: 'signature impersonation',
  }));
  const key = process.env.DOCUSIGN_PRIVATE_KEY.replace(/\\n/g, '\n');
  const sig = crypto.createSign('RSA-SHA256').update(header + '.' + claims).sign(key);
  const jwt = header + '.' + claims + '.' + b64url(sig);
  const r = await fetch(`https://${AUTH_HOST()}/oauth/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) {
    const why = j.error === 'consent_required'
      ? 'DocuSign consent has not been granted for the integration key yet.'
      : (j.error_description || j.error || r.statusText);
    throw new Error('DocuSign sign-in failed: ' + why);
  }
  cached = { token: j.access_token, exp: Date.now() + Number(j.expires_in || 3600) * 1000 };
  return cached.token;
}

async function api(path, method = 'GET', body, raw = false) {
  const tok = await accessToken();
  const r = await fetch(`${API_BASE()}/v2.1/accounts/${process.env.DOCUSIGN_ACCOUNT_ID}${path}`, {
    method, headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`DocuSign ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return raw ? Buffer.from(await r.arrayBuffer()) : r.json();
}

/**
 * Send a PDF for signature. Signature tabs are anchored to text the engine's PDFs already
 * carry ("AUTHORIZED SIGNATURE" on a certificate; for an invoice, "TOTAL DUE" places the
 * collector's signature under the total). Anchors that don't exist are simply ignored.
 */
export async function createEnvelope({ pdfBytes, name, subject, message, signer, countersigner, anchors }) {
  const recipients = { signers: [{
    email: signer.email, name: signer.name || signer.email, recipientId: '1', routingOrder: '1',
    tabs: { signHereTabs: (anchors?.signer || ['AUTHORIZED SIGNATURE', 'TOTAL DUE', 'ACCEPTED BY']).map((a, i) => ({
      anchorString: a, anchorUnits: 'pixels', anchorXOffset: '0', anchorYOffset: i === 0 ? '-28' : '18', anchorIgnoreIfNotPresent: 'true' })),
      dateSignedTabs: [{ anchorString: 'DATE', anchorUnits: 'pixels', anchorYOffset: '-28', anchorIgnoreIfNotPresent: 'true' }] },
  }] };
  if (countersigner?.email) recipients.signers.push({
    email: countersigner.email, name: countersigner.name || 'Chase Contemporary', recipientId: '2', routingOrder: '2',
    tabs: { signHereTabs: [{ anchorString: 'GALLERY SIGNATURE', anchorUnits: 'pixels', anchorYOffset: '-28', anchorIgnoreIfNotPresent: 'true' }] },
  });
  const env = await api('/envelopes', 'POST', {
    emailSubject: subject || `${name} from Chase Contemporary`,
    emailBlurb: message || 'Please review and sign.',
    documents: [{ documentBase64: Buffer.from(pdfBytes).toString('base64'), name: name + '.pdf', fileExtension: 'pdf', documentId: '1' }],
    recipients, status: 'sent',
  });
  return { envelopeId: env.envelopeId, status: env.status };
}

export async function envelopeStatus(envelopeId) {
  return api(`/envelopes/${envelopeId}`);
}

export async function signedPdf(envelopeId) {
  return api(`/envelopes/${envelopeId}/documents/combined`, 'GET', undefined, true);
}

// Connect webhook HMAC (DocuSign signs the raw body with each configured secret).
export function verifyConnect(rawBody, headers) {
  const secret = process.env.DOCUSIGN_CONNECT_SECRET;
  if (!secret) return true;                                   // not configured: accept (still logged)
  const given = headers.get('x-docusign-signature-1') || '';
  const digest = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
  const a = Buffer.from(digest), b = Buffer.from(given);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Record + send: one call from the act route. Stores the document row first so a failed
// send is visible as 'draft' rather than vanishing.
export async function sendForSignature({ kind, pdfUrl, pdfBytes, name, collector, invoiceId, saleId, artworkId, actor, message }) {
  if (!collector?.email || collector.email.endsWith('import.chasecontemporary.com'))
    throw new Error('This collector has no real email address to sign from.');
  const { data: doc } = await db.from('documents').insert({
    kind, collector_id: collector.id, invoice_id: invoiceId || null, sale_id: saleId || null,
    artwork_id: artworkId || null, pdf_url: pdfUrl || null, status: 'draft',
    signer_email: collector.email, signer_name: [collector.first_name, collector.last_name].filter(Boolean).join(' '),
    created_by: actor || null,
  }).select().single();
  if (!docusignReady()) throw new Error('DocuSign is not connected yet.');
  const bytes = pdfBytes || Buffer.from(await (await fetch(pdfUrl)).arrayBuffer());
  const { envelopeId } = await createEnvelope({
    pdfBytes: bytes, name, message,
    signer: { email: collector.email, name: doc.signer_name || collector.email },
    countersigner: process.env.DOCUSIGN_COUNTERSIGNER_EMAIL
      ? { email: process.env.DOCUSIGN_COUNTERSIGNER_EMAIL, name: 'Chase Contemporary' } : null,
  });
  await db.from('documents').update({ envelope_id: envelopeId, status: 'sent', sent_at: new Date().toISOString() }).eq('id', doc.id);
  await db.from('activities').insert({ entity_type: 'collector', entity_id: collector.id,
    kind: 'sent_for_signature', body: `${name} · DocuSign`, actor: actor || 'system' });
  return { documentId: doc.id, envelopeId };
}
