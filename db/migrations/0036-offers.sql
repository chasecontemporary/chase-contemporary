-- Private offers: a tokenized, collector-facing page of curated works with prices,
-- viewed-tracking, and one-tap interest that lands back in the pipeline.
create table if not exists offers (
  id uuid primary key default gen_random_uuid(),
  token text unique not null,
  collector_id uuid not null references collectors(id),
  inquiry_id uuid references inquiries(id),
  title text,
  note text,
  items jsonb not null default '[]',          -- [{id: artwork uuid, price_cents: int|null}]
  created_by text,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  status text not null default 'active',      -- active | revoked
  view_count int not null default 0,
  first_viewed_at timestamptz,
  last_viewed_at timestamptz
);
create index if not exists offers_collector_idx on offers (collector_id, created_at desc);

-- one-tap responses from the offer page
create table if not exists offer_responses (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references offers(id),
  artwork_id uuid not null references artworks(id),
  inquiry_id uuid references inquiries(id),
  created_at timestamptz not null default now(),
  unique (offer_id, artwork_id)
);
