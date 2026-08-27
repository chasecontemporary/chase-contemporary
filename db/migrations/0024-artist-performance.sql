create or replace view artist_performance as
select coalesce(w.artist, p.artist) as artist,
  coalesce(w.on_hand, 0) as on_hand,
  coalesce(w.on_hand_value, 0) as on_hand_value_cents,
  coalesce(w.total_works, 0) as total_works,
  coalesce(p.sold, 0) as sold,
  coalesce(p.revenue, 0) as revenue_cents,
  coalesce(p.avg_sale, 0) as avg_sale_cents,
  p.last_sale,
  case when coalesce(w.total_works, 0) > 0
    then round(100.0 * coalesce(p.sold, 0) / w.total_works) else null end as sell_through
from
  (select artist, count(*) filter (where available) as on_hand,
     coalesce(sum(price_cents) filter (where available), 0) as on_hand_value,
     count(*) as total_works
   from artworks where artist is not null group by artist) w
full join
  (select artist, count(*) as sold, sum(amount_cents) as revenue,
     round(avg(amount_cents)) as avg_sale, max(purchased_at) as last_sale
   from purchases where artist is not null group by artist) p
on w.artist = p.artist;
