-- Not every message is a sales lead.
--
-- The gallery gets people offering to SELL it work, press asking questions, and general
-- enquiries. Until now all of them landed on the sales board as leads, which inflates the
-- pipeline, wastes a salesperson's attention, and makes "value in play" a lie.
--
-- `kind` separates them at capture. The pipeline shows buying intent only; everything else
-- still gets answered, just somewhere it belongs.

alter table inquiries add column if not exists kind text not null default 'buying';
  -- buying | selling | press | other

create index if not exists inquiries_kind_idx on inquiries (kind, status);

-- Backfill from the purpose the website already collects.
update inquiries set kind =
  case
    when purpose ilike '%press%'   then 'press'
    when purpose ilike '%sell%'    then 'selling'
    when purpose ilike '%general%' then 'other'
    else 'buying'
  end
where kind = 'buying';

comment on column inquiries.kind is
  'buying = wants to acquire (the sales pipeline). selling = offering us work. press = media. other = everything else.';
