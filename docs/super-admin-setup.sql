-- =============================================================================
-- SUPER ADMIN — Setup completo para deploy MANUAL no Supabase EXTERNO
-- -----------------------------------------------------------------------------
-- Execute este script INTEIRO no SQL Editor do seu projeto Supabase.
-- No final há um INSERT comentado para promover seu usuário a super_admin.
-- =============================================================================

-- 1. ENUM DE ROLES DA APLICAÇÃO ------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('super_admin', 'support');
  end if;
end$$;

-- 2. TABELA user_roles ---------------------------------------------------------
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

alter table public.user_roles enable row level security;

drop policy if exists "user can read own roles" on public.user_roles;
create policy "user can read own roles"
on public.user_roles for select
to authenticated
using (user_id = auth.uid());

-- 3. FUNÇÃO has_role (SECURITY DEFINER — evita recursão em RLS) ----------------
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(auth.uid(), 'super_admin');
$$;

grant execute on function public.is_super_admin() to authenticated, service_role;

-- 4. CAMPOS ADMIN EM profiles --------------------------------------------------
alter table public.profiles
  add column if not exists is_suspended boolean not null default false,
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_reason text,
  add column if not exists custom_bots_limit integer,
  add column if not exists custom_messages_limit integer,
  add column if not exists custom_integrations_limit integer,
  add column if not exists admin_notes text;

-- Permite super_admin ler/atualizar qualquer profile
drop policy if exists "super admin can read all profiles" on public.profiles;
create policy "super admin can read all profiles"
on public.profiles for select
to authenticated
using (public.is_super_admin());

drop policy if exists "super admin can update all profiles" on public.profiles;
create policy "super admin can update all profiles"
on public.profiles for update
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

-- 5. AUDIT LOG (append-only) ---------------------------------------------------
create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  action text not null,          -- ex: 'workspace.suspend', 'plan.override'
  target_type text,              -- 'workspace' | 'user' | 'notification' | ...
  target_id text,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_audit_created on public.admin_audit_log (created_at desc);
create index if not exists idx_admin_audit_actor on public.admin_audit_log (actor_id);
create index if not exists idx_admin_audit_target on public.admin_audit_log (target_type, target_id);

grant select on public.admin_audit_log to authenticated;
grant all on public.admin_audit_log to service_role;

alter table public.admin_audit_log enable row level security;

drop policy if exists "super admin reads audit" on public.admin_audit_log;
create policy "super admin reads audit"
on public.admin_audit_log for select
to authenticated
using (public.is_super_admin());

-- 6. PLAN OVERRIDE HISTORY -----------------------------------------------------
create table if not exists public.plan_override_history (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  old_plan text,
  new_plan text,
  old_limits jsonb,
  new_limits jsonb,
  reason text,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_plan_override_profile on public.plan_override_history (profile_id);

grant select on public.plan_override_history to authenticated;
grant all on public.plan_override_history to service_role;

alter table public.plan_override_history enable row level security;

drop policy if exists "super admin reads plan history" on public.plan_override_history;
create policy "super admin reads plan history"
on public.plan_override_history for select
to authenticated
using (public.is_super_admin());

-- 7. NOTIFICAÇÕES --------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  level text not null default 'info',   -- info | success | warning | critical
  target_type text not null,            -- global | plan | workspace | user
  target_value text,                    -- plan tier / workspace_id / user_id / null pra global
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists idx_notifications_created on public.notifications (created_at desc);
create index if not exists idx_notifications_target on public.notifications (target_type, target_value);

grant select on public.notifications to authenticated;
grant all on public.notifications to service_role;

alter table public.notifications enable row level security;

-- Todo usuário autenticado consegue LER as notificações que o afetam
drop policy if exists "users read their notifications" on public.notifications;
create policy "users read their notifications"
on public.notifications for select
to authenticated
using (
  (expires_at is null or expires_at > now())
  and (
    target_type = 'global'
    or (target_type = 'user' and target_value = auth.uid()::text)
    or (target_type = 'workspace' and exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id::text = notifications.target_value
        and wm.user_id = auth.uid()
    ))
    or (target_type = 'plan' and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.embed_plan_tier, p.plan::text) = notifications.target_value
    ))
    or public.is_super_admin()
  )
);

