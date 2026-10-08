-- 3.2: bookmark someone else's quick-split receipt (mirrors user_trips).
-- a bookmark is just a shortcut on the saver's home list — it never keeps
-- the receipt alive. when the creator's receipt is reaped / deleted / merged
-- the row cascades away (merge sets trip_id; the home fetch filters on
-- trip_id is null, so merged receipts drop off saved lists too).

create table if not exists public.user_receipts (
  user_id    uuid not null references auth.users(id) on delete cascade,
  expense_id uuid not null references public.expenses(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, expense_id)
);

create index if not exists user_receipts_expense_id_idx
  on public.user_receipts (expense_id);

alter table public.user_receipts enable row level security;

create policy "own bookmarks: select" on public.user_receipts
  for select to authenticated using (user_id = (select auth.uid()));
create policy "own bookmarks: insert" on public.user_receipts
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own bookmarks: delete" on public.user_receipts
  for delete to authenticated using (user_id = (select auth.uid()));
