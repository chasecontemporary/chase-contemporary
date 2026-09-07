-- Where the piece is, and where it has been. One row per move; artworks.location stays the
-- current answer so nothing that reads it changes.
create table if not exists artwork_moves (
  id uuid primary key default gen_random_uuid(),
  artwork_id uuid not null references artworks(id),
  from_location text,
  to_location text not null,
  reason text,                         -- storage | framer | photographer | shipped | delivered | returned | fair | gallery | other
  moved_at timestamptz not null default now(),
  moved_by text,
  note text,
  shipment_id uuid references shipments(id),
  created_at timestamptz not null default now()
);
create index if not exists artwork_moves_artwork_idx on artwork_moves (artwork_id, moved_at desc);
alter table artwork_moves enable row level security;

-- Invoice care: a re-issued invoice remembers what it replaced; a credit line reduces the
-- art subtotal without pretending a negative sale happened.
alter table invoices add column if not exists replaces_invoice_id uuid references invoices(id);
alter table invoices add column if not exists void_reason text;
alter table invoice_lines add column if not exists note text;
