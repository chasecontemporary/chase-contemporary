// Collector-facing email templates in the gallery's register: optic white, black, tracked
// caps, wall-label captions. Plain enough to read as a personal note from a salesperson,
// not a campaign. Every template returns { subject, html, text } and takes the same
// context so the composer can preview any of them.
//
// No em dashes anywhere. Commas, colons, periods.

const SITE = 'https://www.chasecontemporary.com';
const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const usd = (c) => '$' + Math.round((c || 0) / 100).toLocaleString();
const F = "'Helvetica Neue',Helvetica,Arial,sans-serif";
const P = (s) => `<p style="font-family:${F};font-size:14px;line-height:1.75;color:#000;margin:0 0 16px">${s}</p>`;

const shell = (inner, { signature } = {}) => `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;background:#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff"><tr><td align="center" style="padding:40px 20px 56px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:100%">
  <tr><td style="padding:0 0 34px"><a href="${SITE}" style="font-family:${F};font-size:13px;font-weight:600;letter-spacing:.22em;color:#000;text-decoration:none">CHASE&nbsp;CONTEMPORARY</a></td></tr>
  <tr><td>${inner}</td></tr>
  <tr><td style="padding:28px 0 0">${signature || ''}</td></tr>
  <tr><td style="padding:44px 0 0;border-top:1px solid #e3e3dd;margin-top:40px">
    <div style="font-family:${F};font-size:10px;letter-spacing:.06em;color:#86868b;padding-top:14px">CHASE CONTEMPORARY · info@chasecontemporary.com · chasecontemporary.com</div>
  </td></tr>
</table></td></tr></table></body></html>`;

const signatureFor = (rep) => `<div style="font-family:${F};font-size:14px;line-height:1.7;color:#000">Warm regards,<br/>${esc(rep?.name || 'Chase Contemporary')}${rep?.name ? '<br/><span style="color:#3a3a35">Chase Contemporary</span>' : ''}${rep?.phone ? '<br/><span style="color:#3a3a35">' + esc(rep.phone) + '</span>' : ''}</div>`;

const workBlock = (a, priceLine) => a ? `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 22px"><tr><td>
  ${a.image_url ? `<img src="${esc(a.image_url + (a.image_url.includes('?') ? '&' : '?') + 'width=1120')}" width="560" alt="${esc(a.title)}" style="width:100%;max-width:560px;display:block;border:0"/>` : ''}
  <div style="font-family:${F};font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#000;padding-top:12px">${esc(a.artist || '')}</div>
  <div style="font-family:${F};font-size:13px;font-style:italic;color:#000;padding-top:3px">${esc(a.title || '')}</div>
  <div style="font-family:${F};font-size:11.5px;color:#3a3a35;padding-top:3px">${esc([a.medium, a.dims_h_in ? `${a.dims_h_in} × ${a.dims_w_in} in` : null, a.edition ? 'Edition ' + a.edition : null].filter(Boolean).join(' · '))}</div>
  ${priceLine ? `<div style="font-family:${F};font-size:12px;font-weight:600;letter-spacing:.04em;color:#000;padding-top:6px">${esc(priceLine)}</div>` : ''}
</td></tr></table>` : '';

const button = (href, label) => `<a href="${esc(href)}" style="font-family:${F};font-size:11px;font-weight:600;letter-spacing:.12em;color:#ffffff;background:#000000;text-decoration:none;padding:13px 26px;display:inline-block">${esc(label)}</a>`;
const link = (href, label) => `<a href="${esc(href)}" style="font-family:${F};font-size:12px;font-weight:600;letter-spacing:.08em;color:#000;text-decoration:none;border-bottom:1px solid #000;padding-bottom:2px">${esc(label)}</a>`;

/**
 * ctx: { collector, artwork, rep, inquiry, invoice, links: { tearsheet, selection, details, pay, pdf }, price, note }
 */
