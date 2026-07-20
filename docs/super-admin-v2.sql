-- =============================================================================
-- SUPER ADMIN v2 — extensões (bots, billing, notificações clicáveis)
-- Execute APÓS docs/super-admin-setup.sql, no SQL Editor do Supabase externo.
-- Idempotente: pode rodar várias vezes sem quebrar.
-- =============================================================================

-- 1. NOTIFICAÇÕES — novos campos ---------------------------------------------
alter table public.notifications
  add column if not exists is_clickable boolean not null default false,
  add column if not exists preview      text,
  add column if not exists image_url    text,
  add column if not exists video_url    text,
  add column if not exists link_url     text,
  add column if not exists short_id     text;

-- short_id curto e único (8 chars) — usado em /:slug/notification/:short_id
update public.notifications
  set short_id = substr(md5(random()::text || id::text), 1, 8)
  where short_id is null;

create unique index if not exists idx_notifications_short_id
  on public.notifications(short_id);

-- Trigger para gerar short_id em novos inserts
create or replace function public.notifications_set_short_id()
returns trigger language plpgsql as $$
declare
  attempts int := 0;
  candidate text;
begin
  if new.short_id is null or new.short_id = '' then
    loop
      candidate := substr(md5(random()::text || new.id::text || attempts::text), 1, 8);
      exit when not exists (select 1 from public.notifications where short_id = candidate);
      attempts := attempts + 1;
      if attempts > 8 then
        candidate := substr(md5(random()::text || clock_timestamp()::text), 1, 10);
        exit;
      end if;
    end loop;
    new.short_id := candidate;
  end if;
  return new;
end $$;

drop trigger if exists trg_notifications_short_id on public.notifications;
create trigger trg_notifications_short_id
  before insert on public.notifications
  for each row execute function public.notifications_set_short_id();

-- 2. STORAGE BUCKET para mídia das notificações ------------------------------
-- Público para leitura (imagens exibidas no bell/página dedicada), escrita somente super_admin.
insert into storage.buckets (id, name, public)
  values ('notifications', 'notifications', true)
  on conflict (id) do update set public = true;

drop policy if exists "notifications media public read" on storage.objects;
create policy "notifications media public read"
  on storage.objects for select
  using (bucket_id = 'notifications');

drop policy if exists "notifications media super admin write" on storage.objects;
create policy "notifications media super admin write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'notifications' and public.is_super_admin());

drop policy if exists "notifications media super admin update" on storage.objects;
create policy "notifications media super admin update"
  on storage.objects for update to authenticated
  using (bucket_id = 'notifications' and public.is_super_admin());

drop policy if exists "notifications media super admin delete" on storage.objects;
create policy "notifications media super admin delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'notifications' and public.is_super_admin());

-- 3. CHATBOT_FLOWS — moderação (block/ban) -----------------------------------
alter table public.chatbot_flows
  add column if not exists is_blocked      boolean not null default false,
  add column if not exists blocked_at      timestamptz,
  add column if not exists blocked_reason  text,
  add column if not exists is_banned       boolean not null default false,
  add column if not exists banned_at       timestamptz,
  add column if not exists banned_reason   text;

-- Super admin lê/atualiza qualquer bot
drop policy if exists "super admin reads flows" on public.chatbot_flows;
create policy "super admin reads flows"
  on public.chatbot_flows for select
  to authenticated
  using (public.is_super_admin());

drop policy if exists "super admin updates flows" on public.chatbot_flows;
create policy "super admin updates flows"
  on public.chatbot_flows for update
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "super admin deletes flows" on public.chatbot_flows;
create policy "super admin deletes flows"
  on public.chatbot_flows for delete
  to authenticated
  using (public.is_super_admin());

-- 4. VIEW de todos os bots para o admin --------------------------------------
create or replace view public.v_admin_bots as
select
  f.id,
  f.name as title,
  f.public_id,
  f.workspace_id,
  f.is_published,
  coalesce(f.is_blocked, false)  as is_blocked,
  coalesce(f.is_banned, false)   as is_banned,
  f.blocked_at, f.blocked_reason,
  f.banned_at,  f.banned_reason,
  f.created_at,
  f.updated_at,
  w.name          as workspace_name,
  w.slug          as workspace_slug,
  w.owner_id      as workspace_owner_id,
  p.email         as owner_email,
  p.embed_source  as owner_embed_source
from public.chatbot_flows f
left join public.workspaces w on w.id = f.workspace_id
left join public.profiles p   on p.id = w.owner_id;

grant select on public.v_admin_bots to authenticated, service_role;

-- 5. BILLING — preços por plano + view de faturamento ------------------------
create table if not exists public.plan_prices (
  plan       text primary key,
  price_brl  numeric(10,2) not null default 0,
  updated_at timestamptz not null default now()
);
grant select on public.plan_prices to authenticated, service_role;
alter table public.plan_prices enable row level security;

drop policy if exists "plan_prices read all" on public.plan_prices;
create policy "plan_prices read all" on public.plan_prices for select
  to authenticated using (true);

drop policy if exists "plan_prices super admin write" on public.plan_prices;
create policy "plan_prices super admin write" on public.plan_prices for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

insert into public.plan_prices (plan, price_brl) values
  ('starter', 0),
  ('pro', 79),
  ('business', 199)
on conflict (plan) do nothing;

-- View: faturamento apenas de workspaces STANDALONE (não gerenciados pelo Booking)
create or replace view public.v_admin_billing as
with billable as (
  select
    p.id as owner_id,
    coalesce(p.plan::text, 'starter') as plan
  from public.profiles p
  where (p.embed_source is null or p.embed_source <> 'booking')
    and coalesce(p.is_suspended, false) = false
)
select
  b.plan,
  count(*)::int                       as active_workspaces,
  coalesce(pp.price_brl, 0)::numeric  as unit_price_brl,
  (count(*) * coalesce(pp.price_brl, 0))::numeric as mrr_brl
from billable b
left join public.plan_prices pp on pp.plan = b.plan
group by b.plan, pp.price_brl
order by b.plan;

grant select on public.v_admin_billing to authenticated, service_role;

-- 6. atualiza admin_get_stats para incluir MRR e contagem de bots ativos -----
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
    'total_workspaces',     (select count(*) from public.workspaces),
    'embed_workspaces',     (select count(*) from public.profiles where embed_source = 'booking'),
    'standalone_workspaces',(select count(*) from public.profiles where embed_source is null or embed_source <> 'booking'),
    'suspended_workspaces', (select count(*) from public.profiles where is_suspended = true),
    'total_bots',           (select count(*) from public.chatbot_flows),
    'published_bots',       (select count(*) from public.chatbot_flows where is_published = true),
    'blocked_bots',         (select count(*) from public.chatbot_flows where coalesce(is_blocked,false) = true),
    'banned_bots',          (select count(*) from public.chatbot_flows where coalesce(is_banned,false) = true),
    'total_users',          (select count(*) from auth.users),
    'active_sessions_24h',  (select count(*) from public.conversation_sessions where last_interaction_at > now() - interval '24 hours'),
    'mrr_brl_standalone',   (select coalesce(sum(mrr_brl),0) from public.v_admin_billing),
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
