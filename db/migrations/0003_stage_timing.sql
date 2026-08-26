alter table inquiries add column if not exists stage_changed_at timestamptz not null default now();
update inquiries set stage_changed_at = created_at where stage_changed_at is null;