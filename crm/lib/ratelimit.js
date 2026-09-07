import { db } from './db';

// Throttling for the endpoints anyone on the internet can reach.
//
// Two rules shape this:
//  1. It must never block real business. A collector filling in a form, or the live site
//     posting page views, has to get through — so limits are generous and a failure of the
//     limiter itself lets the request proceed rather than dropping a lead.
//  2. It must actually stop a script. Counting happens in Postgres, not memory, because
//     serverless instances are ephemeral and per-instance counters reset constantly.

export const clientIp = (req) =>
  (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
  req.headers.get('x-real-ip') || 'unknown';

/**
 * @returns {Promise<{ok: boolean, hits: number}>} ok=false means the caller is over.
 */
export async function rateLimit(req, name, limit, windowSeconds) {
  const bucket = `${name}:${clientIp(req)}`;
  try {
    const { data, error } = await db.rpc('bump_rate_limit', {
      p_bucket: bucket, p_window_seconds: windowSeconds,
    });
    if (error) return { ok: true, hits: 0 };     // limiter down: never block real traffic
    const hits = Number(data) || 0;
    return { ok: hits <= limit, hits };
  } catch {
    return { ok: true, hits: 0 };
  }
}

// A plain, honest refusal. No detail about the limit — that only helps someone tuning
// their script — and Retry-After so a legitimate client knows to wait.
export const tooMany = (seconds = 60, cors = {}) =>
  new Response(JSON.stringify({ error: 'Too many requests. Please wait a moment.' }), {
    status: 429,
    headers: { 'Content-Type': 'application/json', 'Retry-After': String(seconds), ...cors },
  });
