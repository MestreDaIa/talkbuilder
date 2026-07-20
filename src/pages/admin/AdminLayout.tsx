import { NavLink, Outlet, Navigate } from "react-router-dom";
import {
  LayoutDashboard, Building2, Users, Bot, CreditCard, DollarSign, Bell, FileClock, ArrowLeft,
} from "lucide-react";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useAuth } from "@/context/AuthContext";

const NAV = [
  { to: "/admin", end: true, label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/workspaces", label: "Workspaces", icon: Building2 },
  { to: "/admin/users", label: "Usuários", icon: Users },
  { to: "/admin/bots", label: "Bots", icon: Bot },
  { to: "/admin/plans", label: "Planos", icon: CreditCard },
  { to: "/admin/billing", label: "Faturamento", icon: DollarSign },
  { to: "/admin/notifications", label: "Notificações", icon: Bell },
  { to: "/admin/audit", label: "Auditoria", icon: FileClock },
];

export default function AdminLayout() {
  const { user, loading } = useAuth();
  const { isSuperAdmin, loading: roleLoading } = useSuperAdmin();

  if (loading || roleLoading) {
    return (
      <div className="min-h-svh flex items-center justify-center bg-[#0b0a12] text-white/70 text-sm">
        Verificando permissões…
      </div>
    );
  }
  if (!user) return <Navigate to="/admin/login" replace />;
  if (!isSuperAdmin) {
    return (
      <div className="min-h-svh flex items-center justify-center bg-[#0b0a12] text-white text-center px-6">
        <div className="max-w-md space-y-3">
          <h1 className="text-2xl font-semibold">Acesso negado</h1>
          <p className="text-sm text-white/60">
            Você não tem permissão para acessar esta área.
          </p>
          <NavLink to="/" className="inline-block text-sm text-primary underline underline-offset-4">
            Voltar
          </NavLink>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-svh flex bg-[#0b0a12] text-white">
      <aside className="w-60 shrink-0 border-r border-white/10 bg-[#0f0d18] flex flex-col">
        <div className="px-5 py-5 border-b border-white/10">
          <div className="text-[11px] uppercase tracking-widest text-white/40">Zailom</div>
          <div className="text-lg font-semibold">Super Admin</div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(({ to, end, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end as any}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-md text-sm transition ${
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                }`
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10">
          <NavLink
            to="/"
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-white/60 hover:bg-white/5 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao app
          </NavLink>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-6 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
