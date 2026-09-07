-- The full stack: what the engine needs on the record side for email, SMS, DocuSign,
-- Shopify sold-sync, next actions, and the D1 fix from the 9/7 sales readiness pass.

-- ---------------------------------------------------------------------------------
-- D1. A paid sale never closed the lead. create_manual_invoice stored no inquiry_id on
--     the invoice or the sale item, so closeOutInvoice had nothing to move. Now both carry
--     it, and unsettle_invoice unwinds by the same key.
-- ---------------------------------------------------------------------------------
create or replace function create_manual_invoice(
  p_collector_id uuid,
  p_lines        jsonb,
  p_owner        text,
  p_due          date default null,
  p_inquiry_id   uuid default null
) returns invoices
language plpgsql
as $$
declare
  v_sale_id uuid;
  v_line    jsonb;
  v_art     bigint := 0;
  v_ship    bigint := 0;
  v_tax     bigint := 0;
  v_title   text;
  v_artist  text;
  v_works   int := 0;
  v_inv     invoices;
  v_sort    int := 0;
begin
  if p_collector_id is null then
    raise exception 'Choose a collector from the list before creating the invoice.';
  end if;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    if (v_line->>'amount_cents')::bigint < 0 then
      raise exception 'An amount is negative. Check the line items.';
    end if;
    case v_line->>'kind'
      when 'shipping' then v_ship := v_ship + (v_line->>'amount_cents')::bigint;
      when 'tax'      then v_tax  := v_tax  + (v_line->>'amount_cents')::bigint;
      else                 v_art  := v_art  + (v_line->>'amount_cents')::bigint;
    end case;
    if v_line->>'kind' = 'work' and v_line->>'artwork_id' is not null then
      v_works := v_works + 1;
      if v_title is null then
        v_title  := v_line->>'title';
        v_artist := v_line->>'artist';
      end if;
    end if;
  end loop;

  if v_works > 0 then
    insert into sales (collector_id, owner, status) values (p_collector_id, p_owner, 'invoiced')
      returning id into v_sale_id;
    for v_line in select * from jsonb_array_elements(p_lines) loop
      if v_line->>'kind' = 'work' and v_line->>'artwork_id' is not null then
        insert into sale_items (sale_id, inquiry_id, artwork_id, title, artist, agreed_cents)
        values (v_sale_id, p_inquiry_id, (v_line->>'artwork_id')::uuid, v_line->>'title',
                v_line->>'artist', (v_line->>'amount_cents')::bigint);
      end if;
    end loop;
  end if;

  insert into invoices (collector_id, sale_id, inquiry_id, title, artist,
                        amount_cents, tax_cents, shipping_cents, due_at, notes)
  values (p_collector_id, v_sale_id, p_inquiry_id,
          case when v_works > 1 then v_works || ' works' else coalesce(v_title, 'Sale') end,
          case when v_works = 1 then v_artist else null end,
          v_art, v_tax, v_ship, coalesce(p_due, current_date + 7), 'manual invoice')
  returning * into v_inv;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    insert into invoice_lines (invoice_id, kind, artwork_id, title, artist, amount_cents, sort)
    values (v_inv.id, v_line->>'kind',
            nullif(v_line->>'artwork_id','')::uuid, v_line->>'title', v_line->>'artist',
            (v_line->>'amount_cents')::bigint, v_sort);
    v_sort := v_sort + 1;
  end loop;

  if p_inquiry_id is not null then
    update inquiries set status = 'invoice', stage_changed_at = now() where id = p_inquiry_id;
  end if;

  return v_inv;
end;
$$;

create or replace function unsettle_invoice(p_invoice_id uuid)
returns void
language plpgsql
as $$
declare
  v_sale_id uuid;
  v_inq_id  uuid;
