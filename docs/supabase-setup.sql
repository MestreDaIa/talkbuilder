-- =============================================================================
-- TalkMap — Schema completo
-- =============================================================================
-- COMO USAR:
--   1. Abra o painel do seu Supabase → SQL Editor
--   2. Cole TODO o conteúdo deste arquivo
--   3. Clique em "Run"
--   4. Pronto — login/signup, perfil, pastas, bots, empresa e workspace
--      passam a funcionar no app
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
  -- campos editáveis no /workspace/perfil
  phone         text,
  location      text,
  job_title     text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- garantir colunas se a tabela já existia de versão antiga
alter table public.profiles add column if not exists phone     text;
alter table public.profiles add column if not exists location  text;
alter table public.profiles add column if not exists job_title text;

create index if not exists profiles_slug_idx on public.profiles (slug);

-- 3) RLS profiles -------------------------------------------------------------
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

-- 4) updated_at trigger genérico ---------------------------------------------
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

-- 6) Slug check ---------------------------------------------------------------
create or replace function public.is_slug_available(p_slug text)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.profiles where slug = lower(p_slug));
$$;

grant execute on function public.is_slug_available(text) to anon, authenticated;

-- =============================================================================
-- 7) WORKSPACE ITEMS — pastas e bots por usuário
-- =============================================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'workspace_item_type') then
    create type public.workspace_item_type as enum ('folder', 'bot');
  end if;
end$$;

create table if not exists public.workspace_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        public.workspace_item_type not null,
  title       text not null,
  description text not null default '',
  emoji       text not null default '📁',
  parent_id   uuid references public.workspace_items(id) on delete cascade,
  index_item  int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists workspace_items_user_idx   on public.workspace_items (user_id);
create index if not exists workspace_items_parent_idx on public.workspace_items (parent_id);

alter table public.workspace_items enable row level security;

drop policy if exists "workspace_items_select_own" on public.workspace_items;
create policy "workspace_items_select_own"
  on public.workspace_items for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "workspace_items_insert_own" on public.workspace_items;
create policy "workspace_items_insert_own"
  on public.workspace_items for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "workspace_items_update_own" on public.workspace_items;
create policy "workspace_items_update_own"
  on public.workspace_items for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "workspace_items_delete_own" on public.workspace_items;
create policy "workspace_items_delete_own"
  on public.workspace_items for delete
  to authenticated
  using (auth.uid() = user_id);

drop trigger if exists workspace_items_updated_at on public.workspace_items;
create trigger workspace_items_updated_at
  before update on public.workspace_items
  for each row execute function public.handle_updated_at();

-- =============================================================================
-- 8) COMPANIES — dados da empresa do cliente (1 por usuário)
-- =============================================================================
create table if not exists public.companies (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  name        text,
  cnpj        text,
  email       text,
  phone       text,
  address     text,
  sector      text,
  website     text,
  logo_url    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.companies enable row level security;

drop policy if exists "companies_select_own" on public.companies;
create policy "companies_select_own"
  on public.companies for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "companies_insert_own" on public.companies;
create policy "companies_insert_own"
  on public.companies for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "companies_update_own" on public.companies;
create policy "companies_update_own"
  on public.companies for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists companies_updated_at on public.companies;
create trigger companies_updated_at
  before update on public.companies
  for each row execute function public.handle_updated_at();

-- =============================================================================
-- 9) WORKSPACE SETTINGS — configurações operacionais (1 por usuário)
-- =============================================================================
create table if not exists public.workspace_settings (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  workspace_name text,
  timezone       text,
  language       text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.workspace_settings enable row level security;

drop policy if exists "workspace_settings_select_own" on public.workspace_settings;
create policy "workspace_settings_select_own"
  on public.workspace_settings for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "workspace_settings_insert_own" on public.workspace_settings;
create policy "workspace_settings_insert_own"
  on public.workspace_settings for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "workspace_settings_update_own" on public.workspace_settings;
create policy "workspace_settings_update_own"
  on public.workspace_settings for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists workspace_settings_updated_at on public.workspace_settings;
create trigger workspace_settings_updated_at
  before update on public.workspace_settings
  for each row execute function public.handle_updated_at();

-- =============================================================================
-- 10) STORAGE — bucket público de avatares
-- =============================================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Policies do bucket avatars (cada usuário só mexe na sua pasta /{uid}/...)
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'avatars');

