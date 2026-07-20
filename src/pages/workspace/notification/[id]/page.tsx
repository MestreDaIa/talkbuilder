import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getSupabase } from "@/lib/supabaseClient";
import { ArrowLeft, ExternalLink } from "lucide-react";

const supabase = getSupabase();

type N = {
  id: string; title: string; body: string; level: string;
  image_url: string | null; video_url: string | null; link_url: string | null;
  created_at: string; is_clickable: boolean; short_id: string;
};

const levelBadge: Record<string, string> = {
  info: "bg-sky-500/20 text-sky-200 border-sky-500/30",
  success: "bg-emerald-500/20 text-emerald-200 border-emerald-500/30",
  warning: "bg-amber-500/20 text-amber-200 border-amber-500/30",
  critical: "bg-red-500/20 text-red-200 border-red-500/30",
};

export default function NotificationView() {
  const { slug, shortId } = useParams();
  const [n, setN] = useState<N | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true); setErr(null);
      try {
        const { data, error } = await supabase
          .from("notifications" as any)
          .select("*")
          .eq("short_id", shortId!)
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("Notificação não encontrada");
        setN(data as any);
        // marca como lida
        const { data: u } = await supabase.auth.getUser();
        if (u?.user) {
          await supabase.from("notification_reads" as any).insert({
            user_id: u.user.id, notification_id: (data as any).id,
          });
        }
      } catch (e: any) { setErr(e.message); }
      finally { setLoading(false); }
    })();
  }, [shortId]);

  return (
    <div className="max-w-3xl mx-auto p-6 md:p-8">
      <Link to={`/${slug}/workspace`} className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white mb-6">
        <ArrowLeft className="w-4 h-4" /> Voltar ao workspace
      </Link>

      {loading && <div className="text-white/40 text-sm">Carregando…</div>}
      {err && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{err}</div>}

      {n && (
        <article className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
          {n.image_url && (
            <img src={n.image_url} alt={n.title} className="w-full max-h-[420px] object-cover" />
          )}
          {n.video_url && (
            <video src={n.video_url} controls className="w-full max-h-[420px] bg-black" />
          )}
          <div className="p-6 md:p-8 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2 py-0.5 rounded-full border text-xs capitalize ${levelBadge[n.level] ?? levelBadge.info}`}>
                {n.level}
              </span>
              <span className="text-xs text-white/40">
                {new Date(n.created_at).toLocaleString("pt-BR")}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-semibold">{n.title}</h1>
            <div className="text-sm text-white/70 whitespace-pre-line leading-relaxed">{n.body}</div>
            {n.link_url && (
              <a href={n.link_url} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-2 mt-2 px-4 py-2 rounded-md bg-white text-black text-sm font-medium hover:bg-white/90">
                Abrir link <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        </article>
      )}
    </div>
  );
}
