-- An inquiry has always recorded the product handle as a string and never which work it was
-- about. The pipeline hid that by matching titles on every page render, so the drawer looked
-- right while the record underneath knew nothing. Anything that is not that one page, a report,
-- the digest, or the question "which works do people actually ask about", could not answer.
--
-- Capture resolves it at the source now. This backfills what is already here, by handle first
-- and then by an exact title and artist match, and indexes the column so demand per work is a
-- cheap question.
update inquiries i
   set artwork_id = a.id
  from artworks a
 where i.artwork_id is null
   and i.artwork_handle is not null
   and a.handle = i.artwork_handle;

update inquiries i
   set artwork_id = a.id
  from artworks a
 where i.artwork_id is null
   and i.artwork_title is not null
   and a.title = i.artwork_title
   and (i.artist is null or a.artist = i.artist);

create index if not exists inquiries_artwork_idx on inquiries (artwork_id, created_at desc);

-- Demand per work: what the gallery is being asked about, and what it is not. This is the
-- feedback loop for publishing. A work nobody asks about after months on the site is a
-- different decision from one that has been asked about six times and never sold.
create or replace view artwork_demand as
select a.id                              as artwork_id,
       a.title,
       a.artist,
       a.available,
       a.site_status,
       a.price_cents,
       count(i.id)                       as inquiries,
       count(i.id) filter (where i.created_at > now() - interval '90 days') as inquiries_90d,
       max(i.created_at)                 as last_asked_at,
       count(distinct i.collector_id)    as people
  from artworks a
  left join inquiries i on i.artwork_id = a.id and i.kind = 'buying'
 group by a.id, a.title, a.artist, a.available, a.site_status, a.price_cents;

comment on view artwork_demand is
  'How often each work is asked about. The feedback loop for what to publish and what to reprice.';
