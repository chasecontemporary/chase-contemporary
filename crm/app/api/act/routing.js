// Routing rules and duty roster. Called from the act route; returns true when handled.
export async function handleRouting({ action, form, id, rep, db, must }) {
  const log = (body) => db.from('activities').insert({ entity_type: 'routing_rule', entity_id: id || null, kind: 'routing', body, actor: rep });
  if (action === 'routing_rule_add') {
    const match_kind = form.get('match_kind');
    if (!['artist', 'source', 'budget_min', 'geography', 'round_robin'].includes(match_kind)) throw new Error('Pick what the rule matches on.');
    const match_value = match_kind === 'round_robin' ? null : (form.get('match_value') || '').trim();
    if (match_kind !== 'round_robin' && !match_value) throw new Error('The rule needs a value to match.');
    const assign_to = match_kind === 'round_robin' ? null : (form.get('assign_to') || '').trim();
    if (match_kind !== 'round_robin' && !assign_to) throw new Error('Pick who the rule assigns to.');
    const { data } = must(await db.from('routing_rules').insert({
      sort: parseInt(form.get('sort')) || 100, match_kind, match_value, assign_to,
      label: (form.get('label') || '').trim() || null, active: true }).select().single());
    await db.from('activities').insert({ entity_type: 'routing_rule', entity_id: data.id, kind: 'routing',
      body: `added: ${data.label || match_kind} ${match_value || ''} -> ${assign_to || 'rotation'}`, actor: rep });
    return true;
  }
  if (action === 'routing_rule_update') {
    const patch = {};
    if (form.has('sort')) patch.sort = parseInt(form.get('sort')) || 100;
    if (form.has('match_value')) patch.match_value = (form.get('match_value') || '').trim() || null;
    if (form.has('assign_to')) patch.assign_to = (form.get('assign_to') || '').trim() || null;
    if (form.has('label')) patch.label = (form.get('label') || '').trim() || null;
    must(await db.from('routing_rules').update(patch).eq('id', id));
    await log(`updated: ${Object.keys(patch).join(', ')}`);
    return true;
  }
  if (action === 'routing_rule_toggle') {
    const active = form.get('active') === '1';
    must(await db.from('routing_rules').update({ active }).eq('id', id));
    await log(active ? 'switched on' : 'switched off');
    return true;
  }
  if (action === 'routing_rule_del') {
    must(await db.from('routing_rules').delete().eq('id', id));
    await log('deleted');
    return true;
  }
  if (action === 'team_on_duty') {
    must(await db.from('team_members').update({ on_duty: form.get('on_duty') === '1' }).eq('id', id));
    return true;
  }
  if (action === 'team_slack_id') {
    const v = (form.get('slack_user_id') || '').trim().toUpperCase();
    if (v && !/^[UW][A-Z0-9]{6,}$/.test(v)) throw new Error('A Slack member ID looks like U0C06NW5XPB.');
    must(await db.from('team_members').update({ slack_user_id: v || null }).eq('id', id));
    return true;
  }
  return false;
}
