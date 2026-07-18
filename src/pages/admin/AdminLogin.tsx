import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { ShieldCheck, Loader2 } from "lucide-react";

export default function AdminLogin() {
  const { user, loading: authLoading } = useAuth();
  const { isSuperAdmin, loading: roleLoading } = useSuperAdmin();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!authLoading && !roleLoading && user && isSuperAdmin) {
    return <Navigate to="/admin" replace />;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      // valida role super_admin
      const { data: role } = await supabase
        .from("user_roles" as any)
        .select("role")
        .eq("user_id", data.user!.id)
        .eq("role", "super_admin")
        .maybeSingle();
      if (!role) {
        await supabase.auth.signOut();
        throw new Error("Este usuário não é Super Admin.");
      }
      nav("/admin", { replace: true });
    } catch (e: any) {
      setErr(e.message ?? "Falha no login");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-svh flex items-center justify-center bg-[#0b0a12] text-white px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0f0d18] p-6 space-y-5 shadow-2xl"
      >
        <div className="flex items-center gap-2 text-white/80">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <div>
            <div className="text-[11px] uppercase tracking-widest text-white/40">Zailom</div>
            <div className="text-lg font-semibold leading-tight">Super Admin</div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-white/60">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md bg-black/40 border border-white/10 px-3 py-2 text-sm outline-none focus:border-primary/60"
            autoComplete="username"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs text-white/60">Senha</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md bg-black/40 border border-white/10 px-3 py-2 text-sm outline-none focus:border-primary/60"
            autoComplete="current-password"
          />
        </div>

        {err && (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-200">
            {err}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-primary text-primary-foreground text-sm font-medium py-2 hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          Entrar
        </button>

        <p className="text-[11px] text-white/40 text-center">
          Área restrita — acessos são registrados na auditoria.
        </p>
      </form>
    </div>
  );
}
