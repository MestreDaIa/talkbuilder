import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, RefreshCw } from "lucide-react";
import { TestPanel } from "@/components/chatbot/TestPanel";
import { VariablesProvider } from "@/context/VariablesContext";
import { Button } from "@/components/ui/button";
import { getPublicFlow, type PublicFlowResult } from "@/lib/flowsApi";
import type { Container, Edge } from "@/types/chatbot";

/**
 * Página pública do bot publicado.
 * URL: /:slug/flow/:publicId
 * Usa o mesmo motor do TestPanel para executar a versão `published_*`.
 */
export default function PublicFlowPage() {
  const params = useParams();
  const slug = (params.slug as string) ?? "";
  const publicId = (params.publicId as string) ?? "";

  const [data, setData] = useState<PublicFlowResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        console.log('[PublicFlowPage] buscando bot publicado', { slug, publicId });
        const row = await getPublicFlow(slug, publicId);
        console.log('[PublicFlowPage] resposta RPC get_public_flow:', row);
        if (cancelled) return;
        if (!row) {
          setError(
            'Nenhum bot publicado foi encontrado para este link. Verifique se o bot está publicado e ativo, e se o link está correto.'
          );
        } else {
          setData(row);
        }
      } catch (err: any) {
        console.error('[PublicFlowPage] erro carregando bot:', err);
        setError(err?.message ?? 'Erro ao carregar bot');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [slug, publicId]);

  // Aplica metadata
  useEffect(() => {
    if (!data) return;
    const meta = (data.settings as any)?.metadata ?? {};
    if (meta.title) document.title = meta.title;
    else if (data.name) document.title = data.name;
    if (meta.favicon) {
      let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = meta.favicon;
    }
  }, [data]);

  const containers: Container[] = data?.containers ?? [];
  const edges: Edge[] = data?.edges ?? [];
  const startContainer = containers[0] ?? null;

  return (
    <VariablesProvider>
      <div className="fixed inset-0 z-50 flex flex-col bg-background text-foreground">
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center flex-col gap-3 px-6 text-center">
            <p className="text-lg font-semibold text-foreground">Bot não encontrado</p>
            <p className="text-sm text-muted-foreground max-w-md">{error}</p>
            <p className="text-xs text-muted-foreground/70 break-all">
              slug: <code className="text-foreground">{slug || '(vazio)'}</code> · id:{' '}
              <code className="text-foreground">{publicId || '(vazio)'}</code>
            </p>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="gap-1 mt-2">
              <RefreshCw className="w-3 h-3" /> Tentar novamente
            </Button>
          </div>
        ) : !startContainer ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Este bot ainda não tem conteúdo publicado.
          </div>
        ) : (
          <TestPanel
            isOpen={true}
            onClose={() => {
              /* público: não faz nada */
            }}
            startContainer={startContainer}
            allContainers={containers}
            edges={edges}
          />
        )}
      </div>
    </VariablesProvider>
  );
}
