import { isStaff } from '../../../lib/identity';
import { buildContext } from '../../../lib/emailContext';
import { renderTemplate, templateList } from '../../../lib/templates';
import { mailReady } from '../../../lib/mail';
import { smsReady } from '../../../lib/sms';

// Preview a collector email before it goes: the composer calls this as the rep switches
// templates, then posts action=email_send to /api/act. GET only, staff only.
export async function GET(req) {
  if (!(await isStaff())) return new Response('forbidden', { status: 403 });
  const u = new URL(req.url);
  const key = u.searchParams.get('template') || 'first_reply';
  const inquiryId = u.searchParams.get('inquiry_id');
  const collectorId = u.searchParams.get('collector_id');
  const invoiceId = u.searchParams.get('invoice_id');
  const note = u.searchParams.get('note') || '';
  const ctx = await buildContext({ inquiryId, collectorId, invoiceId, note });
  const out = renderTemplate(key, ctx);
  return Response.json({ ...out, templates: templateList(), ready: mailReady(), sms: smsReady() && !!ctx.collector?.phone,
    to: ctx.collector?.email && !ctx.collector.email.endsWith('import.chasecontemporary.com') ? ctx.collector.email : null,
    phone: ctx.collector?.phone || null, collector_id: ctx.collector?.id || null, links: ctx.links });
}
