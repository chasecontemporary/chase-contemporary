import { db } from './db';

// SMS through Twilio. Env-gated on TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_FROM.
// Used for two things only: telling a rep a lead landed, and texting a collector a link
// (details form, private selection, pay link) when they asked for a text. Never marketing.

export const smsReady = () =>
  !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN && !!process.env.TWILIO_FROM;

// US-centric normalisation: 10 digits -> +1, 11 starting with 1 -> +, otherwise as given with +.
export const e164 = (p) => {
  const d = String(p || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.length === 10) return '+1' + d;
  if (d.length === 11 && d[0] === '1') return '+' + d;
  return '+' + d;
};

export async function sendSms({ to, body, template, collectorId, entityType, entityId, actor }) {
  const num = e164(to);
  if (!num) throw new Error('No phone number on file.');
  const { data: row } = await db.from('messages').insert({
    channel: 'sms', template: template || 'custom', to_addr: num, body,
    collector_id: collectorId || null, entity_type: entityType || null, entity_id: entityId || null,
    provider: 'twilio', status: 'queued', created_by: actor || null,
  }).select().single();
  if (!smsReady()) {
    await db.from('messages').update({ status: 'failed', error: 'SMS is not connected yet (TWILIO_*).' }).eq('id', row?.id);
    throw new Error('Texting is not connected yet.');
  }
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(sid + ':' + process.env.TWILIO_AUTH_TOKEN).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: num, From: process.env.TWILIO_FROM, Body: body }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    await db.from('messages').update({ status: 'failed', error: String(j.message || res.statusText).slice(0, 300) }).eq('id', row?.id);
    throw new Error('The text did not send: ' + (j.message || res.statusText));
  }
  await db.from('messages').update({ status: 'sent', provider_id: j.sid || null }).eq('id', row?.id);
  if (collectorId) await db.from('activities').insert({
    entity_type: 'collector', entity_id: collectorId, kind: 'sms_sent',
    body: body.slice(0, 120), actor: actor || 'system',
  });
  return { sid: j.sid, messageId: row?.id };
}
