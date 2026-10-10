"use client";

import { useEffect, useState } from "react";
import { BookOpen, CheckCircle2, Loader2, Search, Sparkles } from "lucide-react";
import { getSupabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { usePlan } from "@/context/PlanContext";
import { nextIndexFor } from "@/lib/workspaceOrder";
import { botRoute, rememberBotBackRoute, workspaceRoot } from "@/lib/workspaceRoutes";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

type Template = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  emoji: string;
  snapshot: {
    settings?: Record<string, unknown>;
    draft_containers?: unknown[];
    draft_edges?: unknown[];
  };
};

export default function WorkspaceTemplatesPage() {
  const supabase = getSupabase();
  const { user, profile, currentWorkspace } = useAuth();
  const { items, setItems } = useWorkspace();
  const { canAddBot, remainingBots, isSuspended } = usePlan();
  const navigate = useNavigate();
  const slug = currentWorkspace?.slug ?? profile?.slug;
  const [templates, setTemplates] = useState<Template[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [usingId, setUsingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!supabase) {
        setError("Supabase não está configurado.");
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data, error: queryError } = await supabase
        .from("bot_templates")
        .select("id,title,description,category,emoji,snapshot")
        .eq("is_published", true)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (queryError) setError(queryError.message);
      else setTemplates((data ?? []) as Template[]);
      setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [supabase]);

  const visibleTemplates = templates.filter((t) => {
    const q = search.trim().toLocaleLowerCase();
    return !q || [t.title, t.description ?? "", t.category].some((v) => v.toLocaleLowerCase().includes(q));
  });

  async function useTemplate(template: Template) {
    if (!supabase || !user || !currentWorkspace) {
      setError("Entre na sua conta e selecione um workspace para usar um template.");
      return;
    }
    if (isSuspended) {
      setError("Este workspace está suspenso e não pode criar bots.");
      return;
    }
    if (!canAddBot) {
      setError("Você atingiu o limite de bots do seu plano. Exclua um bot ou altere o plano para continuar.");
      return;
    }

    setUsingId(template.id);
    setError(null);
    const itemId = crypto.randomUUID();
    const name = template.title.trim();
    const description = template.description ?? "";
    const emoji = template.emoji || "🤖";
    const indexItem = nextIndexFor(items, null);

    try {
      const { error: itemError } = await supabase.from("workspace_items").insert({
        id: itemId,
        workspace_id: currentWorkspace.id,
        user_id: user.id,
        type: "bot",
        title: name,
        description,
        emoji,
        parent_id: null,
        index_item: indexItem,
      });
      if (itemError) throw itemError;

      const snapshot = template.snapshot ?? {};
      const { error: flowError } = await supabase.from("chatbot_flows").insert({
        workspace_id: currentWorkspace.id,
        user_id: user.id,
        workspace_item_id: itemId,
        name,
        description,
        settings: snapshot.settings ?? {},
        draft_containers: snapshot.draft_containers ?? [],
        draft_edges: snapshot.draft_edges ?? [],
      });
      if (flowError) {
        await supabase.from("workspace_items").delete().eq("id", itemId);
        throw flowError;
      }

      setItems((prev) => [...prev, {
        id: itemId,
        type: "bot",
        title: name,
        description,
        emoji,
        parentId: null,
        indexItem,
        persisted: true,
      }]);
      rememberBotBackRoute(itemId, workspaceRoot(slug));
      toast.success("Template adicionado ao seu workspace.");
      navigate(botRoute(slug, itemId));
    } catch (e: any) {
      setError(e?.message ?? "Não foi possível criar o bot a partir deste template.");
    } finally {
      setUsingId(null);
    }
  }

  return (
    <div className="min-h-full bg-muted/20 p-6 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-primary">Biblioteca de modelos</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Templates</h1>
            <p className="mt-2 text-muted-foreground">Comece com um modelo pronto e personalize o fluxo para sua necessidade.</p>
          </div>
          <div className="rounded-xl border bg-background px-4 py-3 text-sm">
            <div className="text-muted-foreground">Bots restantes</div>
            <div className="font-semibold">{Number.isFinite(remainingBots) ? remainingBots : "Ilimitado"}</div>
          </div>
        </header>

        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, descrição ou categoria…" className="w-full rounded-lg border bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
        </div>

        {error && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
        {loading ? <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando templates…</div>
        : visibleTemplates.length === 0 ? <div className="rounded-xl border bg-background p-12 text-center"><BookOpen className="mx-auto h-8 w-8 text-muted-foreground" /><h2 className="mt-3 font-semibold">Nenhum template encontrado</h2><p className="mt-1 text-sm text-muted-foreground">{search ? "Tente outra busca." : "Ainda não há modelos publicados. Volte mais tarde."}</p></div>
        : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleTemplates.map((t) => <article key={t.id} className="flex flex-col rounded-xl border bg-background p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted text-2xl">{t.emoji || "🤖"}</div>
                <div className="min-w-0 flex-1"><span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">{t.category || "Geral"}</span><h2 className="mt-2 font-semibold">{t.title}</h2></div>
              </div>
              <p className="mt-3 flex-1 whitespace-pre-wrap text-sm text-muted-foreground">{t.description || "Modelo pronto para personalizar."}</p>
              <button type="button" disabled={usingId !== null || !canAddBot || isSuspended} onClick={() => void useTemplate(t)} className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
                {usingId === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {usingId === t.id ? "Criando bot…" : "Usar template"}
              </button>
            </article>)}
          </div>}

        {!canAddBot && !isSuspended && <p className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4" /> Você atingiu o limite de bots do seu plano. O botão será habilitado novamente quando houver espaço.</p>}
      </div>
    </div>
  );
}
