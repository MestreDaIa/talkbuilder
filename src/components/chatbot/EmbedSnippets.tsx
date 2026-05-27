import React, { useEffect, useState } from 'react';
import {
  Code2,
  Copy,
  Check,
  Globe,
  FileCode,
  Boxes,
  ShoppingBag,
  Loader2,
  Link2,
  Unlink,
  RefreshCw,
} from 'lucide-react';
import { SiWhatsapp } from '@icons-pack/react-simple-icons';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { supabaseClient } from '@/lib/supabaseClient';
import { evoApi } from '@/services/evolutionApi';

interface EmbedSnippetsProps {
  /** URL pública completa do bot */
  publicUrl: string;
  /** Nome / public_id do bot */
  botName?: string;
}

type Platform =
  | 'whatsapp'
  | 'wordpress'
  | 'next'
  | 'react'
  | 'iframe'
  | 'html'
  | 'shopify';

interface PlatformDef {
  id: Platform;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const PLATFORMS: PlatformDef[] = [
  { id: 'wordpress', label: 'WordPress', icon: Globe },
  { id: 'shopify', label: 'Shopify', icon: ShoppingBag },
  { id: 'html', label: 'HTML/JS', icon: FileCode },
  { id: 'iframe', label: 'Iframe', icon: Code2 },
  { id: 'next', label: 'Next.js', icon: Boxes },
  { id: 'react', label: 'React', icon: Boxes },
  { id: 'whatsapp', label: 'WhatsApp', icon: SiWhatsapp as any },
];

function buildSnippet(platform: Platform, publicUrl: string, botName: string): string {
  const safeName = botName.replace(/`/g, '');
  const title = `Chatbot - ${safeName}`;

  switch (platform) {
    case 'wordpress':
    case 'shopify':
    case 'html':
      return `<!-- TalkBuilder Chatbot -->
<div id="talkbuilder-chatbot"></div>
<style>
  #talkbuilder-fab { position: fixed; bottom: 24px; right: 24px; z-index: 9999;
    width: 60px; height: 60px; border-radius: 50%; background: #7c3aed;
    color: #fff; border: none; cursor: pointer; box-shadow: 0 8px 24px rgba(0,0,0,.2);
    display: flex; align-items: center; justify-content: center; font-size: 28px; }
  #talkbuilder-frame { position: fixed; bottom: 96px; right: 24px; z-index: 9999;
    width: 380px; height: 600px; max-width: calc(100vw - 32px); max-height: calc(100vh - 120px);
    border: 0; border-radius: 16px; overflow: hidden; box-shadow: 0 16px 48px rgba(0,0,0,.25);
    display: none; background: #fff; }
  #talkbuilder-frame.open { display: block; }
</style>
<button id="talkbuilder-fab" aria-label="Abrir chat">💬</button>
<iframe id="talkbuilder-frame" src="${publicUrl}" title="${title}"></iframe>
<script>
  (function () {
    var fab = document.getElementById('talkbuilder-fab');
    var frame = document.getElementById('talkbuilder-frame');
    fab.addEventListener('click', function () { frame.classList.toggle('open'); });
  })();
</script>`;

    case 'iframe':
      return `<iframe
  src="${publicUrl}"
  title="${title}"
  width="100%"
  height="600"
  style="border:0; border-radius:12px; overflow:hidden;"
  allow="clipboard-write; microphone; camera"
></iframe>`;

    case 'next':
      return `// app/components/TalkBuilderChat.tsx
'use client';
export default function TalkBuilderChat() {
  return (
    <iframe
      src="${publicUrl}"
      title="${title}"
      style={{ width: '100%', height: '600px', border: 0, borderRadius: 12, overflow: 'hidden' }}
      allow="clipboard-write; microphone; camera"
    />
  );
}`;

    case 'react':
      return `// TalkBuilderChat.jsx
export default function TalkBuilderChat() {
  return (
    <iframe
      src="${publicUrl}"
      title="${title}"
      style={{ width: '100%', height: 600, border: 0, borderRadius: 12, overflow: 'hidden' }}
      allow="clipboard-write; microphone; camera"
    />
  );
}`;
    case 'whatsapp':
      return '';
  }
}

interface EvoInstance {
  name?: string;
  instanceName?: string;
  instance?: { instanceName?: string; state?: string };
  connectionStatus?: string;
  state?: string;
}

const getInstanceName = (i: EvoInstance) =>
  i?.name || i?.instance?.instanceName || i?.instanceName || '';
const getInstanceState = (i: EvoInstance) =>
  i?.connectionStatus || i?.state || i?.instance?.state || '';

function WhatsappBindPanel({ botPublicId }: { botPublicId: string }) {
  const [instances, setInstances] = useState<EvoInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [boundInstance, setBoundInstance] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>('');
  const [missingTable, setMissingTable] = useState(false);

  // Webhook URL: usa o servidor próprio (Node) configurado em VITE_BACKEND_URL
  const [webhookUrl, setWebhookUrl] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    const stored = window.localStorage.getItem('whatsapp_webhook_url');
    if (stored) return stored;

    const backend = (import.meta.env.VITE_BACKEND_URL as string | undefined)?.replace(/\/$/, '');
    if (backend) return `${backend}/webhook/whatsapp`;
    return '';
  });


  const loadAll = async () => {
    setLoading(true);
    try {
      const list = await evoApi.fetchInstances();
      const arr = Array.isArray(list) ? list : [];
      setInstances(arr);

      const { data: binding, error } = await (supabaseClient as any)
        .from('whatsapp_bindings')
        .select('instance_name')
        .eq('bot_public_id', botPublicId)
        .maybeSingle();

      if (error && /relation .* does not exist|whatsapp_bindings/i.test(error.message || '')) {
        setMissingTable(true);
      }

      const bound = binding?.instance_name || null;
      setBoundInstance(bound);
      if (bound) {
        setSelected(bound);
      } else if (arr.length) {
        setSelected(getInstanceName(arr[0]));
      }
    } catch (e: any) {
      console.error(e);
      toast.error('Erro ao carregar instâncias do WhatsApp');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botPublicId]);

  const persistWebhook = (url: string) => {
    setWebhookUrl(url);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('whatsapp_webhook_url', url);
    }
  };

  const handleBind = async () => {
    if (!selected) return;
    if (!webhookUrl || !/^https?:\/\//i.test(webhookUrl)) {
      toast.error('Informe uma URL de webhook válida (https://...)');
      return;
    }
    setBusy('bind');
    try {
      await evoApi.setWebhook(selected, {
        enabled: true,
        url: webhookUrl,
        byEvents: true,
        base64: false,
        events: ['MESSAGES_UPSERT']
      });

      // Remove qualquer vínculo anterior deste bot (a PK é composta:
      // instance_name + bot_public_id, então upsert por instance_name falha com 400).
      const { error: delErr } = await (supabaseClient as any)
        .from('whatsapp_bindings')
        .delete()
        .eq('bot_public_id', botPublicId);
      if (delErr) throw delErr;

      const { error } = await (supabaseClient as any)
        .from('whatsapp_bindings')
        .insert({
          instance_name: selected,
          bot_public_id: botPublicId,
          webhook_url: webhookUrl,
          updated_at: new Date().toISOString(),
        });
      if (error) {
        if (/relation .* does not exist|whatsapp_bindings/i.test(error.message || '')) {
          setMissingTable(true);
          throw new Error('Tabela whatsapp_bindings não existe no seu Supabase. Rode o SQL abaixo.');
        }
        throw error;
      }
      setBoundInstance(selected);
      toast.success('Bot vinculado a esta instância do WhatsApp!');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao vincular');
    } finally {
      setBusy(null);
    }
  };

  const handleUnbind = async () => {
    if (!boundInstance) return;
    setBusy('unbind');
    try {
      try { 
        await evoApi.setWebhook(boundInstance, {
          enabled: false,
          url: '',
          byEvents: false,
          base64: false,
          events: []
        }); 
      } catch {}
      await (supabaseClient as any)
        .from('whatsapp_bindings')
        .delete()
        .eq('instance_name', boundInstance);
      setBoundInstance(null);
      toast.success('Vínculo removido.');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao desvincular');
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-green-600" />
      </div>
    );
  }

  if (!instances.length) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm space-y-2">
        <SiWhatsapp className="w-6 h-6 mx-auto text-green-600" />
        <p className="font-medium">Nenhuma instância do WhatsApp encontrada</p>
        <p className="text-xs text-muted-foreground">
          Vá em <strong>Configurações → Integrações</strong> e crie/conecte uma instância antes de vincular ao bot.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-green-50/50 dark:bg-green-950/20 p-3 flex items-start gap-3">
        <SiWhatsapp className="w-5 h-5 text-green-600 mt-0.5" />
        <div className="text-xs leading-relaxed">
          <p className="font-medium text-green-900 dark:text-green-100 mb-0.5">
            Vincule esse bot a um número de WhatsApp
          </p>
          <p className="text-green-800/80 dark:text-green-100/70">
            As mensagens recebidas no WhatsApp serão enviadas para o webhook abaixo, que as processará usando o runtime do bot no seu servidor próprio (endpoint <code>/webhook/whatsapp</code>).
          </p>

        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Instância (Evolution API)</Label>
        <div className="flex gap-2">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="flex-1 h-9 px-3 text-sm border rounded-md bg-background"
          >
            {instances.map((i, idx) => {
              const n = getInstanceName(i);
              const s = getInstanceState(i);
              return (
                <option key={n || idx} value={n}>
                  {n} {s ? `· ${s}` : ''}
                </option>
              );
            })}
          </select>
          <Button variant="outline" size="icon" onClick={loadAll} className="h-9 w-9">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">URL do Webhook</Label>
        <Input
          value={webhookUrl}
          onChange={(e) => persistWebhook(e.target.value)}
          placeholder="https://seu-servidor.com/whatsapp-webhook"
          className="h-9 text-sm"
        />
        <p className="text-[11px] text-muted-foreground">
          A Evolution API enviará as mensagens recebidas para essa URL (evento MESSAGES_UPSERT).
        </p>
      </div>

      {boundInstance && (
        <div className="text-xs flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200">
          <Check className="w-3.5 h-3.5" />
          Bot vinculado à instância <strong>{boundInstance}</strong>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          onClick={handleBind}
          disabled={!selected || busy !== null}
          className="bg-green-600 hover:bg-green-700"
        >
          {busy === 'bind' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Link2 className="w-4 h-4 mr-2" />}
          {boundInstance === selected ? 'Atualizar vínculo' : 'Vincular este bot'}
        </Button>
        {boundInstance && (
          <Button variant="outline" onClick={handleUnbind} disabled={busy !== null}>
            {busy === 'unbind' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Unlink className="w-4 h-4 mr-2" />}
            Desvincular
          </Button>
        )}
      </div>

      {missingTable && (
        <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-[11px] space-y-2">
          <p className="font-medium text-amber-900 dark:text-amber-100">
            Tabela <code>whatsapp_bindings</code> não encontrada no seu Supabase. Rode este SQL:
          </p>
          <pre className="bg-background border rounded p-2 overflow-auto text-[10px] leading-snug">{`CREATE TABLE IF NOT EXISTS public.whatsapp_bindings (
  instance_name TEXT PRIMARY KEY,
  bot_public_id TEXT NOT NULL,
  webhook_url   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.whatsapp_bindings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wb read all"   ON public.whatsapp_bindings FOR SELECT USING (true);
CREATE POLICY "wb write all"  ON public.whatsapp_bindings FOR ALL    USING (true) WITH CHECK (true);`}</pre>
        </div>
      )}
    </div>
  );
}

export function EmbedSnippets({ publicUrl, botName = 'Bot' }: EmbedSnippetsProps) {
  const [active, setActive] = useState<Platform>('wordpress');
  const [copiedPlatform, setCopiedPlatform] = useState<Platform | null>(null);

  const handleCopy = async (platform: Platform) => {
    const snippet = buildSnippet(platform, publicUrl, botName);
    try {
      await navigator.clipboard.writeText(snippet);
      setCopiedPlatform(platform);
      toast.success('Código copiado!');
      setTimeout(() => setCopiedPlatform(null), 2000);
    } catch (err) {
      console.error('clipboard error', err);
      toast.error('Não foi possível copiar.');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Incorporar em outras plataformas</Label>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">URL base do embed</Label>
        <Input value={publicUrl} readOnly className="text-xs bg-muted" />
      </div>

      <Tabs value={active} onValueChange={(v: string) => setActive(v as Platform)} className="w-full">
        <TabsList className="grid grid-cols-4 sm:grid-cols-7 h-auto gap-1 bg-muted/40 p-1">
          {PLATFORMS.map((p) => {
            const Icon = p.icon;
            return (
              <TabsTrigger
                key={p.id}
                value={p.id}
                className="flex flex-col items-center gap-1 py-2 text-[11px] data-[state=active]:bg-background"
              >
                <Icon className="w-4 h-4" />
                <span className="leading-none">{p.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {PLATFORMS.map((p) => {
          if (p.id === 'whatsapp') {
            return (
              <TabsContent key={p.id} value={p.id} className="mt-3">
                <WhatsappBindPanel botPublicId={botName} />
              </TabsContent>
            );
          }
          const snippet = buildSnippet(p.id, publicUrl, botName);
          const isCopied = copiedPlatform === p.id;
          return (
            <TabsContent key={p.id} value={p.id} className="mt-3 space-y-2">
              <div className="relative">
                <pre className="text-[11px] leading-relaxed bg-muted rounded-md p-3 max-h-64 overflow-auto whitespace-pre-wrap break-all border border-border">
                  <code>{snippet}</code>
                </pre>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => handleCopy(p.id)}
                  className="absolute top-2 right-2 h-7 gap-1 text-xs"
                >
                  {isCopied ? (
                    <><Check className="w-3 h-3 text-green-500" /> Copiado</>
                  ) : (
                    <><Copy className="w-3 h-3" /> Copiar</>
                  )}
                </Button>
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
