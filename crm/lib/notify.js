import { db } from './db';
import { mailReady, sendMail } from './mail';
import { smsReady, sendSms } from './sms';

// Telling people things. Three lanes, each env-gated, each a no-op when its key is absent:
//   Slack  (SLACK_WEBHOOK_URL)     the floor channel: every inquiry, every payment
//   Email  (RESEND_API_KEY)        the rep who owns it, or every active rep when unclaimed
//   SMS    (TWILIO_*)              same, when the rep has a phone on Team
// Nothing here throws to its caller: an alert that fails must never fail the thing it is
// announcing (a captured lead, a settled payment).

export const slackReady = () => !!process.env.SLACK_WEBHOOK_URL;
const APP = () => process.env.APP_URL || 'https://chase-engine.vercel.app';

export async function slack(text, blocks) {
  if (!slackReady()) return false;
  try {
    const r = await fetch(process.env.SLACK_WEBHOOK_URL, { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(blocks ? { text, blocks } : { text }) });
    await db.from('messages').insert({ channel: 'slack', template: 'alert', to_addr: 'floor', body: text,
      provider: 'slack', status: r.ok ? 'sent' : 'failed', error: r.ok ? null : String(r.status) });
    return r.ok;
  } catch { return false; }
}

// Active team members with contact details, optionally one person.
export async function reps(name) {
  const { data } = await db.from('team_members').select('name, email, phone, role, active').eq('active', true);
  const all = (data || []).filter(t => t.email || t.phone);
  return name ? all.filter(t => t.name === name) : all;
}

// Send the same short message to a set of reps by email and text. Best effort.
export async function alertReps({ to, subject, text, html, entityType, entityId }) {
  const results = [];
  for (const r of to) {
    if (mailReady() && r.email) {
      try { await sendMail({ to: r.email, subject, html: html || `<p style="font:14px/1.6 Helvetica,Arial,sans-serif">${text.replace(/\n/g, '<br/>')}</p>`,
        text, template: 'alert', entityType, entityId, actor: 'system' }); results.push(['email', r.name, true]); }
      catch (e) { results.push(['email', r.name, false]); }
    }
    if (smsReady() && r.phone) {
      try { await sendSms({ to: r.phone, body: text.slice(0, 480), template: 'alert', entityType, entityId, actor: 'system' }); results.push(['sms', r.name, true]); }
      catch (e) { results.push(['sms', r.name, false]); }
    }
  }
  return results;
}

// A new inquiry landed. Floor channel always; unclaimed -> every rep; claimed -> that rep.
export async function announceInquiry({ inquiry, collector, payload, offline }) {
  const name = [collector?.first_name || payload?.first_name, collector?.last_name || payload?.last_name].filter(Boolean).join(' ') || payload?.email;
  const about = inquiry?.artwork_title || payload?.artwork_title || payload?.artwork || inquiry?.purpose || payload?.purpose || 'general';
  const kind = inquiry?.kind || 'buying';
  const link = inquiry?.id ? `${APP()}/pipeline?lead=${inquiry.id}` : `${APP()}/today`;
  const line2 = [payload?.budget_range, payload?.timeframe, payload?.source, payload?.city].filter(Boolean).join(' · ');
  const phone = collector?.phone || payload?.phone;
  const email = collector?.email || payload?.email;
  const head = offline
    ? `*NEW INQUIRY, SAVED OFFLINE* · ${about}\n_The database was unreachable. This lead is parked and will land in the pipeline when replayed from Today._`
    : kind === 'buying' ? `*NEW INQUIRY* · ${about}` : `*NEW MESSAGE (${kind})* · ${about}`;
  const text = [head, `${name}${email ? ' · ' + email : ''}${phone ? ' · ' + phone : ''}`, line2,
    payload?.body || payload?.message ? `"${String(payload.body || payload.message).slice(0, 240)}"` : '',
    kind === 'buying' ? `Claim it: ${link}` : link].filter(Boolean).join('\n');
  await slack(text);
  if (kind !== 'buying' || offline) return;
  const who = inquiry?.owner ? await reps(inquiry.owner) : await reps();
  await alertReps({ to: who, subject: `New inquiry: ${name} · ${about}`,
    text: `New inquiry from ${name} about ${about}.${line2 ? ' ' + line2 + '.' : ''}${phone ? ' Call ' + phone + '.' : ''} Claim it: ${link}`,
    entityType: 'inquiry', entityId: inquiry?.id });
}

// Fifteen minutes with nobody claiming it: say it again, louder, to everyone.
export async function escalateInquiry(inquiry) {
  const c = inquiry.collectors || {};
  const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || 'A collector';
  const about = inquiry.artwork_title || inquiry.purpose || 'the gallery';
  const mins = Math.round((Date.now() - new Date(inquiry.created_at).getTime()) / 60000);
  const link = `${APP()}/pipeline?lead=${inquiry.id}`;
  const text = `UNCLAIMED for ${mins} minutes: ${name} asked about ${about}.${c.phone ? ' Call ' + c.phone + '.' : ''} Claim it: ${link}`;
  await slack(`:rotating_light: *${text}*`);
  await alertReps({ to: await reps(), subject: `Unclaimed ${mins} min: ${name} · ${about}`, text, entityType: 'inquiry', entityId: inquiry.id });
  await db.from('inquiries').update({ escalated_at: new Date().toISOString() }).eq('id', inquiry.id);
  await db.from('activities').insert({ entity_type: 'inquiry', entity_id: inquiry.id, kind: 'escalated',
    body: `unclaimed ${mins} min, floor alerted`, actor: 'system' });
}

// Money landed. Floor channel, and the rep who owns the sale.
export async function announcePayment({ invoice, amountCents, closed, owner }) {
  const usd = '$' + Math.round(amountCents / 100).toLocaleString();
  const c = invoice.collectors || {};
  const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || 'a collector';
  const num = String(invoice.invoice_number).padStart(4, '0');
  const text = `${closed ? ':white_check_mark: *PAID IN FULL*' : ':moneybag: *DEPOSIT IN*'} · ${usd} from ${name} on invoice ${num}${invoice.title ? ' · ' + invoice.title : ''}${owner ? ' · ' + owner : ''}`;
  await slack(text);
  if (owner) await alertReps({ to: await reps(owner), subject: `${closed ? 'Paid in full' : 'Deposit in'}: ${usd} from ${name}`,
    text: `${usd} received from ${name} on invoice ${num}${closed ? '. The work is now marked sold.' : '.'}`, entityType: 'invoice', entityId: invoice.id });
}
