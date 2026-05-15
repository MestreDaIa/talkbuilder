create table if not exists public.flow_executions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid,
  flow_id uuid not null references public.chatbot_flows(id) on delete cascade,
  contact_id text not null,
  channel_id text not null default 'webchat',
  current_node_id text,
  variables jsonb not null default '{}'::jsonb,
  waiting_for_input boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (flow_id, contact_id, channel_id)
);

create index if not exists flow_executions_lookup_idx
  on public.flow_executions (flow_id, contact_id, channel_id);

alter table public.flow_executions enable row level security;

create table if not exists public.conversation_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid,
  flow_id uuid not null references public.chatbot_flows(id) on delete cascade,
  contact_id text not null,
  channel_id text not null default 'webchat',
  status text not null default 'active',
  started_at timestamptz not null default now(),
  last_interaction_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conversation_sessions_lookup_idx
  on public.conversation_sessions (flow_id, contact_id, channel_id, status, last_interaction_at desc);

alter table public.conversation_sessions enable row level security;
