create or replace view finance_monthly as
select date_trunc('month', purchased_at)::date as month,
  sum(amount_cents) as collected_cents, count(*) as sales
from purchases group by 1;
