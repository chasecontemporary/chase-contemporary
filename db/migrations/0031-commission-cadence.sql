alter table commissions add column if not exists period date;
alter table commissions add column if not exists paid_at timestamptz;
alter table commissions add column if not exists invoice_id uuid references invoices(id);

-- Rep-attributed, cash-basis commission: when a payment settles, credit the salesperson
-- who owns the sale (sale.owner, else inquiry.owner) at their personal rate.
-- Period = the month the cash landed; payable 7 days after that month ends.
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
    v_owner := coalesce(v_inv.sale_owner, v_inv.inquiry_owner);
    if v_owner is not null then
      select pct into v_pct from commission_rules where person = v_owner and active limit 1;
      if v_pct is not null then
        insert into commissions (payment_id, invoice_id, person, pct, amount_cents, period)
        values (new.id, new.invoice_id, v_owner, v_pct,
                round(new.amount_cents * v_pct / 100.0),
                date_trunc('month', coalesce(new.settled_at, now()))::date);
      end if;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;
