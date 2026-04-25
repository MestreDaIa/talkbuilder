import React, { useState } from 'react';
import {
  Code2,
  Copy,
  Check,
  Lock,
  Globe,
  FileCode,
  Boxes,
  ShoppingBag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';

interface EmbedSnippetsProps {
  /** URL pública completa do bot, ex: https://app.com/#/slug/flow/publicId */
  publicUrl: string;
  /** Nome do bot, usado em títulos default */
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
  locked?: boolean;
}

const PLATFORMS: PlatformDef[] = [
  { id: 'wordpress', label: 'WordPress', icon: Globe },
  { id: 'shopify', label: 'Shopify', icon: ShoppingBag },
  { id: 'html', label: 'HTML/JS', icon: FileCode },
  { id: 'iframe', label: 'Iframe', icon: Code2 },
  { id: 'next', label: 'Next.js', icon: Boxes },
  { id: 'react', label: 'React', icon: Boxes },
  { id: 'whatsapp', label: 'WhatsApp', icon: Lock, locked: true },
];

/**
 * Snippets de embed por plataforma.
 * Todos os formatos abrem o bot publicado em um iframe (ou janela embutida)
 * apontando para `publicUrl`. O usuário só precisa colar o snippet.
 */
function buildSnippet(platform: Platform, publicUrl: string, botName: string): string {
  const safeName = botName.replace(/`/g, '');
  const title = `Chatbot - ${safeName}`;

  switch (platform) {
    case 'wordpress':
      // HTML que pode ser colado num bloco "HTML personalizado" do Gutenberg
      // ou em widget de rodapé do WordPress. Abre como botão flutuante.
      return `<!-- TalkBuilder Chatbot - cole este código num bloco HTML personalizado -->
<div id="talkbuilder-chatbot"></div>
<style>
  #talkbuilder-fab {
    position: fixed; bottom: 24px; right: 24px; z-index: 9999;
    width: 60px; height: 60px; border-radius: 50%;
    background: #7c3aed; color: #fff; border: none; cursor: pointer;
    box-shadow: 0 8px 24px rgba(0,0,0,.2);
    display: flex; align-items: center; justify-content: center;
    font-size: 28px;
  }
  #talkbuilder-frame {
    position: fixed; bottom: 96px; right: 24px; z-index: 9999;
    width: 380px; height: 600px; max-width: calc(100vw - 32px);
    max-height: calc(100vh - 120px);
    border: 0; border-radius: 16px; overflow: hidden;
    box-shadow: 0 16px 48px rgba(0,0,0,.25);
    display: none; background: #fff;
  }
  #talkbuilder-frame.open { display: block; }
</style>
<button id="talkbuilder-fab" aria-label="Abrir chat">💬</button>
<iframe id="talkbuilder-frame" src="${publicUrl}" title="${title}"></iframe>
<script>
  (function () {
    var fab = document.getElementById('talkbuilder-fab');
    var frame = document.getElementById('talkbuilder-frame');
    fab.addEventListener('click', function () {
      frame.classList.toggle('open');
    });
  })();
</script>`;

    case 'shopify':
      // Shopify: cole em theme.liquid antes de </body> ou em um snippet.
      return `{% comment %} TalkBuilder Chatbot - cole antes de </body> em theme.liquid {% endcomment %}
<div id="talkbuilder-chatbot"></div>
<style>
  #talkbuilder-fab {
    position: fixed; bottom: 24px; right: 24px; z-index: 9999;
    width: 60px; height: 60px; border-radius: 50%;
    background: #7c3aed; color: #fff; border: none; cursor: pointer;
    box-shadow: 0 8px 24px rgba(0,0,0,.2);
    display: flex; align-items: center; justify-content: center;
    font-size: 28px;
  }
  #talkbuilder-frame {
    position: fixed; bottom: 96px; right: 24px; z-index: 9999;
    width: 380px; height: 600px; max-width: calc(100vw - 32px);
    max-height: calc(100vh - 120px);
    border: 0; border-radius: 16px; overflow: hidden;
    box-shadow: 0 16px 48px rgba(0,0,0,.25);
    display: none; background: #fff;
  }
  #talkbuilder-frame.open { display: block; }
</style>
<button id="talkbuilder-fab" aria-label="Abrir chat">💬</button>
<iframe id="talkbuilder-frame" src="${publicUrl}" title="${title}"></iframe>
<script>
  (function () {
    var fab = document.getElementById('talkbuilder-fab');
    var frame = document.getElementById('talkbuilder-frame');
    fab.addEventListener('click', function () {
      frame.classList.toggle('open');
    });
  })();
</script>`;

    case 'html':
      // HTML + JS standalone (qualquer site)
      return `<!-- TalkBuilder Chatbot - cole no seu HTML -->
