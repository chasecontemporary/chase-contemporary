import { db } from './db';

// Lead routing. Ordered rules decide who a fresh inquiry belongs to; the first match wins.
// No match, no owner: the floor rule stands and "Answer now" shows it to everyone.
// Never throws to its caller. A routing failure must never fail a captured lead.

// "$25k+", "$10,000 to $25,000", "Under $5k" -> lower bound in dollars.
export function budgetFloor(s) {
  const t = String(s || '').toLowerCase().replace(/,/g, '');
  if (!t) return null;
  if (/^\s*under|^\s*below|^\s*less/.test(t)) return 0;
  const m = t.match(/(\d+(?:\.\d+)?)\s*(k|m)?/);
  if (!m) return null;
  let n = parseFloat(m[1]);
  if (m[2] === 'k') n *= 1000;
  if (m[2] === 'm') n *= 1000000;
  return n;
}

const has = (hay, needle) => String(hay || '').toLowerCase().includes(String(needle || '').toLowerCase().trim());
const listMatch = (value, ...fields) => String(value || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean)
  .some(v => fields.some(f => String(f || '').toLowerCase() === v || (v.length > 2 && String(f || '').toLowerCase().includes(v))));

export const RULE_KINDS = [
  ['artist', 'Artist name contains'],
  ['source', 'Source is'],
  ['budget_min', 'Budget at least'],
  ['geography', 'Collector location'],
  ['round_robin', 'Round robin among on-duty reps'],
];

export function describeRule(r) {
  const k = RULE_KINDS.find(x => x[0] === r.match_kind)?.[1] || r.match_kind;
  return r.match_kind === 'round_robin' ? k : `${k} ${r.match_value || ''}`.trim();
}

// Who is on the floor right now.
async function onDutyReps() {
  const { data } = await db.from('team_members').select('id, name, role, active, on_duty').eq('active', true);
  return (data || []).filter(t => t.on_duty !== false);
}

// The on-duty rep whose most recent assignment is the oldest (never assigned first), ties by name.
async function nextInRotation(reps) {
  const pool = reps.filter(r => r.role === 'rep');
  if (!pool.length) return null;
  const names = pool.map(r => r.name);
  const { data } = await db.from('inquiries').select('owner, created_at').in('owner', names)
    .not('owner', 'is', null).order('created_at', { ascending: false }).limit(500);
  const last = {};
  for (const row of (data || [])) if (!(row.owner in last)) last[row.owner] = row.created_at;
  const sorted = [...pool].sort((a, b) => {
    const la = last[a.name] || '', lb = last[b.name] || '';
    if (la !== lb) return la < lb ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return sorted[0].name;
}

function matches(rule, inquiry, collector) {
  switch (rule.match_kind) {
    case 'artist':
      return !!rule.match_value && (has(inquiry?.artist, rule.match_value) || has(inquiry?.artwork_title, rule.match_value));
    case 'source':
      return !!rule.match_value && listMatch(rule.match_value, inquiry?.source, collector?.source);
    case 'budget_min': {
      const floor = budgetFloor(inquiry?.budget_range) ?? budgetFloor(collector?.budget_range);
      const need = budgetFloor(rule.match_value);
      return floor != null && need != null && floor >= need;
    }
    case 'geography':
      return !!rule.match_value && listMatch(rule.match_value, collector?.state, collector?.city, collector?.country, collector?.shipping_state);
    case 'round_robin':
      return true;
    default:
      return false;
  }
}

export async function applyRouting({ inquiry, collector }) {
  try {
    if (!inquiry?.id) return { owner: null };
    const { data: rules } = await db.from('routing_rules').select('*').eq('active', true).order('sort').order('created_at');
    if (!rules?.length) return { owner: null };
    const reps = await onDutyReps();
    const onDuty = new Set(reps.map(r => r.name));
    for (const rule of rules) {
      if (!matches(rule, inquiry, collector)) continue;
      let owner = null;
      if (rule.match_kind === 'round_robin') owner = await nextInRotation(reps);
      else if (rule.assign_to && onDuty.has(rule.assign_to)) owner = rule.assign_to;
      if (!owner) continue;                      // the named rep is inactive or off duty: skip
      const { error } = await db.from('inquiries').update({ owner }).eq('id', inquiry.id).is('owner', null);
      if (error) return { owner: null };
      await db.from('activities').insert({ entity_type: 'inquiry', entity_id: inquiry.id, kind: 'assigned',
        body: `to ${owner} by rule: ${rule.label || describeRule(rule)}`, actor: 'system' });
      return { owner, rule };
    }
    return { owner: null };
  } catch {
    return { owner: null };
  }
}
