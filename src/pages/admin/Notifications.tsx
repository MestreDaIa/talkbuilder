import { useEffect, useRef, useState } from "react";
import { adminApi } from "@/lib/adminApi";
import { getSupabase } from "@/lib/supabaseClient";
import { Trash2, Send, Upload, Loader2 } from "lucide-react";

const supabase = getSupabase();

type N = {
  id: string; title: string; body: string; level: string;
  target_type: string; target_value: string | null;
  created_at: string; expires_at: string | null;
  is_clickable: boolean; preview: string | null; short_id: string;
  image_url: string | null; video_url: string | null; link_url: string | null;
};

const LEVELS = ["info", "success", "warning", "critical"] as const;
const TARGETS = [
  { value: "global", label: "Todos os usuários" },
  { value: "plan", label: "Por plano (starter/pro/business)" },
  { value: "workspace", label: "Workspace específico (id)" },
  { value: "user", label: "Usuário específico (id)" },
] as const;

export default function AdminNotifications() {
  const [items, setItems] = useState<N[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("info");
  const [target_type, setTargetType] = useState<(typeof TARGETS)[number]["value"]>("global");
  const [target_value, setTargetValue] = useState("");
  const [expires_at, setExpiresAt] = useState("");
  const [isClickable, setIsClickable] = useState(false);
  const [preview, setPreview] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [uploadingImg, setUploadingImg] = useState(false);
  const [uploadingVid, setUploadingVid] = useState(false);
  const imgRef = useRef<HTMLInputElement>(null);
  const vidRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const r = await adminApi.listNotifications();
    setItems(r.notifications ?? []);
  }
  useEffect(() => { load(); }, []);

  async function uploadFile(file: File, kind: "image" | "video") {
    const setUp = kind === "image" ? setUploadingImg : setUploadingVid;
    setUp(true);
    try {
      const ext = file.name.split(".").pop() || (kind === "image" ? "png" : "mp4");
      const path = `${kind}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("notifications").upload(path, file, {
        cacheControl: "3600", upsert: false,
      });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("notifications").getPublicUrl(path);
      if (kind === "image") setImageUrl(data.publicUrl);
      else setVideoUrl(data.publicUrl);
    } catch (e: any) {
      alert(`Falha no upload: ${e.message}`);
    } finally { setUp(false); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await adminApi.createNotification({
        title, body, level, target_type,
        target_value: target_type === "global" ? null : target_value || null,
        expires_at: expires_at ? new Date(expires_at).toISOString() : null,
        is_clickable: isClickable,
        preview: isClickable ? (preview || null) : null,
        image_url: imageUrl || null,
        video_url: videoUrl || null,
        link_url:  linkUrl  || null,
      });
      setTitle(""); setBody(""); setTargetValue(""); setExpiresAt("");
      setPreview(""); setImageUrl(""); setVideoUrl(""); setLinkUrl("");
      setIsClickable(false);
      await load();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }

  async function del(id: string) {
    if (!confirm("Excluir notificação?")) return;
    try { await adminApi.deleteNotification(id); await load(); }
    catch (e: any) { alert(e.message); }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Notificações</h1>
        <p className="text-sm text-white/50">Envie avisos para usuários — aparecem no sino do header.</p>
      </div>

      <form onSubmit={submit} className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-white/60 mb-1 block">Título</label>
            <input required value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-white/60 mb-1 block">Nível</label>
            <select value={level} onChange={(e) => setLevel(e.target.value as any)}
              className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm">
              {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs text-white/60 mb-1 block">Mensagem completa</label>
          <textarea required value={body} onChange={(e) => setBody(e.target.value)} rows={4}
            className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm" />
        </div>

        <label className="flex items-center gap-2 select-none cursor-pointer">
          <input type="checkbox" checked={isClickable} onChange={(e) => setIsClickable(e.target.checked)} />
          <span className="text-sm">Notificação clicável (abre página dedicada com mídia)</span>
        </label>

        {isClickable && (
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 space-y-3">
            <div className="text-[11px] text-white/40 leading-relaxed">
              Quando <strong>clicável</strong>, o sino mostra apenas um teaser curto e o usuário clica para abrir
              <code className="mx-1 px-1 rounded bg-white/10 text-white/80">/:slug/notification/:id</code>
              com título, corpo completo, imagem, vídeo e link — se fornecidos.
            </div>

            <div>
              <label className="text-xs text-white/60 mb-1 block">Preview (curto, exibido no sino)</label>
              <input value={preview} onChange={(e) => setPreview(e.target.value)}
                maxLength={140} placeholder="Ex.: Nova atualização disponível — clique para ver…"
                className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm" />
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/60 mb-1 block">Imagem</label>
                <div className="flex gap-2">
                  <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="URL ou faça upload"
                    className="flex-1 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm" />
                  <input ref={imgRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0], "image")} />
                  <button type="button" onClick={() => imgRef.current?.click()}
                    className="px-3 rounded-md bg-white/10 hover:bg-white/20 text-xs inline-flex items-center gap-1">
                    {uploadingImg ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    Upload
                  </button>
                </div>
                {imageUrl && <img src={imageUrl} className="mt-2 max-h-32 rounded border border-white/10" alt="" />}
              </div>

              <div>
                <label className="text-xs text-white/60 mb-1 block">Vídeo</label>
                <div className="flex gap-2">
                  <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="URL ou faça upload"
                    className="flex-1 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm" />
                  <input ref={vidRef} type="file" accept="video/*" className="hidden"
                    onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0], "video")} />
                  <button type="button" onClick={() => vidRef.current?.click()}
                    className="px-3 rounded-md bg-white/10 hover:bg-white/20 text-xs inline-flex items-center gap-1">
                    {uploadingVid ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    Upload
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs text-white/60 mb-1 block">Link externo (opcional)</label>
              <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://…"
                className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm" />
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-white/60 mb-1 block">Alvo</label>
            <select value={target_type} onChange={(e) => setTargetType(e.target.value as any)}
              className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm">
              {TARGETS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          {target_type !== "global" && (
            <div>
              <label className="text-xs text-white/60 mb-1 block">
                {target_type === "plan" ? "Plano (starter|pro|business|suspended)" : "ID"}
              </label>
              <input required value={target_value} onChange={(e) => setTargetValue(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm" />
            </div>
          )}
          <div>
            <label className="text-xs text-white/60 mb-1 block">Expira em (opcional)</label>
            <input type="datetime-local" value={expires_at} onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm" />
          </div>
        </div>

        {err && <div className="text-sm text-red-300">{err}</div>}
        <button disabled={busy}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-white text-black text-sm font-medium hover:bg-white/90 disabled:opacity-50">
          <Send className="w-4 h-4" /> {busy ? "Enviando…" : "Publicar notificação"}
        </button>
      </form>

      <div className="rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.04] text-white/50 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">Título</th>
              <th className="text-left px-4 py-2">Alvo</th>
              <th className="text-left px-4 py-2">Nível</th>
              <th className="text-left px-4 py-2">Modo</th>
              <th className="text-left px-4 py-2">Criada</th>
              <th className="text-left px-4 py-2">Expira</th>
              <th className="text-right px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((n) => (
              <tr key={n.id} className="border-t border-white/5">
                <td className="px-4 py-3">
                  <div className="font-medium">{n.title}</div>
                  <div className="text-white/50 text-xs line-clamp-2">{n.body}</div>
                </td>
                <td className="px-4 py-3 text-xs">
                  <div className="capitalize">{n.target_type}</div>
                  {n.target_value && <div className="text-white/40 font-mono">{n.target_value}</div>}
                </td>
                <td className="px-4 py-3 text-xs capitalize">{n.level}</td>
                <td className="px-4 py-3 text-xs">
                  {n.is_clickable
                    ? <span className="text-primary">clicável</span>
                    : <span className="text-white/40">simples</span>}
                </td>
                <td className="px-4 py-3 text-xs text-white/60">
                  {new Date(n.created_at).toLocaleString("pt-BR")}
                </td>
                <td className="px-4 py-3 text-xs text-white/60">
                  {n.expires_at ? new Date(n.expires_at).toLocaleString("pt-BR") : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => del(n.id)} className="p-1.5 rounded hover:bg-red-500/20">
                    <Trash2 className="w-4 h-4 text-red-300" />
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-white/40">Nenhuma notificação.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
