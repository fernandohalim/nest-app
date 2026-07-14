-- merge_quick_splits
-- ---------------------------------------------------------------------------
-- Atomically merges one or more quick splits (expenses with trip_id IS NULL)
-- into a trip — either a brand-new trip or an existing one — and re-parents
-- the expense rows so they leave the receipts list and appear in the trip.
--
-- The client resolves member identity BEFORE calling this and passes:
--   * p_new_members  : members to INSERT into the trip (client-generated uuids)
--   * p_expenses     : per-expense, the already-remapped member-keyed JSON
--                      (paid_by / owed_by / adjustments / items). settled_shares
--                      is intentionally reset to null on merge.
--
-- Security model: RLS is OFF on these tables, so this function runs as the
-- caller (SECURITY INVOKER, the default) and manually guards every source
-- expense with created_by = auth.uid(). A user can only ever merge their own
-- quick splits, and only into a trip they own.
--
-- Atomicity: the whole thing runs in the function's implicit transaction, so
-- any RAISE rolls back trip creation, member inserts, and every expense update
-- together. FOR UPDATE locks each source row so the daily
-- cleanup-ephemeral-expenses cron can't delete a row mid-merge.
-- ---------------------------------------------------------------------------

create or replace function public.merge_quick_splits(
  p_target_trip_id uuid,   -- null => create a new trip from p_new_trip
  p_new_trip jsonb,        -- { name, currency, owner_name } — used when creating
  p_new_members jsonb,     -- [{ id, name }, ...] members to insert into the trip
  p_expenses jsonb         -- [{ id, paid_by, owed_by, adjustments, items }, ...]
) returns uuid
language plpgsql
set search_path = public  -- pin (not '') so triggers on members/trips that use
                          -- unqualified names still resolve when fired from here
as $$
declare
  v_uid   uuid := auth.uid();
  v_trip  uuid;
  v_owner uuid;
  m       jsonb;
  e       jsonb;
  v_created_by uuid;
  v_trip_id    uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- 1. resolve the target trip -------------------------------------------------
  if p_target_trip_id is null then
    v_trip := gen_random_uuid();
    insert into public.trips
      (id, name, date, currency, created_at, updated_at, owner_id, owner_name, status)
    values (
      v_trip,
      coalesce(nullif(trim(p_new_trip->>'name'), ''), 'merged trip'),
      to_char(now(), 'YYYY-MM-DD'),
      coalesce(nullif(p_new_trip->>'currency', ''), 'IDR'),
      now(),
      now(),
      v_uid,
      coalesce(nullif(p_new_trip->>'owner_name', ''), 'me'),
      'ongoing'
    );
  else
    select owner_id into v_owner from public.trips where id = p_target_trip_id;
    if not found then
      raise exception 'target trip not found';
    end if;
    if v_owner is distinct from v_uid then
      raise exception 'not your trip';
    end if;
    v_trip := p_target_trip_id;
    -- keep the trip out of reach of the stale-trip reaper and reflect activity
    update public.trips set updated_at = now() where id = v_trip;
  end if;

  -- 2. insert the newly-resolved members --------------------------------------
  if p_new_members is not null and jsonb_typeof(p_new_members) = 'array' then
    for m in select * from jsonb_array_elements(p_new_members)
    loop
      insert into public.members (id, trip_id, name)
      values ((m->>'id')::uuid, v_trip, m->>'name');
    end loop;
  end if;

  -- 3. re-parent each quick split ---------------------------------------------
  for e in select * from jsonb_array_elements(p_expenses)
  loop
    select created_by, trip_id
      into v_created_by, v_trip_id
      from public.expenses
     where id = (e->>'id')::uuid
     for update;

    if not found then
      raise exception 'expense % not found', e->>'id';
    end if;
    if v_created_by is distinct from v_uid then
      raise exception 'expense % is not yours', e->>'id';
    end if;
    if v_trip_id is not null then
      raise exception 'expense % is already in a trip', e->>'id';
    end if;

    update public.expenses set
      trip_id        = v_trip,
      paid_by        = e->'paid_by',
      owed_by        = e->'owed_by',
      adjustments    = nullif(e->'adjustments', 'null'::jsonb),
      items          = nullif(e->'items', 'null'::jsonb),
      settled_shares = null,
      ephemeral_members = null
    where id = (e->>'id')::uuid;
  end loop;

  return v_trip;
end;
$$;

grant execute on function public.merge_quick_splits(uuid, jsonb, jsonb, jsonb) to authenticated;
