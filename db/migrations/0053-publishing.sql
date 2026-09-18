-- Publishing a work to the website is a queue, not a button. There are 1,215 works waiting to
-- go up and the Admin API takes them a couple a second, so no single request can do it. A work
-- moves through site_status and a drain endpoint does the talking to Shopify in batches:
--
--   null      not being considered
--   queued    chosen for the site, nothing pushed yet
--   staged    a draft product exists on Shopify, waiting for Bernie
--   approved  Bernie said yes, waiting to be switched on
--   live      active on chasecontemporary.com
--   held      Bernie sent it back, with a reason
--   sold      hidden because it sold (existing behaviour, set by settlement)
--
-- The columns below are the audit trail: who decided what, and when.
alter table artworks add column if not exists queued_at timestamptz;
alter table artworks add column if not exists staged_at timestamptz;
alter table artworks add column if not exists approved_at timestamptz;
alter table artworks add column if not exists approved_by text;
alter table artworks add column if not exists review_note text;
alter table artworks add column if not exists publish_error text;

-- The drain and the approval queue both read by state, oldest first.
create index if not exists artworks_site_status_idx on artworks (site_status, queued_at);
create index if not exists artworks_artist_status_idx on artworks (artist, site_status);

comment on column artworks.site_status is
  'queued, staged, approved, live, held or sold. The publishing queue, drained to Shopify in batches.';
comment on column artworks.publish_error is
  'The last thing Shopify said when a push failed, so a stuck work says why on the approvals page.';
