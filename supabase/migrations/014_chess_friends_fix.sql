-- 014_chess_friends_fix.sql
--
-- Fix the Friends feature to match PacClone's working implementation.
--
-- Root causes fixed:
--   1. Challenges now carry the room code: the challenged player is NOT a
--      room member yet and rooms RLS hides the private room from them, so
--      resolving the room through a join silently fails. `room_code` is
--      denormalized onto chess_challenges (PacClone's challenge_room_code.sql
--      pattern; the client also falls back gracefully if the column is
--      missing).
--   2. The old "chess_challenges party" policy was a bare `for all using(...)`
--      with no WITH CHECK, so INSERTs were unrestricted. Replaced with
--      PacClone-style select/insert/update policies.
--   3. `status` now has a CHECK constraint (idempotent).
--
-- All statements are idempotent (add column if not exists / drop policy if
-- exists / duplicate_object-tolerant). Run in the Dashboard SQL editor.

-- 1. Denormalized room code on challenges.
alter table chess_challenges
  add column if not exists room_code text;

create index if not exists chess_challenges_challenged_idx
  on chess_challenges (challenged_id, created_at desc);

-- 2. Status CHECK (idempotent).
do $$ begin
  alter table chess_challenges
    add constraint chess_challenges_status_check
    check (status in ('pending', 'accepted', 'declined'));
exception when duplicate_object then null;
end $$;

-- 3. PacClone-style policies (replace the loose party policy).
drop policy if exists "chess_challenges party" on chess_challenges;
drop policy if exists "chess_challenges select party" on chess_challenges;
create policy "chess_challenges select party" on chess_challenges
  for select to authenticated
  using (auth.uid() = challenger_id or auth.uid() = challenged_id);
drop policy if exists "chess_challenges insert" on chess_challenges;
create policy "chess_challenges insert" on chess_challenges
  for insert to authenticated
  with check (auth.uid() = challenger_id and auth.uid() != challenged_id);
drop policy if exists "chess_challenges update" on chess_challenges;
create policy "chess_challenges update" on chess_challenges
  for update to authenticated
  using (auth.uid() = challenged_id)
  with check (auth.uid() = challenged_id);
