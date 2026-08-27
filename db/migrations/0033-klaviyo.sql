alter table audiences add column if not exists klaviyo_list_id text;
alter table audiences add column if not exists synced_at timestamptz;
alter table audiences add column if not exists synced_count int;
alter table campaigns add column if not exists klaviyo_campaign_id text;
alter table campaigns add column if not exists pushed_at timestamptz;
