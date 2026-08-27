alter table invoices add column if not exists pay_url text;
alter table invoices add column if not exists stripe_session_id text;
