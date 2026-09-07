import { cookies } from 'next/headers';
import { db } from './db';

// Who is using the engine right now.
//
// One place decides this, so the rest of the app never has to care how someone signed in.
// With Clerk configured, identity is VERIFIED — it comes from a signed-in session tied to
// a real mailbox, which is what makes the audit trail ("Sara logged this call") mean
// anything and what lets us show one rep their own pay and not everyone else's.
//
// Without Clerk it falls back to the old self-selected name. That fallback is deliberately
// untrusted: `verified` is false, so anything sensitive stays shut. It exists only so the
// team is never locked out of a live system mid-migration, and should be removed once
// everyone has signed in with Clerk at least once.

export const clerkReady = () =>
  !!process.env.CLERK_SECRET_KEY && !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

const teamFor = async (match) => {
  const { data } = await db.from('team_members').select('name, email, role, active');
  const rows = (data || []).filter(t => t.active);
  return rows.find(match) || null;
};

export async function whoami() {
  if (clerkReady()) {
    try {
      const { auth, currentUser } = await import('@clerk/nextjs/server');
      const { userId } = await auth();
      if (userId) {
        const u = await currentUser();
        const email = (u?.primaryEmailAddress?.emailAddress || '').toLowerCase();
        const member = await teamFor(t => (t.email || '').toLowerCase() === email);
        return {
          email,
          name: member?.name || u?.firstName || email,
          role: member?.role || null,       // no team row = signed in but not staff
          verified: true,
          onTeam: !!member,
        };
      }
    } catch { /* fall through to the legacy path rather than lock anyone out */ }
  }

  const jar = await cookies();
  const picked = decodeURIComponent(jar.get('cc_rep')?.value || '');
  if (!picked) return { email: null, name: null, role: null, verified: false, onTeam: false };
  const member = await teamFor(t => t.name === picked);
  return {
    email: member?.email || null,
    name: member?.name || picked,
    role: member?.role || null,
    verified: false,                       // self-selected: never trusted for anything private
    onTeam: !!member,
  };
}

// Signing in is not the same as being allowed in. Clerk will happily create an account
// for anyone who reaches the sign-in page; only people on the gallery's team may use the
// engine. Enforced in code so a dashboard setting can never be the only thing standing
// between a stranger and 27,000 collector records.
export async function isStaff() {
  if (!clerkReady()) return true;                 // pre-Clerk: the shared code is the gate
  const me = await whoami();
  if (!me.verified) return true;                  // transition fallback, still shared-code gated
  return me.onTeam;
}

// The name stamped on notes, calls and invoices. Null when we genuinely don't know, so the
// record says "unattributed" instead of inventing an actor.
export async function actorName() {
  const me = await whoami();
  return me.name || null;
}
