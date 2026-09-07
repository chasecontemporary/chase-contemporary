-- Purge every synthetic record from the live database.
--
-- Covers the Bernie demo cast (seeded 8/28) and the resilience test leads (9/5), all of
-- which live on the synthetic @import.chasecontemporary.com domain and are excluded from
-- every audience. Run this once the system is carrying real business — demo rows on a
-- live system inflate the numbers and mislead the floor.
--
-- The Artcloud import also used that domain for pooled historical rows, so this is
-- deliberately scoped to the demo-/test-prefixed addresses ONLY, never the whole domain.

begin;

create temp table doomed as
  select id from collectors
  where email like 'demo-%@import.chasecontemporary.com'
     or email in (
       'resilience-test@import.chasecontemporary.com',
       'browser-proof@import.chasecontemporary.com',
       'browser-newsletter@import.chasecontemporary.com',
       'journey-test@import.chasecontemporary.com',
       'test@dvn.design'
     );

create temp table doomed_inv as select id from invoices where collector_id in (select id from doomed);
create temp table doomed_sale as select id from sales    where collector_id in (select id from doomed);
create temp table doomed_inq  as select id from inquiries where collector_id in (select id from doomed);

-- put back any real artwork a demo settlement marked sold
update artworks set available = true
 where id in (select artwork_id from purchases
              where collector_id in (select id from doomed) and artwork_id is not null);

delete from commissions      where invoice_id in (select id from doomed_inv);
delete from payments         where invoice_id in (select id from doomed_inv);
delete from invoice_lines    where invoice_id in (select id from doomed_inv);
delete from invoices         where id         in (select id from doomed_inv);
delete from sale_items       where sale_id    in (select id from doomed_sale);
delete from sales            where id         in (select id from doomed_sale);
delete from offer_responses  where offer_id   in (select id from offers where collector_id in (select id from doomed));
delete from offers           where collector_id in (select id from doomed);
delete from holds            where collector_id in (select id from doomed);
delete from site_events      where collector_id in (select id from doomed)
                                or visitor_id like 'v-demo%' or visitor_id like 'v-golive%'
                                or visitor_id like 'v-resilience%' or visitor_id like 'v-testjourney%';
delete from visitor_links    where collector_id in (select id from doomed);
delete from purchases        where collector_id in (select id from doomed);
delete from collector_interests where collector_id in (select id from doomed);
delete from activities       where entity_id in (select id from doomed)
                                or entity_id in (select id from doomed_inq)
                                or entity_id in (select id from doomed_inv);
delete from inquiries        where id in (select id from doomed_inq);
delete from collectors       where id in (select id from doomed);

select (select count(*) from collectors where email like '%@import.chasecontemporary.com'
          and (email like 'demo-%' or email like '%test%')) as synthetic_left;

commit;
