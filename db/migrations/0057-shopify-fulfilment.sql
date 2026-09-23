-- Which Shopify fulfilments the engine created for an order, so a refund can cancel them and a
-- second press cannot create a duplicate.
alter table shopify_orders add column if not exists fulfillment_ids bigint[];
comment on column shopify_orders.fulfillment_ids is
  'Fulfilments the engine raised on Shopify for this order, set when a shipment is marked shipped.';
