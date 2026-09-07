-- Possible duplicate collectors: same phone digits, or same name in the same city, or the
-- same email local part on a different domain. Pairs only, richer record first.
create or replace view collector_dupes as
with c as (
  select id, first_name, last_name, email, phone, city, created_at,
         regexp_replace(coalesce(phone, ''), '\D', '', 'g') as digits,
         lower(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, ''))) as nm,
         lower(split_part(coalesce(email, ''), '@', 1)) as local,
         (email like '%import.chasecontemporary.com') as synthetic
    from collectors
)
select a.id as keep_id, b.id as drop_id,
       a.first_name as a_first, a.last_name as a_last, a.email as a_email, a.phone as a_phone, a.city as a_city,
       b.first_name as b_first, b.last_name as b_last, b.email as b_email, b.phone as b_phone, b.city as b_city,
       case when a.digits <> '' and a.digits = b.digits then 'same phone'
            when a.nm <> '' and a.nm = b.nm and lower(coalesce(a.city, '')) = lower(coalesce(b.city, '')) and a.city is not null then 'same name and city'
            else 'same email name' end as why
  from c a
  join c b on a.id <> b.id
   and (
        (a.digits <> '' and length(a.digits) >= 10 and a.digits = b.digits)
     or (a.nm <> '' and length(a.nm) > 5 and a.nm = b.nm and a.city is not null and lower(a.city) = lower(coalesce(b.city, '')))
     or (a.local <> '' and length(a.local) > 6 and a.local = b.local and a.email <> b.email and not a.synthetic and not b.synthetic)
   )
   -- keep = the real email over a synthetic one, else the older record
   and ((not a.synthetic and b.synthetic) or (a.synthetic = b.synthetic and a.created_at < b.created_at))
 limit 500;
