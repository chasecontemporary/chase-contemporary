alter table purchases add column if not exists artcloud_key text;
create unique index if not exists purchases_artcloud_key_uq on purchases(artcloud_key);
alter table collectors add column if not exists job_title text;
