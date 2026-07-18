import { useEffect, useMemo, useState } from "react";
import { Bell } from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

type N = {
  id: string; title: string; body: string; level: string;
  target_type: string; target_value: string | null;
  created_at: string; expires_at: string | null;
};

const levelDot: Record<string, string> = {
  info: "bg-sky-400",
  success: "bg-emerald-400",
  warning: "bg-amber-400",
  critical: "bg-red-400",
};

export default function NotificationBell() {
  const { user } = useAuth();
  const [items, setItems] = useState<N[]>([]);
  const [reads, setReads] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);

  async function load() {
    if (!user) return;
    const { data: notifs } = await supabase
      .from("notifications" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setItems((notifs as any) ?? []);
    const { data: rs } = await supabase
      .from("notification_reads" as any)
      .select("notification_id")
      .eq("user_id", user.id);
    setReads(new Set(((rs as any) ?? []).map((r: any) => r.notification_id)));
  }

  useEffect(() => {
    if (!user) return;
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line
  }, [user?.id]);

  const unread = useMemo(() => items.filter((n) => !reads.has(n.id)).length, [items, reads]);

  async function markRead(id: string) {
    if (!user || reads.has(id)) return;
    setReads((s) => new Set(s).add(id));
    await supabase.from("notification_reads" as any).insert({
      user_id: user.id, notification_id: id,
    });
  }
  async function markAll() {
    if (!user) return;
    const toInsert = items.filter((n) => !reads.has(n.id)).map((n) => ({
      user_id: user.id, notification_id: n.id,
    }));
    if (!toInsert.length) return;
    setReads(new Set(items.map((n) => n.id)));
    await supabase.from("notification_reads" as any).insert(toInsert);
  }

  if (!user) return null;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button className="relative p-1 hover:bg-white/10 rounded-full transition" title="Notificações">
          <Bell className="w-6 h-6" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-[10px] font-bold flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={8}
          align="end"
          className="z-[200] w-[360px] max-h-[70vh] overflow-hidden rounded-lg border border-white/10 bg-[#12101a] text-white shadow-2xl"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div className="text-sm font-semibold">Notificações</div>
            {unread > 0 && (
              <button onClick={markAll} className="text-[11px] text-white/60 hover:text-white">
                Marcar todas como lidas
              </button>
            )}
          </div>
          <div className="overflow-y-auto max-h-[60vh]">
            {items.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-white/40">Sem notificações.</div>
            )}
            {items.map((n) => {
              const isRead = reads.has(n.id);
              return (
                <button
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  className={`w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/[0.04] ${isRead ? "opacity-60" : ""}`}
                >
                  <div className="flex items-start gap-2">
                    <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${levelDot[n.level] ?? levelDot.info}`} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{n.title}</div>
                      <div className="text-xs text-white/60 mt-0.5 whitespace-pre-line">{n.body}</div>
                      <div className="text-[10px] text-white/40 mt-1">
                        {new Date(n.created_at).toLocaleString("pt-BR")}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
