import { put } from '@vercel/blob';
import { db } from '../../../lib/db';
import { verifyConnect, signedPdf, docusignReady } from '../../../lib/docusign';

// DocuSign Connect: envelope status back onto the document record. When an envelope
// completes, the executed PDF is pulled and stored next to the original.
// Configure in DocuSign: Connect -> Add configuration -> URL https://<app>/api/docusign-webhook,
// events: sent, delivered, completed, declined, voided; JSON (SIM) format; HMAC key =
// DOCUSIGN_CONNECT_SECRET.
export async function POST(req) {
  const raw = await req.text();
  if (!verifyConnect(raw, req.headers)) return new Response('bad signature', { status: 401 });
  let ev; try { ev = JSON.parse(raw); } catch { return new Response('bad json', { status: 400 }); }
  const envelopeId = ev?.data?.envelopeId || ev?.envelopeId;
  const status = String(ev?.data?.envelopeSummary?.status || ev?.event || '').toLowerCase().replace('envelope-', '');
  if (!envelopeId) return Response.json({ ok: true, ignored: true });

  const { data: doc } = await db.from('documents').select('*').eq('envelope_id', envelopeId).maybeSingle();
  if (!doc) return Response.json({ ok: true, unknown: true });

  const patch = {};
  const now = new Date().toISOString();
  if (status === 'sent') patch.status = 'sent';
  if (status === 'delivered') { patch.status = 'delivered'; patch.viewed_at = doc.viewed_at || now; }
  if (status === 'declined') patch.status = 'declined';
  if (status === 'voided') patch.status = 'voided';
  if (status === 'completed') {
    patch.status = 'completed'; patch.signed_at = now;
    if (docusignReady()) {
      try {
        const bytes = await signedPdf(envelopeId);
        const blob = await put(`signed/${doc.kind}-${envelopeId}.pdf`, Buffer.from(bytes),
          { access: 'public', contentType: 'application/pdf', addRandomSuffix: true });
        patch.signed_pdf_url = blob.url;
      } catch { /* status still lands; the PDF can be re-pulled later */ }
    }
  }
  if (Object.keys(patch).length) await db.from('documents').update(patch).eq('id', doc.id);
  if (patch.status && doc.collector_id) await db.from('activities').insert({
    entity_type: 'collector', entity_id: doc.collector_id,
    kind: 'document_' + patch.status, body: `${doc.kind}${patch.signed_pdf_url ? ' · executed copy on file' : ''}`, actor: 'docusign' });
  return Response.json({ ok: true });
}