export const TEMPLATES = {
  first_reply: {
    label: 'First reply · availability and price',
    needs: ['artwork'],
    build: (x) => {
      const first = x.collector?.first_name || 'there';
      const a = x.artwork;
      const priced = a && a.price_cents > 0;
      const priceLine = a ? (priced ? usd(a.price_cents) : 'Price on request') : '';
      const avail = a ? (a.available === false ? 'has just been placed, and I would love to show you what else we have by ' + (a.artist || 'the artist') : 'is available') : '';
      const body = [
        P(`Dear ${esc(first)},`),
        P(`Thank you for your inquiry. <i>${esc(a?.title || 'The work')}</i>${a?.artist ? ' by ' + esc(a.artist) : ''} ${esc(avail)}${priced ? ', at ' + usd(a.price_cents) + '.' : '.'}${x.note ? ' ' + esc(x.note) : ''}`),
        workBlock(a, priceLine),
        x.links?.tearsheet ? P(`The tear sheet with full details is ${link(x.links.tearsheet, 'HERE')}.`) : '',
        x.links?.selection ? P(`I have also put together ${link(x.links.selection, 'A PRIVATE SELECTION')} of works I think you would respond to.`) : '',
        P(`I am happy to answer anything at all, arrange a video walkthrough, or hold the work for a few days while you decide. A quick call is easiest: ${esc(x.rep?.phone || 'reply to this email')}.`),
      ].join('');
      return { subject: `${a?.title ? a.title + (a.artist ? ' by ' + a.artist : '') : 'Your inquiry'}, from Chase Contemporary`,
        html: shell(body, { signature: signatureFor(x.rep) }),
        text: `Dear ${first},\n\nThank you for your inquiry. ${a?.title || 'The work'}${a?.artist ? ' by ' + a.artist : ''} ${avail}${priced ? ', at ' + usd(a.price_cents) : ''}.${x.links?.tearsheet ? '\n\nTear sheet: ' + x.links.tearsheet : ''}${x.links?.selection ? '\nPrivate selection: ' + x.links.selection : ''}\n\nHappy to answer anything, arrange a video walkthrough, or hold the work while you decide.\n\nWarm regards,\n${x.rep?.name || 'Chase Contemporary'}` };
    },
  },
  selection: {
    label: 'Private selection link',
    needs: ['selection'],
    build: (x) => {
      const first = x.collector?.first_name || 'there';
      const body = [
        P(`Dear ${esc(first)},`),
        P(`I put together a small private selection for you${x.note ? ': ' + esc(x.note) : '.'}`),
        `<div style="padding:6px 0 22px">${button(x.links.selection, 'VIEW THE SELECTION')}</div>`,
        P(`Each work shows its price and details. Tap "I'm interested" on anything and I will follow up the same day. The page stays open for two weeks.`),
      ].join('');
      return { subject: `A private selection for ${first}, from Chase Contemporary`, html: shell(body, { signature: signatureFor(x.rep) }),
        text: `Dear ${first},\n\nI put together a small private selection for you: ${x.links.selection}\n\nTap "I'm interested" on anything and I will follow up the same day.\n\nWarm regards,\n${x.rep?.name || 'Chase Contemporary'}` };
    },
  },
  details_link: {
    label: 'Details link · billing and delivery',
    needs: ['details'],
    build: (x) => {
      const first = x.collector?.first_name || 'there';
      const body = [
        P(`Dear ${esc(first)},`),
        P(`To prepare your invoice${x.artwork?.title ? ' for <i>' + esc(x.artwork.title) + '</i>' : ''} and arrange delivery, please confirm your billing and delivery details on this secure page. It takes under a minute.`),
        `<div style="padding:6px 0 22px">${button(x.links.details, 'CONFIRM DETAILS')}</div>`,
        P(`Your information is used only to prepare the invoice and delivery. It is never shared.`),
      ].join('');
      return { subject: 'Your acquisition details, Chase Contemporary', html: shell(body, { signature: signatureFor(x.rep) }),
        text: `Dear ${first},\n\nTo prepare your invoice and arrange delivery, please confirm your details here: ${x.links.details}\n\nWarm regards,\n${x.rep?.name || 'Chase Contemporary'}` };
    },
  },
  invoice: {
    label: 'Invoice · with PDF attached',
    needs: ['invoice'],
    build: (x) => {
      const first = x.collector?.first_name || 'there';
      const inv = x.invoice;
      const num = String(inv.invoice_number).padStart(4, '0');
      const total = inv.amount_cents + (inv.tax_cents || 0) + (inv.shipping_cents || 0);
      const dep = inv.deposit_cents > 0 ? inv.deposit_cents : null;
      const due = inv.due_at ? new Date(inv.due_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : null;
      const body = [
        P(`Dear ${esc(first)},`),
        P(`Thank you. Invoice No. ${num} for <i>${esc(inv.title || 'your acquisition')}</i>${inv.artist ? ' by ' + esc(inv.artist) : ''} is attached, with everything needed for the acquisition.`),
        workBlock(x.artwork, null),
        P(`<b>Total ${usd(total)}</b>${dep ? `, with a deposit of ${usd(dep)} to reserve the work` : ''}${due ? `, due ${esc(due)}` : ''}. ${x.links?.pay ? `You can pay by card or bank ${link(x.links.pay, 'HERE')}, or by wire using the details on the invoice.` : 'Wire details are on the invoice; please reference the invoice number with your payment.'}`),
        P(`Once payment is received, the certificate of authenticity is prepared and we arrange delivery with you. I am here for anything at all.`),
      ].join('');
      return { subject: `Invoice No. ${num}, Chase Contemporary`, html: shell(body, { signature: signatureFor(x.rep) }),
        text: `Dear ${first},\n\nInvoice No. ${num} for ${inv.title || 'your acquisition'} is attached. Total ${usd(total)}${dep ? ', deposit ' + usd(dep) : ''}${due ? ', due ' + due : ''}.${x.links?.pay ? '\nPay online: ' + x.links.pay : ''}\n\nWarm regards,\n${x.rep?.name || 'Chase Contemporary'}` };
    },
  },
  receipt: {
    label: 'Payment received',
    needs: ['invoice'],
    build: (x) => {
      const first = x.collector?.first_name || 'there';
      const inv = x.invoice;
      const num = String(inv.invoice_number).padStart(4, '0');
      const body = [
        P(`Dear ${esc(first)},`),
        P(`We have received your payment of <b>${usd(x.amountCents)}</b> on Invoice No. ${num}${x.closed ? ', which settles it in full. Thank you.' : '. Thank you.'}`),
        x.closed ? P(`<i>${esc(inv.title || 'The work')}</i> is now yours. The certificate of authenticity is being prepared and we will be in touch shortly about delivery.`) : P(`The remaining balance is ${usd(x.balanceCents)}. The invoice with wire details is attached for reference.`),
      ].join('');
      return { subject: `${x.closed ? 'Payment received, thank you' : 'Deposit received'}, Invoice No. ${num}`, html: shell(body, { signature: signatureFor(x.rep) }),
        text: `Dear ${first},\n\nWe have received your payment of ${usd(x.amountCents)} on Invoice No. ${num}${x.closed ? ', which settles it in full.' : '. Remaining balance ' + usd(x.balanceCents) + '.'}\n\nThank you.\n${x.rep?.name || 'Chase Contemporary'}` };
    },
  },
  follow_up: {
    label: 'Follow-up · checking in',
    needs: [],
    build: (x) => {
      const first = x.collector?.first_name || 'there';
      const a = x.artwork;
      const body = [
        P(`Dear ${esc(first)},`),
        P(`Checking in on <i>${esc(a?.title || 'the work you asked about')}</i>${a?.artist ? ' by ' + esc(a.artist) : ''}.${x.note ? ' ' + esc(x.note) : ' It is still available, and I am glad to hold it for a few days if that helps.'}`),
        workBlock(a, a && a.price_cents > 0 ? usd(a.price_cents) : ''),
        P(`No pressure at all. If it is not the right piece, tell me what you are drawn to and I will send a few alternatives.`),
      ].join('');
      return { subject: `${a?.title || 'Following up'}, Chase Contemporary`, html: shell(body, { signature: signatureFor(x.rep) }),
        text: `Dear ${first},\n\nChecking in on ${a?.title || 'the work you asked about'}.${x.note ? ' ' + x.note : ' It is still available and I am glad to hold it for a few days.'}\n\nWarm regards,\n${x.rep?.name || 'Chase Contemporary'}` };
    },
  },
  hold_confirmed: {
    label: 'Hold confirmed',
    needs: ['artwork'],
    build: (x) => {
      const first = x.collector?.first_name || 'there';
      const a = x.artwork;
      const until = x.until ? new Date(x.until).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : 'the end of the week';
      const body = [
        P(`Dear ${esc(first)},`),
        P(`As discussed, <i>${esc(a?.title || 'the work')}</i>${a?.artist ? ' by ' + esc(a.artist) : ''} is on hold for you until ${esc(until)}. Nobody else can acquire it in that time.`),
        workBlock(a, a && a.price_cents > 0 ? usd(a.price_cents) : ''),
        P(`Whenever you are ready, I will send the invoice and we arrange delivery. If the timing changes, just tell me.`),
      ].join('');
      return { subject: `${a?.title || 'Your hold'} is on hold for you`, html: shell(body, { signature: signatureFor(x.rep) }),
        text: `Dear ${first},\n\n${a?.title || 'The work'} is on hold for you until ${until}.\n\nWarm regards,\n${x.rep?.name || 'Chase Contemporary'}` };
    },
  },
};

export const templateList = () => Object.entries(TEMPLATES).map(([k, t]) => ({ key: k, label: t.label, needs: t.needs }));
export const renderTemplate = (key, ctx) => {
  const t = TEMPLATES[key];
  if (!t) throw new Error('Unknown template');
  return t.build(ctx);
};
