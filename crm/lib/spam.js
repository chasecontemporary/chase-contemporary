// Bot submissions reach the engine through the site's own form bridge, before Shopify's
// captcha has had a say. Three bursts of six in one week put eighteen fake leads on the
// board and had the morning digest shouting "22 unclaimed" at the floor.
//
// Nothing here ever blocks a person. A score over the line only QUARANTINES the
// submission: it is parked in spam_submissions (never in the book, never on the board,
// never announced) where Today lists it with a one-click "Not spam" that replays it as a
// real inquiry. The bot still gets a 200 so it learns nothing.
//
// Signals, each with a reason string so a rep can see why:
//   honeypot        a hidden field only a script would fill                    +10
//   gibberish name  three or more lower-to-upper case flips inside one word     +3
//   dotted gmail    three or more dots in a gmail local part (the dot trick)    +3
//   no vowels       a long name or city with almost no vowels                   +2 / +1
//   too fast        under three seconds on the page                             +1
// Line: 4. A single weak signal never quarantines; a Polish surname is safe.

const flips = (w) => {
  let n = 0;
  for (let i = 1; i < w.length; i++) if (/[a-z]/.test(w[i - 1]) && /[A-Z]/.test(w[i])) n++;
  return n;
};
const vowelRatio = (w) => {
  const letters = w.replace(/[^a-z]/gi, '');
  if (!letters) return 1;
  return (letters.match(/[aeiouy]/gi) || []).length / letters.length;
};

export function spamScore(p = {}) {
  const reasons = [];
  let score = 0;
  const hp = String(p.website || p.hp || p.fax || '').trim();
  if (hp) { score += 10; reasons.push('hidden field filled'); }

  const first = String(p.first_name || '').trim();
  const last = String(p.last_name || '').trim();
  const city = String(p.city || '').trim();
  for (const [label, v] of [['first name', first], ['last name', last]]) {
    if (!v) continue;
    const words = v.split(/\s+/);
    if (words.some(w => flips(w) >= 3)) { score += 3; reasons.push(`${label} reads as random letters`); }
    if (v.length >= 8 && vowelRatio(v) < 0.2) { score += 2; reasons.push(`${label} has almost no vowels`); }
  }
  if (city && city.length >= 7 && vowelRatio(city) < 0.2) { score += 1; reasons.push('city has almost no vowels'); }

  const email = String(p.email || '').trim().toLowerCase();
  const m = email.match(/^([^@]+)@(gmail|googlemail)\.com$/);
  if (m && (m[1].match(/\./g) || []).length >= 3) { score += 3; reasons.push('gmail address with the dot trick'); }

  const secs = Number(p.seconds_on_page);
  if (Number.isFinite(secs) && secs >= 0 && secs < 3) { score += 1; reasons.push('submitted in under three seconds'); }

  return { score, reasons, spam: score >= 4 };
}
