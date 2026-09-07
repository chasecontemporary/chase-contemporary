// Sales tax suggestion for the invoice.
//
// The gallery collects tax where it has nexus (TAX_NEXUS_STATES, e.g. "NY,FL"), at the
// ship-to address. This is a suggestion the rep confirms, not a filing engine: state base
// rates below, plus an optional per-state override for a combined local rate
// (TAX_RATE_OVERRIDES='NY:8.875,FL:7'). If TAXJAR_API_KEY is set, the exact rate for the
// ship-to zip is fetched from TaxJar instead.

const STATE_BASE = {
  AL: 4, AK: 0, AZ: 5.6, AR: 6.5, CA: 7.25, CO: 2.9, CT: 6.35, DE: 0, DC: 6, FL: 6, GA: 4, HI: 4,
  ID: 6, IL: 6.25, IN: 7, IA: 6, KS: 6.5, KY: 6, LA: 4.45, ME: 5.5, MD: 6, MA: 6.25, MI: 6, MN: 6.875,
  MS: 7, MO: 4.225, MT: 0, NE: 5.5, NV: 6.85, NH: 0, NJ: 6.625, NM: 4.875, NY: 4, NC: 4.75, ND: 5,
  OH: 5.75, OK: 4.5, OR: 0, PA: 6, RI: 7, SC: 6, SD: 4.2, TN: 7, TX: 6.25, UT: 6.1, VT: 6, VA: 5.3,
  WA: 6.5, WV: 6, WI: 5, WY: 4,
};
const NAMES = { 'new york': 'NY', california: 'CA', florida: 'FL', texas: 'TX', 'new jersey': 'NJ',
  connecticut: 'CT', massachusetts: 'MA', illinois: 'IL', colorado: 'CO', washington: 'WA', nevada: 'NV',
  arizona: 'AZ', georgia: 'GA', pennsylvania: 'PA', 'district of columbia': 'DC' };

export const normState = (s) => {
  const t = String(s || '').trim();
  if (!t) return null;
  if (/^[A-Za-z]{2}$/.test(t)) return t.toUpperCase();
  return NAMES[t.toLowerCase()] || null;
};

export const nexusStates = () =>
  (process.env.TAX_NEXUS_STATES || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);

const overrides = () => {
  const out = {};
  (process.env.TAX_RATE_OVERRIDES || '').split(',').forEach(pair => {
    const [k, v] = pair.split(':');
    if (k && v && !isNaN(Number(v))) out[k.trim().toUpperCase()] = Number(v);
  });
  return out;
};

/**
 * @returns {{rate:number, cents:number, reason:string, nexus:boolean}}
 */
export async function suggestTax({ state, zip, country, subtotalCents }) {
  const st = normState(state);
  const intl = country && !/^(us|usa|united states)$/i.test(String(country).trim());
  if (intl) return { rate: 0, cents: 0, reason: 'International delivery: no US sales tax', nexus: false };
  if (!st) return { rate: 0, cents: 0, reason: 'No ship-to state on file yet', nexus: false };
  const nexus = nexusStates();
  if (nexus.length && !nexus.includes(st))
    return { rate: 0, cents: 0, reason: `No nexus in ${st}: no tax collected`, nexus: false };
  if (!nexus.length)
    return { rate: 0, cents: 0, reason: 'Nexus states not set (TAX_NEXUS_STATES)', nexus: false };

  if (process.env.TAXJAR_API_KEY && zip) {
    try {
      const r = await fetch(`https://api.taxjar.com/v2/rates/${encodeURIComponent(zip)}?country=US&state=${st}`, {
        headers: { Authorization: 'Bearer ' + process.env.TAXJAR_API_KEY } });
      const j = await r.json();
      const rate = Number(j?.rate?.combined_rate || 0) * 100;
      if (rate > 0) return { rate, cents: Math.round(subtotalCents * rate / 100), reason: `TaxJar combined rate for ${zip}`, nexus: true };
    } catch { /* fall through to the table */ }
  }
  const rate = overrides()[st] ?? STATE_BASE[st] ?? 0;
  return { rate, cents: Math.round(subtotalCents * rate / 100),
    reason: overrides()[st] != null ? `${st} combined rate on file` : `${st} state base rate (local add-ons may apply)`, nexus: true };
}
