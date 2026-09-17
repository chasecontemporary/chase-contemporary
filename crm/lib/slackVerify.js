import crypto from 'crypto';

// Slack signs every request: v0=HMAC_SHA256(secret, "v0:<timestamp>:<body>"). Replays older
// than five minutes are refused. Timing-safe compare so the signature cannot be guessed.
export function verifySlack({ secret, timestamp, signature, body, now = Date.now() }) {
  if (!secret || !timestamp || !signature || typeof body !== 'string') return false;
  const ts = parseInt(timestamp, 10);
  if (!Number.isFinite(ts) || Math.abs(now / 1000 - ts) > 300) return false;
  const expected = 'v0=' + crypto.createHmac('sha256', secret).update(`v0:${timestamp}:${body}`).digest('hex');
  const a = Buffer.from(expected), b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
