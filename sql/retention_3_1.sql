-- retention_3_1
-- ---------------------------------------------------------------------------
-- 3.1 retention model: one rule for trips and quick splits.
--
--   * anything NOT kept auto-deletes after 7 days
--       - trips:        7 days since last activity (updated_at)
--       - quick splits: 7 days since retention_from (created_at, or the moment
--                       it was un-kept, so "stop keeping" restarts the clock)
--   * anything kept (is_kept = true) is never touched by the cleanup crons
--
-- The old trips.status ('ongoing' / 'finished') is gone. It used to double as
-- the "save permanently" switch; every 'finished' trip is backfilled to kept so
-- nothing that was promised permanent storage gets reaped.
--
-- A merged quick split follows its trip's rule, so merge_quick_splits resets
-- expenses.is_kept to false when re-parenting (see merge_quick_splits.sql).
-- ---------------------------------------------------------------------------

-- 1. trips: is_kept, backfilled from the old settled status, then drop status
alter table public.trips
  add column if not exists is_kept boolean not null default false;

update public.trips set is_kept = true where status = 'finished';

alter table public.trips drop column if exists status;

-- 2. trips: any change to the trip row itself (rename, currency, collaborative,
--    keep/stop keeping) counts as activity. Before this, only expense/member
--    writes bumped updated_at, so un-settling a long-idle trip got it reaped at
--    the next midnight run.
create or replace function public.touch_trips_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- a nickname change rewrites owner_name on every owned trip; that isn't
  -- trip activity, so it must not reset the 7-day retention countdown.
  if (to_jsonb(new) - 'owner_name' - 'updated_at')
     = (to_jsonb(old) - 'owner_name' - 'updated_at')
     and new.updated_at is not distinct from old.updated_at then
    return new;
  end if;
  -- callers that set updated_at explicitly (expense/member triggers, merge)
  -- keep their value; any other real change counts as activity.
  if new.updated_at is not distinct from old.updated_at then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trips_touch_updated_at on public.trips;
create trigger trips_touch_updated_at
  before update on public.trips
  for each row execute function public.touch_trips_updated_at();

-- 3. expenses: is_kept + retention_from (the quick-split countdown anchor)
alter table public.expenses
  add column if not exists is_kept boolean not null default false;

alter table public.expenses
  add column if not exists retention_from timestamptz;

update public.expenses
   set retention_from = coalesce(created_at, now())
 where retention_from is null;

alter table public.expenses
  alter column retention_from set default now(),
  alter column retention_from set not null;

-- 4. cleanup crons (same names, so cron.schedule replaces the old commands)
select cron.schedule(
  'cleanup-stale-trips',
  '0 0 * * *',
  $$ delete from public.trips
      where is_kept = false
        and updated_at < now() - interval '7 days' $$
);

select cron.schedule(
  'cleanup-ephemeral-expenses',
  '0 0 * * *',
  $$ delete from public.expenses
      where trip_id is null
        and is_kept = false
        and retention_from < now() - interval '7 days' $$
);