drop policy if exists "avatars_user_insert" on storage.objects;
create policy "avatars_user_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_user_update" on storage.objects;
create policy "avatars_user_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_user_delete" on storage.objects;
create policy "avatars_user_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- =============================================================================
-- 11) STORAGE — bucket público de logos da empresa
-- =============================================================================
insert into storage.buckets (id, name, public)
values ('company-logos', 'company-logos', true)
on conflict (id) do nothing;

drop policy if exists "company_logos_public_read" on storage.objects;
create policy "company_logos_public_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'company-logos');

drop policy if exists "company_logos_user_insert" on storage.objects;
create policy "company_logos_user_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'company-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "company_logos_user_update" on storage.objects;
create policy "company_logos_user_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'company-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "company_logos_user_delete" on storage.objects;
create policy "company_logos_user_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'company-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- =============================================================================
-- 12) CHATBOT FLOWS — fluxo do bot, com versão rascunho e versão publicada
-- =============================================================================
-- Cada workspace_item do tipo 'bot' tem (no máximo) um chatbot_flow correspondente.
-- draft_*  -> última versão salva (sempre que o usuário clica "Salvar")
-- published_* -> versão atualmente pública (snapshot tirado no "Publicar")
-- public_id é único POR usuário (não global), permitindo URLs amigáveis.
-- =============================================================================
create table if not exists public.chatbot_flows (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  workspace_item_id   uuid not null unique references public.workspace_items(id) on delete cascade,
  name                text not null default 'Novo bot',
  description         text,
  settings            jsonb not null default '{}'::jsonb,
  -- versão em edição
  draft_containers    jsonb not null default '[]'::jsonb,
  draft_edges         jsonb not null default '[]'::jsonb,
  draft_updated_at    timestamptz not null default now(),
  -- versão publicada (snapshot)
  published_containers jsonb,
  published_edges     jsonb,
  published_at        timestamptz,
  -- publicação
  public_id           text,
  is_published        boolean not null default false,
  is_active           boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint chatbot_flows_public_id_format
    check (public_id is null or public_id ~ '^[a-z0-9](?:[a-z0-9-]{1,60}[a-z0-9])?$')
);

-- public_id único por usuário (escopo: usuário, não global)
create unique index if not exists chatbot_flows_user_public_id_uniq
  on public.chatbot_flows (user_id, public_id)
  where public_id is not null;

create index if not exists chatbot_flows_user_idx       on public.chatbot_flows (user_id);
create index if not exists chatbot_flows_published_idx  on public.chatbot_flows (is_published) where is_published;

alter table public.chatbot_flows enable row level security;

-- SELECT: dono OU qualquer um (anon/authenticated) se publicado e ativo
drop policy if exists "chatbot_flows_select_own" on public.chatbot_flows;
create policy "chatbot_flows_select_own"
  on public.chatbot_flows for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "chatbot_flows_select_public" on public.chatbot_flows;
create policy "chatbot_flows_select_public"
  on public.chatbot_flows for select
  to anon, authenticated
  using (is_published = true and is_active = true and public_id is not null);

drop policy if exists "chatbot_flows_insert_own" on public.chatbot_flows;
create policy "chatbot_flows_insert_own"
  on public.chatbot_flows for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "chatbot_flows_update_own" on public.chatbot_flows;
create policy "chatbot_flows_update_own"
  on public.chatbot_flows for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "chatbot_flows_delete_own" on public.chatbot_flows;
create policy "chatbot_flows_delete_own"
  on public.chatbot_flows for delete
  to authenticated
  using (auth.uid() = user_id);

drop trigger if exists chatbot_flows_updated_at on public.chatbot_flows;
create trigger chatbot_flows_updated_at
  before update on public.chatbot_flows
  for each row execute function public.handle_updated_at();

-- Lookup público por slug do dono + public_id (sem expor user_id)
create or replace function public.get_public_flow(p_slug text, p_public_id text)
returns table (
  id uuid,
  name text,
  description text,
  settings jsonb,
  containers jsonb,
  edges jsonb,
  owner_slug text
) language sql stable security definer set search_path = public as $$
  select f.id,
         f.name,
         f.description,
         f.settings,
         coalesce(f.published_containers, '[]'::jsonb) as containers,
         coalesce(f.published_edges, '[]'::jsonb)      as edges,
         p.slug as owner_slug
    from public.chatbot_flows f
    join public.profiles p on p.id = f.user_id
   where p.slug = lower(p_slug)
     and f.public_id = p_public_id
     and f.is_published = true
     and f.is_active = true
   limit 1;
$$;

grant execute on function public.get_public_flow(text, text) to anon, authenticated;

