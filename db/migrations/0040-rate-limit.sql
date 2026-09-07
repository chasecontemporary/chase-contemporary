-- Rate limiting for the endpoints anyone on the internet can reach.
--
-- Kept in Postgres rather than memory because the app runs as serverless functions: an
-- in-memory counter resets on every cold start and is per-instance, so an attacker just
-- gets a fresh allowance each time. One row per caller per window, counted atomically.

create table if not exists rate_limits (
  bucket text not null,          -- e.g. 'login:203.0.113.9'
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (bucket, window_start)
);

create index if not exists rate_limits_window_idx on rate_limits (window_start);

-- Returns the number of hits in the current window INCLUDING this one, so the caller can
-- simply compare against its limit. Atomic: concurrent requests cannot both read a stale
-- count and slip through.
create or replace function bump_rate_limit(p_bucket text, p_window_seconds int)
returns int
language plpgsql
as $$
declare
  v_start timestamptz;
  v_hits  int;
begin
  -- floor the clock to the window so every caller in the same period shares a row
  v_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into rate_limits (bucket, window_start, hits)
       values (p_bucket, v_start, 1)
  on conflict (bucket, window_start)
    do update set hits = rate_limits.hits + 1
    returning hits into v_hits;

  -- opportunistic cleanup so the table cannot grow without bound
  if random() < 0.01 then
    delete from rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_hits;
end;
$$;
