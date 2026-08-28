-- Production hardening (audit 8/28).
-- 1) The four tables created in 0035/0036 were the only ones without row security.
--    Every other table is enabled-with-no-policies, i.e. deny-by-default. The app
--    reads through the service role, which bypasses RLS, so this changes nothing
--    for us and closes the hole if a public key is ever introduced.
alter table offers            enable row level security;
alter table offer_responses   enable row level security;
alter table site_events       enable row level security;
alter table visitor_links     enable row level security;

-- 2) Indexes for the columns the app actually filters and sorts on.
--    Only 11 existed; these are the ones every page load was scanning without.
create index if not exists artworks_available_idx      on artworks (available);
create index if not exists artworks_artist_idx         on artworks (artist);
create index if not exists artworks_price_idx          on artworks (price_cents desc nulls last);

create index if not exists inquiries_status_idx        on inquiries (status);
create index if not exists inquiries_collector_idx     on inquiries (collector_id);
create index if not exists inquiries_handle_idx        on inquiries (artwork_handle);
create index if not exists inquiries_owner_idx         on inquiries (owner);
create index if not exists inquiries_created_idx       on inquiries (created_at desc);

create index if not exists purchases_collector_idx     on purchases (collector_id);
create index if not exists purchases_artwork_idx       on purchases (artwork_id);
create index if not exists purchases_artist_idx        on purchases (artist);

create index if not exists invoices_collector_idx      on invoices (collector_id);
create index if not exists invoices_sale_idx           on invoices (sale_id);
create index if not exists invoices_status_idx         on invoices (status);
create index if not exists invoices_issued_idx         on invoices (issued_at desc);

create index if not exists payments_invoice_idx        on payments (invoice_id);
create index if not exists payments_settled_idx        on payments (status, settled_at desc);

create index if not exists holds_artwork_idx           on holds (artwork_id, status);
create index if not exists offers_viewed_idx           on offers (last_viewed_at desc nulls last);
create index if not exists commissions_person_idx      on commissions (person, period);

-- the details link seq-scanned all 27k collectors on every open
create index if not exists collectors_details_token_idx on collectors (details_token)
  where details_token is not null;
create index if not exists collectors_details_done_idx  on collectors (details_completed_at desc)
  where details_completed_at is not null;

-- the collector card filters activities by entity_id alone, so the existing
-- (entity_type, entity_id, created_at) index could never be used
create index if not exists activities_entity_idx       on activities (entity_id, created_at desc);

-- Today reads recent identified visits ordered by time; neither existing index
-- could satisfy the sort, so every load sorted the whole matching set
create index if not exists site_events_recent_idx      on site_events (occurred_at desc)
  where collector_id is not null;
