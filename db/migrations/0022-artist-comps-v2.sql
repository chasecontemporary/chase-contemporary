create or replace view artist_comps as
select a.artist,
  count(*) as n_comps,
  round(percentile_cont(0.5) within group (order by p.amount_cents / (a.dims_h_in * a.dims_w_in))) as median_ppsi_cents,
  round(percentile_cont(0.5) within group (order by p.amount_cents / (a.dims_h_in * a.dims_w_in))
    filter (where p.purchased_at > now() - interval '3 years')) as recent_ppsi_cents,
  count(*) filter (where p.purchased_at > now() - interval '3 years') as n_recent,
  round(percentile_cont(0.25) within group (order by p.amount_cents / (a.dims_h_in * a.dims_w_in))) as p25_ppsi_cents,
  round(percentile_cont(0.75) within group (order by p.amount_cents / (a.dims_h_in * a.dims_w_in))) as p75_ppsi_cents,
  max(p.purchased_at) as last_sale,
  round(avg(p.amount_cents)) as avg_sale_cents,
  sum(p.amount_cents) as total_revenue_cents
from purchases p join artworks a on a.id = p.artwork_id
where a.artist is not null and a.dims_h_in > 0 and a.dims_w_in > 0 and p.amount_cents > 50000
group by a.artist having count(*) >= 3;
