CREATE TABLE IF NOT EXISTS public.whatsapp_bindings (
  instance_name TEXT PRIMARY KEY,
  bot_public_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.whatsapp_bindings ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_whatsapp_bindings_bot ON public.whatsapp_bindings(bot_public_id);