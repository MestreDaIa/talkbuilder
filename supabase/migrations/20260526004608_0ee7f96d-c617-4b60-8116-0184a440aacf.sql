-- Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.whatsapp_bindings (
  instance_name TEXT PRIMARY KEY,
  bot_public_id TEXT NOT NULL,
  webhook_url   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_bindings ENABLE ROW LEVEL SECURITY;

-- Create policies safely (dropping existing ones first if they exist to avoid the ERROR 42710)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'whatsapp_bindings' 
        AND policyname = 'wb read all'
    ) THEN
        CREATE POLICY "wb read all" ON public.whatsapp_bindings FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'whatsapp_bindings' 
        AND policyname = 'wb write all'
    ) THEN
        CREATE POLICY "wb write all" ON public.whatsapp_bindings FOR ALL USING (true) WITH CHECK (true);
    END IF;
END
$$;