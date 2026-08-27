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
        location: m.city ? { city: m.city } : undefined } })) } },
      relationships: { lists: { data: [{ type: 'list', id: listId }] } } } });
  }
  return members.length;
}

// Create a template + campaign in Klaviyo carrying the engine's brand-true HTML.
export async function pushCampaign(campaign, html, listId) {
  const t = await kv('/templates/', 'POST', { data: { type: 'template', attributes: {
    name: 'CHASE · ' + campaign.name, editor_type: 'CODE', html } } });
  const c = await kv('/campaigns/', 'POST', { data: { type: 'campaign', attributes: {
    name: 'CHASE · ' + campaign.name,
    audiences: { included: [listId] },
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
