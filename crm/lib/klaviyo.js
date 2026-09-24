// Klaviyo delivery layer. Env-gated: KLAVIYO_API_KEY activates everything.
// The engine owns WHO (audiences) and WHAT (drop composition); Klaviyo owns delivery.
const REV = '2024-10-15';
export const klaviyoReady = () => !!process.env.KLAVIYO_API_KEY;

async function kv(path, method = 'GET', body) {
  const res = await fetch('https://a.klaviyo.com/api' + path, {
    method,
    headers: { Authorization: 'Klaviyo-API-Key ' + process.env.KLAVIYO_API_KEY,
      revision: REV, 'Content-Type': 'application/vnd.api+json', accept: 'application/vnd.api+json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Klaviyo ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.status === 204 ? null : res.json();
}

// Ensure a Klaviyo List exists for an engine audience; returns list id.
export async function ensureList(audience) {
  if (audience.klaviyo_list_id) return audience.klaviyo_list_id;
  const r = await kv('/lists/', 'POST', { data: { type: 'list',
    attributes: { name: 'CHASE · ' + audience.name } } });
  return r.data.id;
}

// Push audience members (profiles) into the list via bulk import.
export async function syncMembers(listId, members) {
  // members: [{email, first_name, last_name, city}]
  const chunks = [];
  for (let i = 0; i < members.length; i += 500) chunks.push(members.slice(i, i + 500));
  for (const chunk of chunks) {
    await kv('/profile-bulk-import-jobs/', 'POST', { data: { type: 'profile-bulk-import-job',
      attributes: { profiles: { data: chunk.map(m => ({ type: 'profile', attributes: {
        email: m.email, first_name: m.first_name || undefined, last_name: m.last_name || undefined,
        location: m.city ? { city: m.city } : undefined,
        // These people opted in to the gallery's newsletter, and Artcloud carried that record
        // into the book. Without saying so, Klaviyo treats an imported profile as never
        // subscribed, which hurts deliverability and makes every send look unsolicited.
        ...(m.newsletter ? { subscriptions: { email: { marketing: { consent: 'SUBSCRIBED' } } } } : {}),
      } })) } },
      relationships: { lists: { data: [{ type: 'list', id: listId }] } } } });
  }
  return members.length;
}

// Create a template + campaign in Klaviyo carrying the engine's brand-true HTML.
export async function pushCampaign(campaign, html, listId) {
  const t = await kv('/templates/', 'POST', { data: { type: 'template', attributes: {
    name: 'CHASE · ' + campaign.name, editor_type: 'CODE', html } } });
  // A campaign is created as a draft either way, and only sends when a person presses Send or
  // Schedule inside Klaviyo, which is the rule: the engine drafts, a human pulls the trigger.
  // Klaviyo still requires a send strategy on creation, so the default is a static time
  // tomorrow at 10:00 New York, which is what a drop usually wants and can be changed there.
  const tomorrow10ET = (() => {
    const d = new Date(); d.setUTCDate(d.getUTCDate() + 1);
    const ymd = d.toISOString().slice(0, 10);
    const offsetHours = new Date(`${ymd}T12:00:00Z`).toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false });
    const utcHour = 10 + (12 - Number(offsetHours));           // 10:00 ET expressed in UTC
    return `${ymd}T${String(utcHour).padStart(2, '0')}:00:00Z`;
  })();
  const utmName = String(campaign.name || 'drop').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  const c = await kv('/campaigns/', 'POST', { data: { type: 'campaign', attributes: {
    name: 'CHASE · ' + campaign.name,
    audiences: { included: [listId] },
    send_strategy: { method: 'static', options_static: { datetime: tomorrow10ET, is_local: false, send_past_recipients_immediately: false } },
    // every INQUIRE in the email carries these, so each send reads out inquiries, conversations,
    // invoices and paid in the pipeline, which is the whole point of doing drops from the engine
    tracking_options: { is_add_utm: true, utm_params: [
      { name: 'utm_source', value: 'klaviyo' }, { name: 'utm_medium', value: 'email' },
      { name: 'utm_campaign', value: utmName } ] },
    'campaign-messages': { data: [{ type: 'campaign-message', attributes: {
      definition: { channel: 'email', label: campaign.name, content: {
        subject: campaign.subject, preview_text: campaign.preheader || '',
        from_email: 'info@chasecontemporary.com', from_label: 'Chase Contemporary' } } } }] },
  } } });
  const msgId = c?.data?.relationships?.['campaign-messages']?.data?.[0]?.id;
  if (msgId && t?.data?.id) {
    await kv(`/campaign-message-assign-template/`, 'POST', { data: { type: 'campaign-message',
      id: msgId, relationships: { template: { data: { type: 'template', id: t.data.id } } } } });
  }
  return c?.data?.id || null;
}
