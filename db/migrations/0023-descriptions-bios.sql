alter table artworks add column if not exists description text;
alter table artworks add column if not exists provenance text;
create table if not exists artist_bios (
  artist text primary key,
  bio text not null,
  source text default 'site',
  updated_at timestamptz not null default now()
);
alter table artist_bios enable row level security;
