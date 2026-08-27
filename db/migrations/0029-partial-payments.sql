alter table payments add column if not exists invoice_id uuid references invoices(id);
create index if not exists payments_invoice_idx on payments(invoice_id);
