-- wave 1-4: locations, invoice completeness, on-approval, audiences, campaigns
alter table artworks add column if not exists location text;
alter table invoices add column if not exists tax_cents bigint not null default 0;
alter table invoices add column if not exists shipping_cents bigint not null default 0;
alter table holds add column if not exists kind text not null default 'hold';   -- hold | approval
alter table holds add column if not exists out_to text;
alter table holds alter column expires_at drop not null;

create table if not exists audiences (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  definition jsonb not null default '{}'::jsonb,   -- {seg, q, artist, min_spend, vip}
  created_by text,
  created_at timestamptz not null default now()
);
create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'drop',        -- drop | newsletter | oneoff
  subject text,
  preheader text,
  body text,
  artwork_ids uuid[] not null default '{}',
  audience_id uuid references audiences(id),
  status text not null default 'draft',     -- draft | approved | sent
  approved_by text,
  sent_at timestamptz,
  created_by text,
  created_at timestamptz not null default now()
);
alter table audiences enable row level security;
alter table campaigns enable row level security;

create or replace view inventory_by_location as
select coalesce(nullif(trim(location), ''), 'Unassigned') as location,
  count(*) as works,
  count(*) filter (where available) as available,
  coalesce(sum(price_cents) filter (where available), 0) as value_cents
from artworks group by 1;

-- taste backfill: Artcloud contact tags that match a known artist become pinned interests
insert into collector_interests (collector_id, label, kind, added_by)
select distinct c.id, initcap(t.tag), 'artist', 'artcloud-tags'
from collectors c, unnest(c.tags) as t(tag)
where exists (select 1 from artworks a where lower(a.artist) = lower(t.tag))
on conflict (collector_id, label) do nothing;
