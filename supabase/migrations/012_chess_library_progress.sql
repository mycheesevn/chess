-- Playbook library progress (shared with PacClone on this project).
-- The table already exists in the shared database (created for
-- Xiangqi); this migration is idempotent and only ensures the table
-- and an own-rows policy exist. Chess lesson ids are prefixed
-- "chess-" so they never collide with Xiangqi lesson ids.

create table if not exists library_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id text not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

alter table library_progress enable row level security;

drop policy if exists "Chess users manage own library progress" on library_progress;
create policy "Chess users manage own library progress"
  on library_progress for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
