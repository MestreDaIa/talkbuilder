-- Super Admin: corrigir filtro Standalone e adicionar catálogo de templates publicados.
-- Migration aditiva; não remove nem recria dados existentes.

-- Corrige NULL em is_embed: comparações com embed_source NULL retornam NULL,
-- fazendo o filtro .eq('is_embed', false) excluir workspaces standalone.
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
  (coalesce(p.embed_source, '') = 'booking') as is_embed,
  case
    when p.is_suspended then 'suspended'
    when p.embed_source = 'booking' then coalesce(p.embed_plan_tier, 'starter')
    else coalesce(p.plan::text, 'starter')
  end as effective_plan,
  (select count(*) from public.chatbot_flows f where f.workspace_id = w.id) as bots_count,
  (select count(*) from public.workspace_members m where m.workspace_id = w.id) as members_count
from public.workspaces w
left join public.profiles p on p.id = w.owner_id;

revoke select on public.v_admin_workspaces from anon, authenticated;
grant select on public.v_admin_workspaces to service_role;

-- Estas views contêm dados globais de administração e são acessadas pelo admin-api.
-- Verificamos a existência antes de alterar permissões para manter a migration compatível
-- com ambientes onde a extensão de Bots/Billing ainda não foi instalada.
do $$
begin
  if to_regclass('public.v_admin_bots') is not null then
    execute 'revoke select on public.v_admin_bots from anon, authenticated';
    execute 'grant select on public.v_admin_bots to service_role';
  end if;
  if to_regclass('public.v_admin_billing') is not null then
    execute 'revoke select on public.v_admin_billing from anon, authenticated';
    execute 'grant select on public.v_admin_billing to service_role';
  end if;
end;
$$;

-- Snapshot independente do bot de origem, para templates continuarem disponíveis
-- mesmo que o bot original seja renomeado ou removido.
create table if not exists public.bot_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text not null default 'Geral',
  emoji text not null default '🤖',
  source_flow_id uuid,
  source_bot_name text,
  snapshot jsonb not null default '{}'::jsonb,
  is_published boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_bot_templates_published_created
  on public.bot_templates (is_published, created_at desc);

alter table public.bot_templates enable row level security;
grant select on public.bot_templates to authenticated;
grant all on public.bot_templates to service_role;

drop policy if exists "users read published bot templates" on public.bot_templates;
create policy "users read published bot templates"
  on public.bot_templates for select
  to authenticated
  using (is_published = true or public.is_super_admin());

drop policy if exists "super admins insert bot templates" on public.bot_templates;
create policy "super admins insert bot templates"
  on public.bot_templates for insert
  to authenticated
  with check (public.is_super_admin());

drop policy if exists "super admins update bot templates" on public.bot_templates;
create policy "super admins update bot templates"
  on public.bot_templates for update
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "super admins delete bot templates" on public.bot_templates;
create policy "super admins delete bot templates"
  on public.bot_templates for delete
  to authenticated
  using (public.is_super_admin());

create or replace function public.bot_templates_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_bot_templates_updated_at on public.bot_templates;
create trigger trg_bot_templates_updated_at
  before update on public.bot_templates
  for each row execute function public.bot_templates_set_updated_at();


create index if not exists idx_workspace_items_bot_quota
  on public.workspace_items (workspace_id, type);

-- Enforce bot quotas in the database too, so template use and direct API inserts
-- cannot bypass the workspace's effective plan limit.
create or replace function public.enforce_workspace_bot_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_plan text;
  v_embed_source text;
  v_embed_plan text;
  v_embed_limit integer;
  v_custom_limit integer;
  v_suspended boolean;
  v_limit integer;
  v_used integer;
begin
  if new.type is distinct from 'bot' then
    return new;
  end if;

  -- Lock the workspace row to serialize concurrent bot creation for one workspace.
  select w.owner_id,
         p.plan::text,
         p.embed_source,
         p.embed_plan_tier,
         p.embed_max_chatbots,
         p.custom_bots_limit,
         coalesce(p.is_suspended, false)
    into v_owner_id, v_plan, v_embed_source, v_embed_plan,
         v_embed_limit, v_custom_limit, v_suspended
  from public.workspaces w
  left join public.profiles p on p.id = w.owner_id
  where w.id = new.workspace_id
  for update of w;

  if not found or v_owner_id is null then
    raise exception 'WORKSPACE_OWNER_NOT_FOUND: cannot verify bot quota'
      using errcode = '23514';
  end if;

  if v_suspended or v_embed_plan = 'suspended' then
    v_limit := 0;
  elsif v_embed_source = 'booking' then
    v_limit := coalesce(
      v_embed_limit,
      case v_embed_plan
        when 'starter' then 1
        when 'pro' then 5
        when 'business' then 20
        else 1
      end
    );
  else
    v_limit := coalesce(
      v_custom_limit,
      case coalesce(v_plan, 'starter')
        when 'starter' then 1
        when 'pro' then 5
        when 'business' then 20
        else 1
      end
    );
  end if;

  select count(*)::integer
    into v_used
  from public.workspace_items wi
  where wi.workspace_id = new.workspace_id
    and wi.type = 'bot';

  if v_used >= v_limit then
    raise exception 'BOT_LIMIT_REACHED: this workspace has reached its bot limit (% of %)', v_used, v_limit
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_workspace_bot_limit() from public;

drop trigger if exists trg_enforce_workspace_bot_limit on public.workspace_items;
create trigger trg_enforce_workspace_bot_limit
  before insert on public.workspace_items
  for each row execute function public.enforce_workspace_bot_limit();

