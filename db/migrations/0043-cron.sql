-- Scheduling lives in Postgres (pg_cron + pg_net), not on Vercel: the Hobby plan only
-- allows daily crons and the unclaimed-lead escalation must run every ten minutes.
-- The bearer secret is substituted at apply time from CRON_SECRET; never committed.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobname) from cron.job where jobname in ('engine-escalate', 'engine-digest');

select cron.schedule('engine-escalate', '*/10 * * * *', $$
  select net.http_get(
    url := 'https://chase-engine.vercel.app/api/cron/escalate',
    headers := '{"Authorization": "Bearer __CRON_SECRET__"}'::jsonb,
    timeout_milliseconds := 20000)
$$);

-- 12:00 UTC = 08:00 New York (EDT); Monday to Saturday
select cron.schedule('engine-digest', '0 12 * * 1-6', $$
  select net.http_get(
    url := 'https://chase-engine.vercel.app/api/cron/digest',
    headers := '{"Authorization": "Bearer __CRON_SECRET__"}'::jsonb,
    timeout_milliseconds := 60000)
$$);
