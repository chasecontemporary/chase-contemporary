create or replace view book_stats as
select
  (select count(*) from collectors) as collectors,
  (select count(distinct collector_id) from purchases) as buyers,
  (select coalesce(sum(amount_cents), 0) from purchases) as ltv_cents;

create or replace function collector_list(def jsonb, lim int default 500)
returns setof collector_index language sql stable as $$
  select c.* from collector_index c
  where c.email <> 'sale-@import.chasecontemporary.com'
  and (coalesce(def->>'seg','all') = 'all'
     or (def->>'seg' = 'buyers' and c.spend_cents > 0)
     or (def->>'seg' = 'active' and c.open_inq > 0)
     or (def->>'seg' = 'trade' and c.trade)
     or (def->>'seg' = 'news' and c.newsletter)
     or (def->>'seg' = 'vip' and c.tags @> array['VIP list']))
  and (nullif(def->>'min_spend','') is null or c.spend_cents >= (def->>'min_spend')::bigint * 100)
  and (nullif(def->>'artist','') is null
       or exists (select 1 from collector_interests i where i.collector_id = c.id
                  and i.label ilike '%' || (def->>'artist') || '%')
       or exists (select 1 from purchases p where p.collector_id = c.id
                  and p.artist ilike '%' || (def->>'artist') || '%'))
  and (nullif(def->>'q','') is null
       or c.first_name ilike '%' || (def->>'q') || '%' or c.last_name ilike '%' || (def->>'q') || '%'
       or c.email ilike '%' || (def->>'q') || '%' or c.city ilike '%' || (def->>'q') || '%'
       or c.company ilike '%' || (def->>'q') || '%')
  order by c.spend_cents desc, c.last_inq desc nulls last, c.created_at desc
  limit lim
$$;
