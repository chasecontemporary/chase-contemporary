alter table invoices add column if not exists pay_url text;
alter table invoices add column if not exists shopify_draft_id text;
alter table artworks add column if not exists coa_url text;
