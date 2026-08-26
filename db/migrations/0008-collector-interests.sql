-- pinned collector interests (rep-curated; derived taste computes live from purchases/inquiries)
create table if not exists collector_interests (
  id uuid primary key default gen_random_uuid(),
  collector_id uuid references collectors(id) not null,
  label text not null,
  kind text not null default 'custom',   -- artist / medium / style / subject / custom
  added_by text default 'system',
  created_at timestamptz not null default now(),
  unique (collector_id, label)
);
create index if not exists collector_interests_cid on collector_interests(collector_id);
alter table collector_interests enable row level security;
