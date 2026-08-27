-- Full-journey attribution: anonymous first-party visitor trail, stitched to a
-- collector at identity moments (inquiry submit; later: Klaviyo click, checkout).
create table if not exists site_events (
  id bigint generated always as identity primary key,
  visitor_id text not null,
  collector_id uuid references collectors(id),
  path text,
  referrer text,
  utm text,
  occurred_at timestamptz not null default now()
);
create index if not exists site_events_visitor_idx on site_events (visitor_id, occurred_at);
create index if not exists site_events_collector_idx on site_events (collector_id, occurred_at);

create table if not exists visitor_links (
  visitor_id text primary key,
  collector_id uuid not null references collectors(id),
  linked_via text,
  linked_at timestamptz not null default now()
);

alter table inquiries add column if not exists visitor_id text;

-- One row per known collector: how much of our site they have actually seen.
create or replace view collector_journey as
  select collector_id,
    count(*)::int as page_views,
    count(distinct occurred_at::date)::int as visit_days,
    min(occurred_at) as first_seen,
    max(occurred_at) as last_seen
  from site_events
  where collector_id is not null
  group by collector_id;
