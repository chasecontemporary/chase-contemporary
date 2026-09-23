-- The publishing queue drains on a schedule, not only when somebody presses the button. Twenty
-- works a run, every two minutes: the whole backlog of 1,255 clears in about two hours once
-- Bernie starts approving, and a queued work never waits on a person remembering to push it.
-- Same pattern as 0043: the bearer secret is substituted at apply time, never committed.
select cron.unschedule(jobname) from cron.job where jobname = 'engine-publish';
select cron.schedule('engine-publish', '*/2 * * * *', $$
  select net.http_get(
    url := 'https://chase-engine.vercel.app/api/cron/publish?limit=20',
    headers := '{"Authorization": "Bearer __CRON_SECRET__"}'::jsonb,
    timeout_milliseconds := 55000)
$$);
