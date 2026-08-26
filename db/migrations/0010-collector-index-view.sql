create or replace view collector_index as
select c.*,
  coalesce(p.spend, 0) as spend_cents, coalesce(p.works, 0) as works, p.last_buy,
  coalesce(i.open_inq, 0) as open_inq, i.last_inq
from collectors c
left join (select collector_id, sum(amount_cents) as spend, count(*) as works, max(purchased_at) as last_buy
           from purchases group by 1) p on p.collector_id = c.id
left join (select collector_id,
             count(*) filter (where status in ('new','contacted','in_conversation','hold','invoice')) as open_inq,
             max(created_at) as last_inq
           from inquiries group by 1) i on i.collector_id = c.id;
