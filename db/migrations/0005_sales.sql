create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  collector_id uuid references collectors(id) not null,
  status text not null default 'open',      -- open / invoiced / paid / lost
  owner text,
  created_at timestamptz not null default now()
);
create table if not exists sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid references sales(id) not null,
  inquiry_id uuid references inquiries(id),
  artwork_id uuid references artworks(id),
  title text,
  artist text,
  agreed_cents bigint not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists sale_items_sale_idx on sale_items(sale_id);
alter table invoices add column if not exists sale_id uuid references sales(id);
alter table sales enable row level security;
alter table sale_items enable row level security;