begin
  select sale_id, inquiry_id into v_sale_id, v_inq_id from invoices where id = p_invoice_id;

  delete from commissions where payment_id in
    (select id from payments where invoice_id = p_invoice_id);
  delete from payments where invoice_id = p_invoice_id;

  if v_sale_id is not null then
    update artworks set available = true
     where id in (select artwork_id from sale_items where sale_id = v_sale_id and artwork_id is not null);
    delete from purchases
     where collector_id = (select collector_id from invoices where id = p_invoice_id)
       and artwork_id in (select artwork_id from sale_items where sale_id = v_sale_id and artwork_id is not null)
       and source = 'engine';
    update sales set status = 'invoiced' where id = v_sale_id;
    update inquiries set status = 'invoice', stage_changed_at = now()
     where id in (select inquiry_id from sale_items where sale_id = v_sale_id and inquiry_id is not null);
  end if;
  if v_inq_id is not null then
    update inquiries set status = 'invoice', stage_changed_at = now() where id = v_inq_id;
  end if;

  update invoices set status = 'open', paid_at = null, method = null where id = p_invoice_id;
end;
$$;

-- ---------------------------------------------------------------------------------
-- Leads: a next action with a date, and a real way to lose one.
-- ---------------------------------------------------------------------------------
alter table inquiries add column if not exists next_action_at date;
alter table inquiries add column if not exists next_action text;
alter table inquiries add column if not exists lost_reason text;
alter table inquiries add column if not exists lost_at timestamptz;
alter table inquiries add column if not exists escalated_at timestamptz;   -- floor was told twice
create index if not exists inquiries_next_action_idx on inquiries (next_action_at) where next_action_at is not null;

-- ---------------------------------------------------------------------------------
-- Invoices: when it was actually sent, what deposit is expected.
-- ---------------------------------------------------------------------------------
alter table invoices add column if not exists sent_at timestamptz;
alter table invoices add column if not exists deposit_cents bigint;

-- ---------------------------------------------------------------------------------
-- Team: a phone so a rep can be texted when a lead lands.
-- ---------------------------------------------------------------------------------
alter table team_members add column if not exists phone text;

-- ---------------------------------------------------------------------------------
-- Every message the engine sends, on the record. Email, SMS, Slack. The collector card
-- shows these; the audit trail has them; a bounce or failure is visible, not silent.
-- ---------------------------------------------------------------------------------
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  channel text not null,                 -- email | sms | slack
  template text,                         -- first_reply | invoice | details_link | selection | receipt | alert | digest | custom
  to_addr text,
  subject text,
  body text,                             -- plain text or html
  collector_id uuid references collectors(id),
  entity_type text,                      -- inquiry | invoice | offer | artwork
  entity_id uuid,
  provider text,                         -- resend | twilio | slack
  provider_id text,
  status text not null default 'queued', -- queued | sent | failed | bounced | delivered
  error text,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists messages_collector_idx on messages (collector_id, created_at desc);
create index if not exists messages_entity_idx on messages (entity_type, entity_id);
alter table messages enable row level security;

-- ---------------------------------------------------------------------------------
-- Documents: everything a collector signs or receives, with its DocuSign envelope.
-- ---------------------------------------------------------------------------------
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  kind text not null,                    -- invoice | coa | tearsheet | purchase_agreement | approval | consignment
  collector_id uuid references collectors(id),
  invoice_id uuid references invoices(id),
  sale_id uuid references sales(id),
  artwork_id uuid references artworks(id),
  pdf_url text,
  envelope_id text unique,
  status text not null default 'draft',  -- draft | sent | delivered | completed | declined | voided
  sent_at timestamptz,
  viewed_at timestamptz,
  signed_at timestamptz,
  signed_pdf_url text,
  signer_email text,
  signer_name text,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists documents_collector_idx on documents (collector_id, created_at desc);
create index if not exists documents_invoice_idx on documents (invoice_id);
alter table documents enable row level security;

-- ---------------------------------------------------------------------------------
-- Artworks: what the website currently says about a work, so sold-sync is idempotent.
-- ---------------------------------------------------------------------------------
alter table artworks add column if not exists site_status text;   -- live | hidden | sold (as pushed to Shopify)
