-- Welcome bonus flag + quests for chess.
alter table chess_stats add column if not exists welcome_claimed boolean not null default false;

create table if not exists chess_quests (
  user_id uuid not null references profiles(id) on delete cascade,
  quest_id text not null,
  claimed_at timestamptz not null default now(),
  primary key (user_id, quest_id)
);
alter table chess_quests enable row level security;
drop policy if exists "chess_quests self" on chess_quests;
create policy "chess_quests self" on chess_quests
  for all using (auth.uid() = user_id);

-- Claim welcome bonus (+50 XP, one time). Returns true if newly granted.
create or replace function chess_claim_welcome()
returns boolean language plpgsql security definer as $$
declare already boolean;
begin
  select welcome_claimed into already from chess_stats where user_id = auth.uid();
  if already then return false; end if;
  insert into chess_stats (user_id, xp, welcome_claimed)
    values (auth.uid(), 50, true)
    on conflict (user_id) do update set
      xp = chess_stats.xp + 50,
      welcome_claimed = true;
  return true;
end $$;
revoke all on function chess_claim_welcome() from public;
revoke all on function chess_claim_welcome() from anon;
grant execute on function chess_claim_welcome() to authenticated;

-- Claim a quest (+20 XP each, one time per quest).
-- quest_id: 'play_1' | 'win_1' | 'join_room'
create or replace function chess_claim_quest(p_quest_id text)
returns boolean language plpgsql security definer as $$
declare done_ok boolean := false;
begin
  if p_quest_id = 'play_1' then
    select exists (select 1 from chess_games where user_id = auth.uid()) into done_ok;
  elsif p_quest_id = 'win_1' then
    select exists (select 1 from chess_games where user_id = auth.uid() and result = 'win') into done_ok;
  elsif p_quest_id = 'join_room' then
    select exists (select 1 from chess_room_members where user_id = auth.uid()) into done_ok;
  else
    return false;
  end if;
  if not done_ok then return false; end if;
  insert into chess_quests (user_id, quest_id) values (auth.uid(), p_quest_id)
    on conflict do nothing;
  if found then
    insert into chess_stats (user_id, xp) values (auth.uid(), 20)
      on conflict (user_id) do update set xp = chess_stats.xp + 20;
    return true;
  end if;
  return false;
end $$;
revoke all on function chess_claim_quest(text) from public;
revoke all on function chess_claim_quest(text) from anon;
grant execute on function chess_claim_quest(text) to authenticated;
