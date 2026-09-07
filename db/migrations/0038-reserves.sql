-- Reserves: "I'm holding this until Friday."
--
-- A reserve is on the WORK, not the lead. It exists so two salespeople cannot promise the
-- same canvas to two collectors — the single most expensive mistake a multi-rep gallery
-- makes. The work never leaves the gallery (that was the take-home trial idea, which this
-- gallery does not do and which was removed).
--
-- Reuses the holds table with kind='reserve'. Expiry is evaluated on read, so a lapsed
-- reserve stops blocking on its own without a cron job ever needing to run.

alter table holds add column if not exists placed_by text;      -- which rep promised it
alter table holds add column if not exists note text;           -- "confirming with her partner"
alter table holds add column if not exists inquiry_id uuid references inquiries(id);
alter table holds add column if not exists released_at timestamptz;

create index if not exists holds_active_idx on holds (artwork_id)
  where status = 'active';

-- The one question the floor asks: is this work spoken for, and by whom?
-- Anything expired is reported as lapsed rather than active, so nothing needs sweeping.
create or replace view artwork_reserves as
  select h.id,
         h.artwork_id,
         h.collector_id,
         h.inquiry_id,
         h.placed_by,
         h.note,
         h.placed_at,
         h.expires_at,
         h.deposit_cents,
         (h.expires_at is not null and h.expires_at < now()) as lapsed,
         a.title  as artwork_title,
         a.artist as artwork_artist,
         c.first_name,
         c.last_name,
         c.email,
         c.phone
    from holds h
    join artworks a   on a.id = h.artwork_id
    left join collectors c on c.id = h.collector_id
   where h.kind = 'reserve'
     and h.status = 'active';
