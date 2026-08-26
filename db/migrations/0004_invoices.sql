create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number serial,
  collector_id uuid references collectors(id),
  inquiry_id uuid references inquiries(id),
  title text,
  artist text,
  amount_cents bigint not null,
  status text not null default 'open',      -- open / paid / void
  method text,                               -- card / ach / wire / square / financing
  issued_at date not null default current_date,
  due_at date,
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists invoices_status_idx on invoices(status, issued_at desc);
alter table invoices enable row level security;