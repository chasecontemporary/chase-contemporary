// Getting the rest of the team into the engine.
//
// Only Wyatt has ever signed in. Sara and Bernie are still on the shared access code, which is
// the biggest hole left in the system: the cookie value is the password, it cannot be revoked,
// and it cannot be told apart from a stranger who learned it. Nobody deletes that code until
// all four have a real sign-in, so the invitation has to be one button rather than a trip to
// the Clerk dashboard.
//
// The production secret key lives in Vercel and is deliberately unreadable from a laptop, so
// this is the only place that can do it: server side, with the key the app already runs on.

const API = 'https://api.clerk.com/v1';
export const clerkAdminReady = () => !!process.env.CLERK_SECRET_KEY;

async function clerk(path, method = 'GET', body) {
  const r = await fetch(API + path, {
    method,
    headers: { Authorization: 'Bearer ' + process.env.CLERK_SECRET_KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  if (!r.ok) {
    const msg = json?.errors?.[0]?.long_message || json?.errors?.[0]?.message || text.slice(0, 200);
    throw new Error(msg || `Clerk ${r.status}`);
  }
  return json;
}

// Who has actually signed in, by email, so the Team page can stop guessing.
export async function signedInEmails() {
  if (!clerkAdminReady()) return {};
  try {
    const d = await clerk('/users?limit=100');
    const rows = Array.isArray(d) ? d : (d?.data || []);
    const out = {};
    for (const u of rows) {
      for (const e of (u.email_addresses || [])) {
        out[(e.email_address || '').toLowerCase()] = {
          userId: u.id, lastSignInAt: u.last_sign_in_at || null, createdAt: u.created_at || null,
        };
      }
    }
    return out;
  } catch { return {}; }
}

// Invitations that have gone out and not been accepted yet.
export async function pendingInvitations() {
  if (!clerkAdminReady()) return {};
  try {
    const d = await clerk('/invitations?status=pending&limit=100');
    const rows = Array.isArray(d) ? d : (d?.data || []);
    const out = {};
    rows.forEach(i => { out[(i.email_address || '').toLowerCase()] = { id: i.id, createdAt: i.created_at }; });
    return out;
  } catch { return {}; }
}

/**
 * Invite one person. Clerk emails them a link that creates their account and drops them
 * straight into the engine. `isStaff` still decides what they can do once they are in, so an
 * invitation is not a grant of anything on its own.
 */
export async function inviteToEngine(email, { redirectUrl } = {}) {
  if (!clerkAdminReady()) throw new Error('Sign-in is not configured, so nobody can be invited yet.');
  const addr = String(email || '').trim().toLowerCase();
  if (!addr || !addr.includes('@')) throw new Error('That person has no email address on file to invite.');
  return clerk('/invitations', 'POST', {
    email_address: addr,
    redirect_url: redirectUrl || (process.env.APP_URL || 'https://chase-engine.vercel.app') + '/today',
    notify: true,
    ignore_existing: true,
  });
}

export async function revokeInvitation(invitationId) {
  if (!clerkAdminReady()) throw new Error('Sign-in is not configured.');
  return clerk(`/invitations/${invitationId}/revoke`, 'POST');
}
