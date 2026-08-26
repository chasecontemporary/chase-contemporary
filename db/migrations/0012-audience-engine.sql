create or replace function audience_ids(def jsonb) returns setof uuid
language sql stable as $$
  select c.id from collector_index c
  where (coalesce(def->>'seg','all') = 'all'
     or (def->>'seg' = 'buyers' and c.spend_cents > 0)
     or (def->>'seg' = 'active' and c.open_inq > 0)
     or (def->>'seg' = 'trade' and c.trade)
     or (def->>'seg' = 'vip' and c.tags @> array['VIP list']))
  and (coalesce((def->>'consented')::boolean, true) = false or c.newsletter)
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
  and c.email not like '%import.chasecontemporary.com'
$$;
create or replace function audience_count(def jsonb) returns bigint
language sql stable as $$ select count(*) from audience_ids(def) $$;