drop policy if exists "super admin manages notifications" on public.notifications;
create policy "super admin manages notifications"
on public.notifications for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

-- Leitura por usuário (marcar como lida)
create table if not exists public.notification_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_id uuid not null references public.notifications(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, notification_id)
);

grant select, insert, delete on public.notification_reads to authenticated;
grant all on public.notification_reads to service_role;

alter table public.notification_reads enable row level security;

drop policy if exists "user manages own reads" on public.notification_reads;
create policy "user manages own reads"
on public.notification_reads for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- 8. VIEW DE WORKSPACES PARA ADMIN --------------------------------------------
create or replace view public.v_admin_workspaces as
select
  w.id,
  w.name,
  w.slug,
  w.owner_id,
  w.created_at,
  p.email as owner_email,
  p.display_name as owner_name,
  p.plan as internal_plan,
  p.embed_source,
  p.embed_company_id,
  p.embed_plan_tier,
  p.embed_plan_synced_at,
  p.is_suspended,
  p.suspended_at,
  p.suspended_reason,
  p.custom_bots_limit,
  p.custom_messages_limit,
  p.custom_integrations_limit,
  (p.embed_source = 'booking') as is_embed,
  case
    when p.is_suspended then 'suspended'
    when p.embed_source = 'booking' then coalesce(p.embed_plan_tier, 'starter')
    else coalesce(p.plan::text, 'starter')
  end as effective_plan,
  (select count(*) from public.chatbot_flows f where f.workspace_id = w.id) as bots_count,
  (select count(*) from public.workspace_members m where m.workspace_id = w.id) as members_count
from public.workspaces w
left join public.profiles p on p.id = w.owner_id;

grant select on public.v_admin_workspaces to authenticated, service_role;

-- 9. RPC DE MÉTRICAS AGREGADAS -------------------------------------------------
create or replace function public.admin_get_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'total_workspaces', (select count(*) from public.workspaces),
    'embed_workspaces', (select count(*) from public.profiles where embed_source = 'booking'),
    'standalone_workspaces', (select count(*) from public.profiles where embed_source is null or embed_source <> 'booking'),
    'suspended_workspaces', (select count(*) from public.profiles where is_suspended = true),
    'total_bots', (select count(*) from public.chatbot_flows),
    'published_bots', (select count(*) from public.chatbot_flows where is_published = true),
    'total_users', (select count(*) from auth.users),
    'active_sessions_24h', (
      select count(*) from public.conversation_sessions
      where last_interaction_at > now() - interval '24 hours'
    ),
    'plan_distribution', (
      select jsonb_object_agg(coalesce(pl, 'unknown'), c)
      from (
        select
          case
            when is_suspended then 'suspended'
            when embed_source = 'booking' then coalesce(embed_plan_tier::text, 'starter')
            else coalesce(plan::text, 'starter')
          end as pl,
          count(*) as c
        from public.profiles
        group by 1
      ) t
    )
  ) into result;

  return result;
end;
$$;

grant execute on function public.admin_get_stats() to authenticated;

-- 10. PROMOVER USUÁRIO A SUPER ADMIN ------------------------------------------
-- >>> DESCOMENTE E EDITE O EMAIL ABAIXO <<<
-- Depois de executar o restante do script, rode APENAS este bloco pra promover seu usuário:
--
-- insert into public.user_roles (user_id, role)
-- select id, 'super_admin'::public.app_role
-- from auth.users
-- where email = 'seu-email@exemplo.com'
-- on conflict (user_id, role) do nothing;
--
-- Para conferir:
-- select u.email, r.role, r.created_at
-- from public.user_roles r
-- join auth.users u on u.id = r.user_id
-- where r.role = 'super_admin';
