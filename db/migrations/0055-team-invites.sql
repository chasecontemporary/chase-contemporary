-- When each person was last invited into the engine, so the Team page can say "invited three
-- days ago, still not signed in" rather than leaving somebody to guess. Whether they have
-- actually signed in is read live from Clerk, not stored here, because a stale copy of that is
-- worse than no copy.
alter table team_members add column if not exists invited_at timestamptz;
comment on column team_members.invited_at is
  'Last time this person was sent a sign-in invitation. Whether they accepted is read from Clerk.';