<div id="talkbuilder-chatbot"></div>
<style>
  #talkbuilder-fab {
    position: fixed; bottom: 24px; right: 24px; z-index: 9999;
    width: 60px; height: 60px; border-radius: 50%;
    background: #7c3aed; color: #fff; border: none; cursor: pointer;
    box-shadow: 0 8px 24px rgba(0,0,0,.2);
    display: flex; align-items: center; justify-content: center;
    font-size: 28px;
  }
  #talkbuilder-frame {
    position: fixed; bottom: 96px; right: 24px; z-index: 9999;
    width: 380px; height: 600px; max-width: calc(100vw - 32px);
    max-height: calc(100vh - 120px);
    border: 0; border-radius: 16px; overflow: hidden;
    box-shadow: 0 16px 48px rgba(0,0,0,.25);
    display: none; background: #fff;
  }
  #talkbuilder-frame.open { display: block; }
</style>
<button id="talkbuilder-fab" aria-label="Abrir chat">💬</button>
<iframe id="talkbuilder-frame" src="${publicUrl}" title="${title}"></iframe>
<script>
  (function () {
    var fab = document.getElementById('talkbuilder-fab');
    var frame = document.getElementById('talkbuilder-frame');
    fab.addEventListener('click', function () {
      frame.classList.toggle('open');
    });
  })();
</script>`;

    case 'iframe':
      // Iframe puro, fixo na página
      return `<iframe
  src="${publicUrl}"
  title="${title}"
  width="100%"
  height="600"
  style="border:0; border-radius:12px; overflow:hidden;"
  allow="clipboard-write; microphone; camera"
></iframe>`;

    case 'next':
      // Componente Next.js (App Router) que renderiza um iframe full embed
      return `// app/components/TalkBuilderChat.tsx
// Componente de embed do chatbot TalkBuilder para Next.js (App Router).
'use client';

export default function TalkBuilderChat() {
  return (
    <iframe
      src="${publicUrl}"
      title="${title}"
      style={{
        width: '100%',
        height: '600px',
        border: 0,
        borderRadius: 12,
        overflow: 'hidden',
      }}
      allow="clipboard-write; microphone; camera"
    />
  );
}

// Uso:
// import TalkBuilderChat from '@/app/components/TalkBuilderChat';
// <TalkBuilderChat />`;

    case 'react':
      // Componente React puro
      return `// TalkBuilderChat.jsx
// Componente React de embed do chatbot TalkBuilder.
export default function TalkBuilderChat() {
  return (
    <iframe
      src="${publicUrl}"
      title="${title}"
      style={{
        width: '100%',
        height: 600,
        border: 0,
        borderRadius: 12,
        overflow: 'hidden',
      }}
      allow="clipboard-write; microphone; camera"
    />
  );
}`;

    case 'whatsapp':
      return '// Em breve. Integração com WhatsApp Business API.';
  }
}

export function EmbedSnippets({ publicUrl, botName = 'Bot' }: EmbedSnippetsProps) {
  const [active, setActive] = useState<Platform>('wordpress');
  const [copiedPlatform, setCopiedPlatform] = useState<Platform | null>(null);

  const handleCopy = async (platform: Platform) => {
    const def = PLATFORMS.find((p) => p.id === platform);
    if (def?.locked) {
      toast.info('Em breve disponível.');
      return;
    }
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

      <Tabs value={active} onValueChange={(v) => setActive(v as Platform)} className="w-full">
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
                {p.locked && <Lock className="w-2.5 h-2.5 text-muted-foreground" />}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {PLATFORMS.map((p) => {
          const snippet = buildSnippet(p.id, publicUrl, botName);
          const isCopied = copiedPlatform === p.id;
          return (
            <TabsContent key={p.id} value={p.id} className="mt-3 space-y-2">
              {p.locked ? (
                <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                  <Lock className="w-5 h-5 mx-auto mb-2" />
                  Integração com {p.label} em breve.
                </div>
              ) : (
                <>
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
                        <>
                          <Check className="w-3 h-3 text-green-500" /> Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" /> Copiar
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {p.id === 'wordpress' &&
                      'Cole em um bloco "HTML Personalizado" do editor Gutenberg ou em um widget de rodapé.'}
                    {p.id === 'shopify' &&
                      'Cole no seu theme.liquid antes de </body> ou crie um snippet e renderize no layout.'}
                    {p.id === 'html' &&
                      'Cole antes de </body> em qualquer página HTML.'}
                    {p.id === 'iframe' &&
                      'Iframe simples — adicione onde quiser exibir o bot embutido.'}
                    {p.id === 'next' &&
                      'Salve como componente em app/components/ e importe onde precisar.'}
                    {p.id === 'react' &&
                      'Salve como componente .jsx/.tsx no seu projeto React.'}
                  </p>
                </>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
