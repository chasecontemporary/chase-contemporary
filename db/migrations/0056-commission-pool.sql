-- Commission as a pool, not a personal rate.
--
-- The old model paid the person who closed the deal their own percentage. The gallery's actual
-- arrangement is different: every sale generates one commission pool, a percentage of what the
-- collector paid, and that pool is divided between the people in it on agreed shares, settled
-- monthly. Nobody has a personal rate; there is one rate and a split.
--
-- Two tables so both halves can change without touching code, and both are dated so a change
-- never rewrites what was already earned:
--   commission_plan    how much of a payment becomes commission at all
--   commission_shares  who divides it, and in what proportion
--
-- Commission accrues on money RECEIVED, not on money invoiced. A deposit earns its share when
-- it lands and the balance earns the rest when that lands, so nobody is paid on a sale that
-- later falls over.

create table if not exists commission_plan (
  id uuid primary key default gen_random_uuid(),
  pool_pct numeric not null check (pool_pct >= 0 and pool_pct <= 100),
  effective_from date not null default current_date,
  note text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists commission_shares (
  id uuid primary key default gen_random_uuid(),
  person text not null,
  share_pct numeric not null check (share_pct >= 0 and share_pct <= 100),
  effective_from date not null default current_date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table commission_plan enable row level security;
alter table commission_shares enable row level security;

-- What the row was actually computed from, so a statement can always be explained
alter table commissions add column if not exists pool_cents bigint;
alter table commissions add column if not exists share_pct numeric;
alter table commissions add column if not exists pool_pct numeric;
alter table commissions add column if not exists paid_at timestamptz;
alter table commissions add column if not exists paid_note text;
create index if not exists commissions_period_idx on commissions (period, person);

-- The arrangement as it stands. Both are editable on the Commissions page; these are only the
-- starting values so the machine is never running with nothing set.
insert into commission_plan (pool_pct, note)
select 15, 'Fifteen percent of every payment received becomes the commission pool.'
where not exists (select 1 from commission_plan where active);

-- Every settled payment writes one row per person in the pool.
create or replace function compute_commissions() returns trigger as $$
declare
  v_pool_pct numeric;
  v_pool_cents bigint;
  v_period date;
  v_share record;
begin
  if new.status = 'settled' and (old.status is distinct from 'settled') and new.invoice_id is not null then
    v_period := date_trunc('month', coalesce(new.settled_at, now()))::date;

    select pool_pct into v_pool_pct
      from commission_plan
     where active and effective_from <= coalesce(new.settled_at::date, current_date)
     order by effective_from desc limit 1;

    if v_pool_pct is null or v_pool_pct = 0 then
      return new;                                  -- no arrangement set: earn nothing, silently
    end if;

    v_pool_cents := round(new.amount_cents * v_pool_pct / 100.0);

    for v_share in
      select person, share_pct from commission_shares
       where active and effective_from <= coalesce(new.settled_at::date, current_date)
    loop
      insert into commissions (payment_id, invoice_id, person, pct, amount_cents, period,
                               pool_cents, pool_pct, share_pct)
      values (new.id, new.invoice_id, v_share.person,
              round(v_pool_pct * v_share.share_pct / 100.0, 4),
              round(v_pool_cents * v_share.share_pct / 100.0),
              v_period, v_pool_cents, v_pool_pct, v_share.share_pct);
    end loop;
  end if;
  return new;
end;
$$ language plpgsql;

-- What each person is owed, by month, and what has been paid out. This is the statement.
create or replace view commission_statement as
select c.person,
       c.period,
       count(*)                                          as payments,
       sum(c.amount_cents)                               as amount_cents,
       sum(c.amount_cents) filter (where c.settled)      as paid_cents,
       sum(c.amount_cents) filter (where not c.settled)  as owed_cents,
       min(c.created_at)                                 as first_at,
       max(c.created_at)                                 as last_at
  from commissions c
 group by c.person, c.period;

comment on view commission_statement is
  'What each person earned in each month, and how much of it has been paid out. The monthly split.';
comment on table commission_plan is
  'How much of every payment received becomes the commission pool. Dated, so a change never rewrites what was already earned.';
comment on table commission_shares is
  'Who divides the pool and in what proportion. Shares should total 100.';
