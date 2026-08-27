alter table invoices add column if not exists ar_status text not null default 'issued';
alter table invoices add column if not exists promise_date date;
alter table invoices add column if not exists last_nudge_at timestamptz;
