import { put, list, del } from '@vercel/blob';

// The safety net under inquiry capture.
//
// If the database is unreachable — paused, throttled, mid-outage — an inquiry from the
// live site must still not be lost. We write the raw payload to Blob storage, which is a
// separate service with a separate failure domain, and replay it into the database once
// it is back. Blob is also what the invoice PDFs live in, so it is already proven.
//
// Nothing here ever throws: a failure in the safety net must not turn into a failure of
// the thing it is protecting.

const PREFIX = 'spill/inquiry/';

export async function spillInquiry(payload, reason) {
  try {
    // These files hold a real person's name, email, phone and message, and blob URLs are
    // readable by anyone who has them. Name them with cryptographic randomness and let the
    // store append its own secure suffix too — never Math.random() for anything guarding PII.
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rand = crypto.randomUUID().replace(/-/g, '');
    const blob = await put(`${PREFIX}${stamp}-${rand}.json`,
      JSON.stringify({ captured_at: new Date().toISOString(), reason, payload }, null, 2),
      { access: 'public', contentType: 'application/json', addRandomSuffix: true });
    return blob.url;
  } catch {
    return null;                        // last resort — the caller still returns 200
  }
}

export async function listSpill() {
  try {
    const { blobs } = await list({ prefix: PREFIX, limit: 1000 });
    return blobs || [];
  } catch {
    return [];
  }
}

export async function readSpill(url) {
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

// Read every parked inquiry, newest last. Used to show real, callable leads on screen
// during an outage — captured is not the same as usable.
export async function readAllSpill() {
  const blobs = await listSpill();
  const out = [];
  for (const b of blobs.sort((a, z) => a.pathname.localeCompare(z.pathname))) {
    const rec = await readSpill(b.url);
    if (rec?.payload) out.push({ at: rec.captured_at, p: rec.payload });
  }
  return out;
}

export async function dropSpill(url) {
  try { await del(url); return true; } catch { return false; }
}

// Is the database actually answering? Used by the health endpoint and by the CRM so it
// can shout instead of rendering a reassuring empty page.
export async function dbReachable(db, ms = 4000) {
  try {
    const probe = db.from('team_members').select('name').limit(1);
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms));
    const { error } = await Promise.race([probe, timeout]);
    return !error;
  } catch {
    return false;
  }
}
