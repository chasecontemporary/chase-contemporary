drop view if exists artist_performance;
create view artist_performance as
select coalesce(w.artist, p.artist) as artist,
  coalesce(w.on_hand, 0) as on_hand,
  coalesce(w.on_hand_value, 0) as on_hand_value_cents,
  coalesce(w.total_works, 0) as total_works,
  coalesce(p.sold, 0) as sold,
  coalesce(p.revenue, 0) as revenue_cents,
  coalesce(p.avg_sale, 0) as avg_sale_cents,
  p.last_sale,
  case when coalesce(w.total_works, 0) > 0
    then round(100.0 * coalesce(p.sold, 0) / w.total_works) else null end as sell_through,
  coalesce(p.sold_12mo, 0) as sold_12mo,
  coalesce(p.revenue_12mo, 0) as revenue_12mo_cents,
  w.avg_months_on_hand
from
  (select artist, count(*) filter (where available) as on_hand,
     coalesce(sum(price_cents) filter (where available), 0) as on_hand_value,
     count(*) as total_works,
     round(avg(extract(epoch from (now() - acquired_at)) / 2629800) filter (where available and acquired_at is not null)) as avg_months_on_hand
   from artworks where artist is not null group by artist) w
full join
  (select artist, count(*) as sold, sum(amount_cents) as revenue,
     round(avg(amount_cents)) as avg_sale, max(purchased_at) as last_sale,
     count(*) filter (where purchased_at > now() - interval '12 months') as sold_12mo,
     coalesce(sum(amount_cents) filter (where purchased_at > now() - interval '12 months'), 0) as revenue_12mo
   from purchases where artist is not null group by artist) p
on w.artist = p.artist;
