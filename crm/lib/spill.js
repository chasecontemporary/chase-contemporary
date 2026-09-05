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
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rand = Math.random().toString(36).slice(2, 8);
    const blob = await put(`${PREFIX}${stamp}-${rand}.json`,
      JSON.stringify({ captured_at: new Date().toISOString(), reason, payload }, null, 2),
      { access: 'public', contentType: 'application/json', addRandomSuffix: false });
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
