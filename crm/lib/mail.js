import { db } from './db';

// Transactional email, sent from the gallery's own domain through Resend.
//
// Env-gated: RESEND_API_KEY switches it on; MAIL_FROM is the sender ("Chase Contemporary
// <sales@chasecontemporary.com>"). Until the key exists every caller falls back to a
// mailto: draft in the rep's own mail client, so nothing is ever blocked on the account.
//
// Every send is written to `messages` first and updated with the provider id or the
// error, so a failure is visible on the collector's record rather than swallowed.

export const mailReady = () => !!process.env.RESEND_API_KEY && !!process.env.MAIL_FROM;
export const MAIL_FROM = () => process.env.MAIL_FROM || 'Chase Contemporary <info@chasecontemporary.com>';
export const REPLY_TO = () => process.env.MAIL_REPLY_TO || 'info@chasecontemporary.com';

const synthetic = (e) => !e || String(e).endsWith('import.chasecontemporary.com');

/**
 * @param {object} m
 * @param {string|string[]} m.to
 * @param {string} m.subject
 * @param {string} m.html
 * @param {string} [m.text]
 * @param {Array<{filename:string, content:Buffer|string, contentType?:string}>} [m.attachments]
 * @param {string} [m.template]
 * @param {string} [m.collectorId]
 * @param {string} [m.entityType]
 * @param {string} [m.entityId]
 * @param {string} [m.actor]
 * @param {string} [m.replyTo]
 * @param {string[]} [m.bcc]
 */
export async function sendMail(m) {
  const to = Array.isArray(m.to) ? m.to : [m.to];
  if (to.some(synthetic)) throw new Error('This collector has no real email address on file.');

  const { data: row } = await db.from('messages').insert({
    channel: 'email', template: m.template || 'custom', to_addr: to.join(', '),
    subject: m.subject, body: m.html, collector_id: m.collectorId || null,
    entity_type: m.entityType || null, entity_id: m.entityId || null,
    provider: 'resend', status: 'queued', created_by: m.actor || null,
  }).select().single();

  if (!mailReady()) {
    await db.from('messages').update({ status: 'failed', error: 'Email is not connected yet (RESEND_API_KEY).' }).eq('id', row?.id);
    throw new Error('Email is not connected yet. Use the draft button for now.');
  }

  const payload = {
    from: MAIL_FROM(), to, subject: m.subject, html: m.html, text: m.text || undefined,
    reply_to: m.replyTo || REPLY_TO(),
    bcc: m.bcc && m.bcc.length ? m.bcc : undefined,
    attachments: (m.attachments || []).map(a => ({
      filename: a.filename,
      content: Buffer.isBuffer(a.content) ? a.content.toString('base64') : a.content,
      content_type: a.contentType || undefined,
    })),
    headers: row?.id ? { 'X-Entity-Ref-ID': row.id } : undefined,
  };
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    await db.from('messages').update({ status: 'failed', error: (body.message || res.statusText).slice(0, 300) }).eq('id', row?.id);
    throw new Error('The email did not send: ' + (body.message || res.statusText));
  }
  await db.from('messages').update({ status: 'sent', provider_id: body.id || null }).eq('id', row?.id);
  if (m.collectorId) await db.from('activities').insert({
    entity_type: 'collector', entity_id: m.collectorId, kind: 'email_sent',
    body: `${m.subject}${m.template ? ' · ' + m.template.replace(/_/g, ' ') : ''}`, actor: m.actor || 'system',
  });
  return { id: body.id, messageId: row?.id };
}

// Fetch a Blob-stored PDF for attaching. Small files only (invoices, certificates).
export async function fetchAttachment(url, filename) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('Could not read the document to attach it.');
  return { filename, content: Buffer.from(await r.arrayBuffer()), contentType: 'application/pdf' };
}
