-- =============================================================================
-- TalkMap — Schema inicial: profiles + slug + plano
-- =============================================================================
-- COMO USAR:
--   1. Abra o painel do seu Supabase → SQL Editor
--   2. Cole TODO o conteúdo deste arquivo
--   3. Clique em "Run"
--   4. Pronto — login/signup já vão funcionar no app
-- =============================================================================

-- 1) Enum de planos -----------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'plan_id') then
    create type public.plan_id as enum ('starter', 'pro', 'business');
  end if;
end$$;

-- 2) Tabela profiles ----------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  slug          text not null unique
                 check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$'),
  display_name  text,
  avatar_url    text,
  plan          public.plan_id not null default 'starter',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists profiles_slug_idx on public.profiles (slug);

-- 3) RLS ----------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_public" on public.profiles;
create policy "profiles_select_public"
  on public.profiles for select
  to anon, authenticated
  using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

-- 4) updated_at trigger -------------------------------------------------------
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

-- 5) Auto-criar profile no signup --------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_slug text;
  v_plan public.plan_id;
  v_display_name text;
begin
  v_slug := lower(coalesce(new.raw_user_meta_data ->> 'slug', ''));
  v_plan := coalesce((new.raw_user_meta_data ->> 'plan')::public.plan_id, 'starter');
  v_display_name := coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1));

  if v_slug = '' then
    v_slug := regexp_replace(split_part(new.email, '@', 1), '[^a-z0-9-]', '-', 'g');
  end if;

  insert into public.profiles (id, slug, display_name, plan)
  values (new.id, v_slug, v_display_name, v_plan);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 6) Checagem de slug disponível (RPC chamado pelo signup) -------------------
create or replace function public.is_slug_available(p_slug text)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.profiles where slug = lower(p_slug));
$$;

grant execute on function public.is_slug_available(text) to anon, authenticated;
