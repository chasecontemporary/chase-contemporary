-- Workstream B: checkout comes back into the engine.
--
-- Until now the only order that reached the engine was one carrying an engine_invoice_id
-- from a pay link. A normal storefront checkout settled nothing, told nobody, and left the
-- work on sale. This table is the join between a Shopify order and what the engine made of
-- it: the idempotency key so a webhook delivered twice does nothing the second time, the
-- link Finance reconciles card money against, and the queue of orders a person must look at.

create table if not exists shopify_orders (
  id               uuid primary key default gen_random_uuid(),
  shopify_order_id text not null unique,          -- the idempotency key
  order_name       text,                          -- the human number, "#1042"
  collector_id     uuid references collectors(id),
  invoice_id       uuid references invoices(id),
  sale_id          uuid references sales(id),
  total_cents      bigint,
  financial_status text,                          -- paid | refunded | voided, as Shopify says
  needs_review     boolean not null default false,
  review_reason    text,                          -- why a person has to look, in plain words
  raw              jsonb,                         -- the order as it arrived, for forensics
  refunded_at      timestamptz,                   -- set when a refund or cancellation reversed it
  created_at       timestamptz not null default now()
);

create index if not exists shopify_orders_review_idx
  on shopify_orders (created_at desc) where needs_review;
create index if not exists shopify_orders_collector_idx on shopify_orders (collector_id);
create index if not exists shopify_orders_invoice_idx on shopify_orders (invoice_id);

alter table shopify_orders enable row level security;

-- An unattended sale can be wrong in ways an attended one cannot: an original that was never
-- meant to be purchasable, a line that matches no work in the book, a total that does not add
-- up. The sale carries the flag so it is loud wherever a sale is shown, not only on Today.
alter table sales add column if not exists needs_review  boolean not null default false;
alter table sales add column if not exists review_reason text;
