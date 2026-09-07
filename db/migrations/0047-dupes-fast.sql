-- The duplicate finder as three equi-joins (hashable) instead of one OR-join that nested-
-- looped 27k x 27k and hit the statement timeout.
create or replace view collector_dupes as
with c as (
  select id, first_name, last_name, email, phone, city, created_at,
         nullif(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), '') as digits,
         nullif(lower(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, ''))), '') as nm,
         lower(coalesce(city, '')) as cty,
         nullif(lower(split_part(coalesce(email, ''), '@', 1)), '') as local,
         (email like '%import.chasecontemporary.com') as synthetic
    from collectors
),
pairs as (
  select a.id as a_id, b.id as b_id, 'same phone' as why
    from c a join c b on a.digits = b.digits and a.id <> b.id
   where length(a.digits) >= 10
  union all
  select a.id, b.id, 'same name and city'
    from c a join c b on a.nm = b.nm and a.cty = b.cty and a.id <> b.id
   where length(a.nm) > 5 and a.cty <> ''
  union all
  select a.id, b.id, 'same email name'
    from c a join c b on a.local = b.local and a.id <> b.id
   where length(a.local) > 6 and a.email <> b.email and not a.synthetic and not b.synthetic
)
select distinct on (least(p.a_id, p.b_id), greatest(p.a_id, p.b_id))
       case when (not a.synthetic and b.synthetic) or (a.synthetic = b.synthetic and a.created_at <= b.created_at) then a.id else b.id end as keep_id,
       case when (not a.synthetic and b.synthetic) or (a.synthetic = b.synthetic and a.created_at <= b.created_at) then b.id else a.id end as drop_id,
       a.first_name as a_first, a.last_name as a_last, a.email as a_email, a.phone as a_phone, a.city as a_city,
       b.first_name as b_first, b.last_name as b_last, b.email as b_email, b.phone as b_phone, b.city as b_city,
       p.why
  from pairs p join c a on a.id = p.a_id join c b on b.id = p.b_id;
