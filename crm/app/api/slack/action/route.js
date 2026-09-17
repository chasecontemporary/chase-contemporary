import { db } from '../../../../lib/db';
import { verifySlack } from '../../../../lib/slackVerify';
import { slackUpdate } from '../../../../lib/notify';

// The Claim button on a floor-channel inquiry message posts here. Slack signs the request
// with the app's signing secret; nothing unsigned is acted on.
export const dynamic = 'force-dynamic';

const ephemeral = (text) => Response.json({ response_type: 'ephemeral', replace_original: false, text });

export async function POST(req) {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret) return new Response('Slack signing secret not configured', { status: 503 });
  const body = await req.text();
  const ok = verifySlack({ secret, timestamp: req.headers.get('x-slack-request-timestamp'),
    signature: req.headers.get('x-slack-signature'), body });
  if (!ok) return new Response('bad signature', { status: 401 });

  // Events API handshake, should the app ever subscribe to events.
  if (req.headers.get('content-type')?.includes('application/json')) {
    try { const j = JSON.parse(body); if (j.type === 'url_verification') return Response.json({ challenge: j.challenge }); } catch {}
    return new Response('', { status: 200 });
  }

  let payload;
  try { payload = JSON.parse(new URLSearchParams(body).get('payload') || '{}'); } catch { return new Response('bad payload', { status: 400 }); }
  if (payload.type !== 'block_actions') return new Response('', { status: 200 });
  const act = (payload.actions || []).find(a => a.action_id === 'claim');
  if (!act) return new Response('', { status: 200 });
  const inquiryId = act.value;
  const slackUser = payload.user?.id;

  const member = await resolveMember(slackUser);
  if (!member) return ephemeral('Your Slack account is not linked to a team member yet. Add your Slack ID on the Team page.');

  const { data: inq } = await db.from('inquiries').select('id, owner, artwork_title, purpose').eq('id', inquiryId).single();
  if (!inq) return ephemeral('That inquiry is no longer on the board.');
  if (inq.owner) return ephemeral(`Already claimed by ${inq.owner}.`);

  const { error } = await db.from('inquiries').update({ owner: member.name }).eq('id', inquiryId).is('owner', null);
  if (error) return ephemeral('That did not save. Claim it from the pipeline instead.');
  await db.from('activities').insert({ entity_type: 'inquiry', entity_id: inquiryId, kind: 'assigned',
    body: 'claimed from Slack', actor: member.name });

  // Rewrite the original message: keep the text, drop the button, add the claim line.
  const ts = payload.message?.ts || payload.container?.message_ts;
  const channel = payload.channel?.id || payload.container?.channel_id;
  if (ts && channel) {
    const text = (payload.message?.text || '') + `\n:white_check_mark: Claimed by ${member.name}`;
    const blocks = (payload.message?.blocks || []).filter(b => b.type !== 'actions')
      .concat([{ type: 'context', elements: [{ type: 'mrkdwn', text: `:white_check_mark: Claimed by *${member.name}*` }] }]);
    await slackUpdate(ts, text, blocks, channel);
  }
  return new Response('', { status: 200 });
}

// Slack user -> team member. By stored id first, then by the email on their Slack profile
// (needs users:read and users:read.email), remembered for next time.
async function resolveMember(slackUser) {
  if (!slackUser) return null;
  const { data: byId } = await db.from('team_members').select('id, name, email').eq('slack_user_id', slackUser).eq('active', true).limit(1);
  if (byId?.[0]) return byId[0];
  if (!process.env.SLACK_BOT_TOKEN) return null;
  try {
    const r = await fetch('https://slack.com/api/users.info?user=' + encodeURIComponent(slackUser),
      { headers: { Authorization: 'Bearer ' + process.env.SLACK_BOT_TOKEN } });
    const j = await r.json();
    const email = j?.user?.profile?.email?.toLowerCase();
    if (!email) return null;
    const { data: byEmail } = await db.from('team_members').select('id, name, email').ilike('email', email).eq('active', true).limit(1);
    if (!byEmail?.[0]) return null;
    await db.from('team_members').update({ slack_user_id: slackUser }).eq('id', byEmail[0].id);
    return byEmail[0];
  } catch { return null; }
}
