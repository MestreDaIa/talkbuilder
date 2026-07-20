-- =============================================================================
-- Zailom Flow · Correção Super Admin Stats
-- -----------------------------------------------------------------------------
-- Use este arquivo quando o painel Super Admin mostrar erro:
--   column "last_activity_at" does not exist
--
-- Motivo:
--   A tabela public.conversation_sessions usa a coluna last_interaction_at.
--   A versão anterior da função admin_get_stats() apontava para last_activity_at.
--
-- Execute este SQL no seu Supabase externo.
-- =============================================================================

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