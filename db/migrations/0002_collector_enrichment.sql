-- collector personal enrichment + purchases (the collection ledger)
alter table collectors
  add column if not exists salutation text,
  add column if not exists spouse_first_name text,
  add column if not exists spouse_last_name text,
  add column if not exists company text,
  add column if not exists website text,
  add column if not exists address_line1 text,
  add column if not exists address_line2 text,
  add column if not exists state text,
  add column if not exists zip text,
  add column if not exists country text;

create table if not exists purchases (
  id uuid primary key default gen_random_uuid(),
  collector_id uuid references collectors(id) not null,
  artwork_id uuid references artworks(id),
  deal_id uuid references deals(id),
  title text,
  artist text,
  amount_cents bigint not null default 0,
  purchased_at date not null default current_date,
  source text default 'manual',        -- artcloud / shopify / engine / manual
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists purchases_collector_idx on purchases(collector_id, purchased_at desc);
alter table purchases enable row level security;
