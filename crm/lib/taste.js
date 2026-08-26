// Taste engine: computed live from the ledger (purchases + inquiries) so it can
// never go stale; pinned interests (rep-curated) layer on top.
const BANDS = [[500000, 'Under $5k'], [1500000, '$5\u201315k'], [5000000, '$15\u201350k'], [Infinity, '$50k+']];
export const band = (cents) => BANDS.find(([max]) => cents < max)[1];

export function computeTaste(purchases = [], inquiries = [], pins = []) {
  const artists = {};
  const touch = (name) => artists[name] = artists[name] ||
    { name, owned: 0, spend: 0, inquired: 0, pinned: false };
  purchases.forEach(p => { if (p.artist) { const a = touch(p.artist);
    a.owned += 1; a.spend += p.amount_cents || 0; } });
  inquiries.forEach(i => { if (i.artist) touch(i.artist).inquired += 1; });
  pins.filter(p => p.kind === 'artist').forEach(p => touch(p.label).pinned = true);
  const affinity = Object.values(artists)
    .map(a => ({ ...a, score: a.owned * 3 + a.inquired + (a.pinned ? 2 : 0) }))
    .sort((a, b) => b.score - a.score || b.spend - a.spend);

  const bands = {};
  purchases.forEach(p => { if (p.amount_cents > 0) {
    const b = band(p.amount_cents); bands[b] = (bands[b] || 0) + 1; } });
  const bandList = Object.entries(bands).sort((a, b) => b[1] - a[1]);

  const mediums = {};
  purchases.forEach(p => { const m = p.artworks?.medium || p.artworks?.product_type;
    if (m) mediums[m] = (mediums[m] || 0) + 1; });
  const mediumList = Object.entries(mediums).sort((a, b) => b[1] - a[1]);

  const channels = {};
  purchases.forEach(p => { if (p.source) channels[p.source] = (channels[p.source] || 0) + 1; });
  const channelList = Object.entries(channels).sort((a, b) => b[1] - a[1]);

  const months = {};
  purchases.forEach(p => { const m = new Date(p.purchased_at)
    .toLocaleString('en-US', { month: 'short' }); months[m] = (months[m] || 0) + 1; });
  const monthList = Object.entries(months).sort((a, b) => b[1] - a[1]);

  const dates = purchases.map(p => +new Date(p.purchased_at)).sort((a, b) => a - b);
  let cadence = null;
  if (dates.length >= 2) {
    const gaps = dates.slice(1).map((d, i) => (d - dates[i]) / 86400000);
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const daysSince = (Date.now() - dates[dates.length - 1]) / 86400000;
    cadence = { avgGap, daysSince, due: daysSince > avgGap * 1.25 };
  } else if (dates.length === 1) {
    cadence = { avgGap: null, daysSince: (Date.now() - dates[0]) / 86400000, due: false };
  }
  return { affinity, bandList, mediumList, channelList, monthList, cadence };
}
