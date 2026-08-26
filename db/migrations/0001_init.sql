-- Chase Contemporary Revenue Engine — backbone schema v1
-- One database of record: collectors, artworks, inquiries, deals, payments, holds,
-- commissions (internal pool — gallery owns all inventory), activities.

create extension if not exists pgcrypto;

create table collectors (
  id uuid primary key default gen_random_uuid(),
  first_name text,
  last_name text,
  email text unique,
  phone text,
  city text,
  timezone text,
  locale text,
  source text,                       -- how they found us (first touch)
  trade boolean default false,       -- purchasing on behalf of a client
  newsletter boolean default false,
  budget_range text,
  tags text[] default '{}',
  artcloud_id text,                  -- migration key
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table artworks (
  id uuid primary key default gen_random_uuid(),
  shopify_product_id bigint unique,
  handle text unique,
  title text not null,
  artist text,
  price_cents bigint,
  currency text default 'USD',
  product_type text,                 -- Original Artwork / Print / Photography...
  is_edition boolean default false,
  available boolean default true,
  image_url text,
  medium text,
  dims_h_in numeric,
  dims_w_in numeric,
  artcloud_id text,
  created_at timestamptz not null default now()
);

create type inquiry_status as enum
  ('new','contacted','in_conversation','hold','invoice','paid','nurture','closed');

create table inquiries (
  id uuid primary key default gen_random_uuid(),
  collector_id uuid references collectors(id),
  artwork_id uuid references artworks(id),
  artwork_handle text,
  artwork_title text,
  artist text,
  price_band text,
  purpose text,                      -- acquire / press / trade / general (contact router)
  outlet text,                       -- press inquiries
  budget_range text,
  timeframe text,
  message text,
  source text,
  page_journey text,
  referrer text,
  utm text,
  seconds_on_page int,
  device text,
  status inquiry_status not null default 'new',
  owner text,                        -- who owns the follow-up (Sara / Bernie)
  contacted_at timestamptz,          -- SLA clock stops here
  created_at timestamptz not null default now()
);
create index inquiries_status_idx on inquiries(status, created_at desc);
create index inquiries_collector_idx on inquiries(collector_id);

create table deals (
  id uuid primary key default gen_random_uuid(),
  collector_id uuid references collectors(id),
  artwork_id uuid references artworks(id),
  inquiry_id uuid references inquiries(id),
  amount_cents bigint,
  stage text not null default 'open',   -- open / hold / invoiced / paid / lost
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  notes text
);

create table holds (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references deals(id),
  artwork_id uuid references artworks(id),
  collector_id uuid references collectors(id),
  deposit_cents bigint,
  placed_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null default 'active'  -- active / converted / released / expired
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references deals(id),
  amount_cents bigint not null,
  method text,                        -- card / ach / wire / square / financing
  status text not null default 'pending',
  external_ref text,
  settled_at timestamptz,
  created_at timestamptz not null default now()
);

-- internal commission pool: pre-agreed structure, splits compute on settlement
create table commission_rules (
  id uuid primary key default gen_random_uuid(),
  person text not null,
  pct numeric not null,
  active boolean default true,
  created_at timestamptz not null default now()
);

create table commissions (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid references payments(id),
  person text not null,
  pct numeric not null,
  amount_cents bigint not null,
  settled boolean default false,
  created_at timestamptz not null default now()
);

create table activities (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,          -- collector / inquiry / deal / artwork
  entity_id uuid not null,
  kind text not null,                 -- inquiry_received / email / call / status_change / note...
  body text,
  actor text default 'system',
  created_at timestamptz not null default now()
);
create index activities_entity_idx on activities(entity_type, entity_id, created_at desc);

-- settlement trigger: compute pool splits when a payment settles
create or replace function compute_commissions() returns trigger as $$
begin
  if new.status = 'settled' and (old.status is distinct from 'settled') then
    insert into commissions (payment_id, person, pct, amount_cents)
    select new.id, r.person, r.pct, round(new.amount_cents * r.pct / 100.0)
    from commission_rules r where r.active;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger payments_settlement
  after update on payments
  for each row execute function compute_commissions();

-- RLS: locked down; only service role (the CRM/API) touches data for now
alter table collectors enable row level security;
alter table artworks enable row level security;
alter table inquiries enable row level security;
alter table deals enable row level security;
alter table holds enable row level security;
alter table payments enable row level security;
alter table commission_rules enable row level security;
alter table commissions enable row level security;
alter table activities enable row level security;
