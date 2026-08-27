alter table artworks add column if not exists acquired_at date;
create or replace view artist_stats as
select artist, count(*) as works,
  count(*) filter (where not available) as sold,
  round(100.0 * count(*) filter (where not available) / count(*)) as sell_through
from artworks where artist is not null group by artist;
