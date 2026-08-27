create table if not exists invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references invoices(id) not null,
  kind text not null default 'work',        -- work | service | shipping | tax
  artwork_id uuid references artworks(id),
  title text,
  artist text,
  amount_cents bigint not null default 0,
  sort int not null default 0
);
create index if not exists invoice_lines_idx on invoice_lines(invoice_id, sort);
alter table invoice_lines enable row level security;
