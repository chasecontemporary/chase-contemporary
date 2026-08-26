// Branded email renderer — the website's design language translated to email-safe HTML.
// Optic white, black, caps with tracking, wall-label captions, INQUIRE buttons.
// Placeholders resolved at send time by the provider layer: {{first_name}}, {{unsubscribe}}, {{mailing_address}}
const SITE = 'https://www.chasecontemporary.com';
const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const usd = (c) => '$' + Math.round((c || 0) / 100).toLocaleString();

export function renderCampaignEmail({ campaign, artworks = [] }) {
  const artBlocks = artworks.map(a => {
    const url = a.handle ? `${SITE}/products/${a.handle}` : SITE;
    const img = a.image_url ? a.image_url + (a.image_url.includes('?') ? '&' : '?') + 'width=1200' : null;
    return `
    <tr><td style="padding:34px 0 0">
      ${img ? `<a href="${url}" style="text-decoration:none"><img src="${esc(img)}" width="600" alt="${esc(a.title)}" style="width:100%;max-width:600px;display:block;border:0"/></a>` : ''}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:14px 0 0">
        <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#000">${esc(a.artist || '')}</div>
        <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;font-style:italic;color:#000;padding-top:3px">${esc(a.title)}</div>
        <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:.04em;color:#000;padding-top:3px">${(a.price_cents || 0) > 0 ? usd(a.price_cents) : 'PRICE ON REQUEST'}</div>
      </td><td align="right" style="vertical-align:bottom">
        <a href="${url}" style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:10.5px;font-weight:600;letter-spacing:.1em;color:#ffffff;background:#000000;text-decoration:none;padding:10px 22px;display:inline-block">INQUIRE</a>
      </td></tr></table>
    </td></tr>`;
  }).join('');

  const paragraphs = String(campaign.body || '').split(/\n\n+/).filter(Boolean).map(p =>
    `<p style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13.5px;line-height:1.75;color:#000;margin:0 0 16px">${esc(p).replace(/\n/g, '<br/>')}</p>`).join('');

  return `<!doctype html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/>
<title>${esc(campaign.subject || campaign.name)}</title></head>
<body style="margin:0;padding:0;background:#ffffff">
<div style="display:none;max-height:0;overflow:hidden">${esc(campaign.preheader || '')}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff">
<tr><td align="center" style="padding:44px 20px 60px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%">
  <tr><td align="center" style="padding:0 0 38px">
    <a href="${SITE}" style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;letter-spacing:.22em;color:#000;text-decoration:none">CHASE&nbsp;CONTEMPORARY</a>
  </td></tr>
  ${campaign.kind === 'drop' ? `<tr><td align="center" style="padding:0 0 26px">
    <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:10.5px;font-weight:600;letter-spacing:.16em;color:#000;border:1px solid #000;display:inline-block;padding:7px 16px">NEW&nbsp;RELEASE</div>
  </td></tr>` : ''}
  <tr><td style="padding:0 0 6px">
    <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:20px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#000">${esc(campaign.subject || campaign.name)}</div>
  </td></tr>
  <tr><td style="padding:12px 0 0">${paragraphs}</td></tr>
  ${artBlocks}
  <tr><td align="center" style="padding:48px 0 0">
    <a href="${SITE}" style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:10.5px;font-weight:600;letter-spacing:.12em;color:#000;text-decoration:none;border-bottom:1px solid #000;padding-bottom:2px">VIEW THE COLLECTION</a>
  </td></tr>
  <tr><td align="center" style="padding:56px 0 0">
    <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;font-weight:600;letter-spacing:.2em;color:#000">CHASE&nbsp;CONTEMPORARY</div>
    <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:.04em;color:#86868b;padding-top:10px">{{mailing_address}}</div>
    <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:.04em;color:#86868b;padding-top:6px"><a href="{{unsubscribe}}" style="color:#86868b">Unsubscribe</a></div>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}
