-- After the money: a sale does not end at "paid". The work has to leave, arrive, and the
-- collector has to hear about it. One shipment row per work on a paid sale.
create table if not exists shipments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales(id),
  invoice_id uuid references invoices(id),
  artwork_id uuid references artworks(id),
  collector_id uuid references collectors(id),
  carrier text,                          -- YSDS | Hangman | SBA | FedEx | Collector pickup | Other
  quote_cents bigint,
  tracking text,
  tracking_url text,
  ship_from text,                        -- location the work left
  ship_to text,                          -- address snapshot at the time
  status text not null default 'pending',-- pending | packed | shipped | delivered | installed
  packed_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  installed_at timestamptz,
  eta date,
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists shipments_sale_idx on shipments (sale_id);
create index if not exists shipments_status_idx on shipments (status);
alter table shipments enable row level security;

-- the sale's own view of the road from paid to done
alter table sales add column if not exists fulfilment_status text not null default 'none';
  -- none (not paid yet) | to_ship | shipped | delivered | done
alter table sales add column if not exists closed_at timestamptz;
alter table sales add column if not exists thanked_at timestamptz;

-- the certificate leaves signed, and we remember that it did
alter table artworks add column if not exists coa_signed_at timestamptz;
alter table artworks add column if not exists coa_sent_at timestamptz;

-- a paid sale is a sale waiting to ship
update sales set fulfilment_status = 'to_ship' where status = 'paid' and fulfilment_status = 'none';
