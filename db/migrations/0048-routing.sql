-- Lead routing: ordered rules that hand a new inquiry to a salesperson at capture.
-- Unmatched inquiries stay unclaimed for the floor. Reps can go off duty; a Slack member
-- id lets the Claim button in the floor channel know who pressed it.
create table if not exists routing_rules (
  id uuid primary key default gen_random_uuid(),
  sort int not null default 100,
  match_kind text not null check (match_kind in ('artist', 'source', 'budget_min', 'geography', 'round_robin')),
  match_value text,
  assign_to text,
  label text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists routing_rules_active_sort_idx on routing_rules (active, sort);
alter table routing_rules enable row level security;

alter table team_members add column if not exists on_duty boolean not null default true;
alter table team_members add column if not exists slack_user_id text;
