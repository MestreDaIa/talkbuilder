import { useEffect, useState } from "react";
import { adminApi } from "@/lib/adminApi";
import { BookOpen, Check, Eye, EyeOff, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";

type BotOption = { id: string; title: string; workspace_name: string | null; owner_email: string | null };
type Template = {
  id: string; title: string; description: string | null; category: string; emoji: string;
  source_flow_id: string | null; source_bot_name: string | null; is_published: boolean; created_at: string;
};

export default function AdminTemplates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [bots, setBots] = useState<BotOption[]>([]);
  const [sourceId, setSourceId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Geral");
  const [emoji, setEmoji] = useState("🤖");
  const [published, setPublished] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [templateResult, botResult] = await Promise.all([
        adminApi.listTemplates(),
        adminApi.listBots(),
      ]);
      setTemplates(templateResult.templates ?? []);
      setBots(botResult.bots ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Não foi possível carregar os templates.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function createTemplate(e: React.FormEvent) {
    e.preventDefault();
    if (!sourceId || !title.trim()) {
      setError("Escolha um bot de origem e informe o nome do template.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await adminApi.createTemplate({
        source_flow_id: sourceId,
        title: title.trim(),
        description: description.trim() || undefined,
        category: category.trim() || "Geral",
        emoji: emoji.trim() || "🤖",
        is_published: published,
      });
      setTitle("");
      setDescription("");
      setSourceId("");
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Não foi possível criar o template.");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished(t: Template) {
    setBusyId(t.id);
    setError(null);
    try {
      await adminApi.templateAction(t.id, t.is_published ? "unpublish" : "publish");
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Não foi possível atualizar o template.");
    } finally {
      setBusyId(null);
    }
  }

  async function removeTemplate(t: Template) {
    if (!window.confirm(`Excluir o template "${t.title}"? Os bots já criados a partir dele não serão afetados.`)) return;
    setBusyId(t.id);
    setError(null);
    try {
      await adminApi.deleteTemplate(t.id);
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Não foi possível excluir o template.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Templates</h1>
          <p className="mt-1 text-sm text-white/50">Publique modelos de bots para aparecerem no catálogo dos workspaces.</p>
        </div>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm hover:bg-white/5">
          <RefreshCw className="h-4 w-4" /> Atualizar
        </button>
      </header>

      <form onSubmit={createTemplate} className="space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          <h2 className="font-semibold">Criar template a partir de um bot existente</h2>
        </div>
        <p className="text-sm text-white/50">O catálogo salva uma cópia do rascunho atual e remove valores de credenciais conhecidos. Alterações futuras no bot original não alteram o modelo publicado.</p>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-xs text-white/60">
            <span>Bot de origem</span>
            <select required value={sourceId} onChange={(e) => {
              const id = e.target.value;
              setSourceId(id);
              const source = bots.find((b) => b.id === id);
              if (source && !title.trim()) setTitle(source.title);
            }} className="w-full rounded-md border border-white/10 bg-[#15121e] px-3 py-2 text-sm text-white">
              <option value="">Selecione um bot…</option>
              {bots.map((b) => <option key={b.id} value={b.id}>{b.title} — {b.workspace_name ?? b.owner_email ?? "Workspace"}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs text-white/60">
            <span>Nome público do template</span>
            <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Assistente de atendimento" className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" />
          </label>
          <label className="space-y-1 text-xs text-white/60">
            <span>Categoria</span>
            <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Atendimento, vendas…" className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" />
          </label>
          <label className="space-y-1 text-xs text-white/60">
            <span>Emoji</span>
            <input value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={8} className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" />
          </label>
          <label className="space-y-1 text-xs text-white/60 md:col-span-2">
            <span>Descrição</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Explique o que este modelo faz." className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm text-white/80">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          Publicar imediatamente no catálogo dos workspaces
        </label>
        <button disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {saving ? "Salvando…" : "Criar template"}
        </button>
      </form>

      {error && <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}

      <section className="space-y-3">
        <h2 className="font-semibold">Modelos cadastrados <span className="text-sm font-normal text-white/40">({templates.length})</span></h2>
        {loading ? <div className="flex items-center gap-2 py-8 text-sm text-white/50"><Loader2 className="h-4 w-4 animate-spin" /> Carregando templates…</div>
        : templates.length === 0 ? <div className="rounded-xl border border-white/10 p-8 text-center text-sm text-white/50">Nenhum template cadastrado ainda.</div>
        : <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="min-w-[760px] w-full text-sm">
              <thead className="bg-white/[0.04] text-left text-xs uppercase text-white/50">
                <tr><th className="px-4 py-3">Template</th><th className="px-4 py-3">Origem</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Ações</th></tr>
              </thead>
              <tbody>
                {templates.map((t) => <tr key={t.id} className="border-t border-white/5">
                  <td className="px-4 py-3"><div className="font-medium">{t.emoji} {t.title}</div><div className="text-xs text-white/45">{t.category} · {t.description || "Sem descrição"}</div></td>
                  <td className="px-4 py-3 text-white/60">{t.source_bot_name || "Bot removido"}</td>
                  <td className="px-4 py-3"><span className={t.is_published ? "text-emerald-300" : "text-amber-300"}>{t.is_published ? "Publicado" : "Rascunho"}</span></td>
                  <td className="px-4 py-3"><div className="flex justify-end gap-2">
                    <button type="button" disabled={busyId === t.id} onClick={() => void togglePublished(t)} title={t.is_published ? "Retirar do catálogo" : "Publicar"} className="rounded-md border border-white/10 p-2 hover:bg-white/10 disabled:opacity-50">{t.is_published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                    <button type="button" disabled={busyId === t.id} onClick={() => void removeTemplate(t)} title="Excluir template" className="rounded-md border border-red-500/20 p-2 text-red-300 hover:bg-red-500/10 disabled:opacity-50"><Trash2 className="h-4 w-4" /></button>
                  </div></td>
                </tr>)}
              </tbody>
            </table>
          </div>}
      </section>
      <p className="flex items-start gap-2 text-xs text-white/40"><BookOpen className="h-4 w-4 shrink-0" /> Modelos publicados ficam disponíveis para usuários autenticados. Cada uso cria uma cópia independente e conta no limite de bots do workspace.</p>
    </div>
  );
}
