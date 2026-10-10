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
revoke select on public.v_admin_bots from anon, authenticated;
grant select on public.v_admin_bots to service_role;
revoke select on public.v_admin_billing from anon, authenticated;
grant select on public.v_admin_billing to service_role;

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
