create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  email text,
  role text not null default 'rep',       -- owner / rep
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table team_members enable row level security;
insert into team_members (name, email, role) values
  ('Devyn', 'devyn@magnumopus.agency', 'rep'),
  ('Wyatt', 'wyatt@chasecontemporary.com', 'rep'),
  ('Bernie', null, 'owner'),
  ('Sara', 'sara@chasecontemporary.com', 'rep')
on conflict (name) do nothing;