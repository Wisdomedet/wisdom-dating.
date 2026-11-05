-- WISDOM DATING database setup
-- Run this entire script in Supabase Dashboard > SQL Editor.
-- This starter assumes city-level discovery. It never stores or exposes precise GPS coordinates.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  age integer not null check (age >= 18 and age <= 100),
  city text not null check (char_length(city) between 1 and 80),
  area text not null check (char_length(area) between 1 and 80),
  bio text not null default '' check (char_length(bio) <= 500),
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.likes (
  liker_id uuid not null references public.profiles(id) on delete cascade,
  liked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (liker_id, liked_id),
  constraint no_self_like check (liker_id <> liked_id)
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  user_one uuid not null references public.profiles(id) on delete cascade,
  user_two uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint distinct_match_users check (user_one <> user_two),
  constraint ordered_match_users check (user_one < user_two),
  unique(user_one, user_two)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists profiles_city_idx on public.profiles (lower(city));
create index if not exists likes_liked_idx on public.likes (liked_id);
create index if not exists messages_match_created_idx on public.messages (match_id, created_at);

-- Automatically create a match when two users like each other.
create or replace function public.create_mutual_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  a uuid;
  b uuid;
begin
  if exists (
    select 1 from public.likes
    where liker_id = new.liked_id and liked_id = new.liker_id
  ) then
    a := least(new.liker_id, new.liked_id);
    b := greatest(new.liker_id, new.liked_id);
    insert into public.matches(user_one, user_two)
    values (a, b)
    on conflict (user_one, user_two) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists likes_create_mutual_match on public.likes;
create trigger likes_create_mutual_match
after insert or update on public.likes
for each row execute function public.create_mutual_match();

alter table public.profiles enable row level security;
alter table public.likes enable row level security;
alter table public.matches enable row level security;
alter table public.messages enable row level security;

-- Authenticated users can discover profiles. Users can only edit their own.
drop policy if exists "Authenticated users can view profiles" on public.profiles;
create policy "Authenticated users can view profiles"
on public.profiles for select to authenticated using (true);

drop policy if exists "Users insert own profile" on public.profiles;
create policy "Users insert own profile"
on public.profiles for insert to authenticated with check (auth.uid() = id);

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile"
on public.profiles for update to authenticated
using (auth.uid() = id) with check (auth.uid() = id);

-- A user can create a like as themselves and view likes involving themselves.
drop policy if exists "Users view likes involving them" on public.likes;
create policy "Users view likes involving them"
on public.likes for select to authenticated
using (auth.uid() = liker_id or auth.uid() = liked_id);

drop policy if exists "Users send own likes" on public.likes;
create policy "Users send own likes"
on public.likes for insert to authenticated
with check (auth.uid() = liker_id and liker_id <> liked_id);

drop policy if exists "Users remove own likes" on public.likes;
create policy "Users remove own likes"
on public.likes for delete to authenticated using (auth.uid() = liker_id);

-- Only the two matched users can see their match.
drop policy if exists "Users view own matches" on public.matches;
create policy "Users view own matches"
on public.matches for select to authenticated
using (auth.uid() = user_one or auth.uid() = user_two);

-- Match rows are created only by the trusted trigger, not directly by clients.
revoke insert, update, delete on public.matches from anon, authenticated;

-- Only participants in a match can read messages or send as themselves.
drop policy if exists "Matched users read messages" on public.messages;
create policy "Matched users read messages"
on public.messages for select to authenticated
using (
  exists (
    select 1 from public.matches m
    where m.id = match_id
      and (m.user_one = auth.uid() or m.user_two = auth.uid())
  )
);

drop policy if exists "Matched users send messages" on public.messages;
create policy "Matched users send messages"
on public.messages for insert to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.matches m
    where m.id = match_id
      and (m.user_one = auth.uid() or m.user_two = auth.uid())
  )
);

-- Enable realtime events for chat inserts.
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
when undefined_object then null;
end $$;
