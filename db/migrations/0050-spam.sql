-- Quarantine for bot submissions. The raw payload is kept so a person can rescue a real
-- inquiry with one click (it replays through the normal capture path). Nothing here touches
-- collectors or inquiries: a quarantined submission is not in the book and not on the board.
create table if not exists spam_submissions (
  id uuid primary key default gen_random_uuid(),
  payload jsonb not null,
  email text,
  name text,
  about text,
  score int not null default 0,
  reasons text[] not null default '{}',
  ip_hash text,
  created_at timestamptz not null default now(),
  rescued_at timestamptz,
  rescued_by text,
  dismissed_at timestamptz
);
create index if not exists spam_submissions_open_idx on spam_submissions (created_at desc)
  where rescued_at is null and dismissed_at is null;
alter table spam_submissions enable row level security;
