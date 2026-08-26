# Chase CRM / Engine

Env (Vercel): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SLACK_WEBHOOK_URL (optional)

- `POST /api/inquiry` — accepts the site's inquiry/contact payload; upserts collector by email,
  inserts inquiry + activity, pings Slack with repeat-collector flag.
- Schema: ../db/migrations/0001_init.sql
