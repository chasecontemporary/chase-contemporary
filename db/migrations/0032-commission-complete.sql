-- The complete machine: EVERY settled payment writes a commission row.
-- Owner attributed (or 'Unassigned'), rate applied if set, else 0 pending Bernie's numbers.
create or replace function compute_commissions() returns trigger as $$
declare
  v_owner text;
  v_pct numeric;
  v_inv record;
begin
  if new.status = 'settled' and (old.status is distinct from 'settled') and new.invoice_id is not null then
    select i.*, s.owner as sale_owner, q.owner as inquiry_owner into v_inv
      from invoices i
      left join sales s on s.id = i.sale_id
      left join inquiries q on q.id = i.inquiry_id
      where i.id = new.invoice_id;
    v_owner := coalesce(v_inv.sale_owner, v_inv.inquiry_owner, 'Unassigned');
    select pct into v_pct from commission_rules where person = v_owner and active limit 1;
    insert into commissions (payment_id, invoice_id, person, pct, amount_cents, period)
    values (new.id, new.invoice_id, v_owner, coalesce(v_pct, 0),
            round(new.amount_cents * coalesce(v_pct, 0) / 100.0),
            date_trunc('month', coalesce(new.settled_at, now()))::date);
  end if;
  return new;
end;
$$ language plpgsql;

-- backfill: settled payments with an invoice but no commission row
insert into commissions (payment_id, invoice_id, person, pct, amount_cents, period)
select p.id, p.invoice_id,
  coalesce(s.owner, q.owner, 'Unassigned'),
  coalesce(r.pct, 0),
  round(p.amount_cents * coalesce(r.pct, 0) / 100.0),
  date_trunc('month', coalesce(p.settled_at, p.created_at))::date
from payments p
join invoices i on i.id = p.invoice_id
left join sales s on s.id = i.sale_id
left join inquiries q on q.id = i.inquiry_id
left join commission_rules r on r.person = coalesce(s.owner, q.owner) and r.active
where p.status = 'settled'
  and not exists (select 1 from commissions c where c.payment_id = p.id);
