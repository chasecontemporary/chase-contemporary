-- Finishing the engine: three internal holes that can quietly corrupt the books.
--
-- 1) Balances were summed in JavaScript from a payments fetch capped at 1,000 rows, so
--    once the gallery passes a thousand payments the money on screen starts drifting.
--    Compute it in the database instead, where there is no cap.
create or replace view invoice_balances as
  select i.id                                                  as invoice_id,
         i.invoice_number,
         i.collector_id,
         i.status,
         i.ar_status,
         i.issued_at,
         i.paid_at,
         i.amount_cents + coalesce(i.tax_cents,0) + coalesce(i.shipping_cents,0) as total_cents,
         coalesce(p.received_cents, 0)                          as received_cents,
         greatest(i.amount_cents + coalesce(i.tax_cents,0) + coalesce(i.shipping_cents,0)
                  - coalesce(p.received_cents,0), 0)            as balance_cents
    from invoices i
    left join (
      select invoice_id, sum(amount_cents)::bigint as received_cents
        from payments
       where status = 'settled' and invoice_id is not null
       group by invoice_id
    ) p on p.invoice_id = i.id;

-- 2) Creating an invoice is six writes (sale, items, status, invoice, lines, lead stage).
--    A failure midway left a sale marked 'invoiced' with no invoice — invisible on every
--    screen, so the sale simply vanished. One function, one transaction: all or nothing.
create or replace function create_manual_invoice(
  p_collector_id uuid,
  p_lines        jsonb,      -- [{kind, artwork_id, title, artist, amount_cents}]
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
        insert into sale_items (sale_id, artwork_id, title, artist, agreed_cents)
        values (v_sale_id, (v_line->>'artwork_id')::uuid, v_line->>'title',
                v_line->>'artist', (v_line->>'amount_cents')::bigint);
      end if;
    end loop;
  end if;

  insert into invoices (collector_id, sale_id, title, artist,
                        amount_cents, tax_cents, shipping_cents, due_at, notes)
  values (p_collector_id, v_sale_id,
          case when v_works > 1 then v_works || ' works' else coalesce(v_title, 'Sale') end,
          case when v_works = 1 then v_artist else null end,
          v_art, v_tax, v_ship, p_due, 'manual invoice')
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

-- 3) "Mark paid in full" was the only action with no way back: it books the payment, flips
--    artworks to sold, writes purchases, closes leads and triggers commissions. One misclick
--    was permanent. This unwinds exactly that, in one transaction.
create or replace function unsettle_invoice(p_invoice_id uuid)
returns void
language plpgsql
as $$
declare
  v_sale_id uuid;
begin
  select sale_id into v_sale_id from invoices where id = p_invoice_id;

  delete from commissions where payment_id in
    (select id from payments where invoice_id = p_invoice_id);
  delete from payments where invoice_id = p_invoice_id;

  if v_sale_id is not null then
    -- put the works back on the shelf and remove the purchase records they created
    update artworks set available = true
     where id in (select artwork_id from sale_items where sale_id = v_sale_id and artwork_id is not null);
    delete from purchases
     where collector_id = (select collector_id from invoices where id = p_invoice_id)
       and artwork_id in (select artwork_id from sale_items where sale_id = v_sale_id and artwork_id is not null)
       and source = 'engine';
    update sales set status = 'invoiced' where id = v_sale_id;
    update inquiries set status = 'invoice'
     where id in (select inquiry_id from sale_items where sale_id = v_sale_id and inquiry_id is not null);
  end if;

  update invoices set status = 'open', paid_at = null, method = null where id = p_invoice_id;
end;
$$;
