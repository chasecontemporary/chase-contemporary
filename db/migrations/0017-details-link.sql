alter table collectors
  add column if not exists details_token text unique,
  add column if not exists details_requested_at timestamptz,
  add column if not exists details_completed_at timestamptz;
