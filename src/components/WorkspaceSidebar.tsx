"use client";

import { useState } from "react";
import { Activity, Boxes, ChevronLeft, ChevronRight, Home, LogOut, Plug, Settings2, UserRound } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { configsRoute, perfilRoute, workspaceRoot } from "../lib/workspaceRoutes";
import { useEmbed } from "../context/EmbedContext";

export default function WorkspaceSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { profile, currentWorkspace, signOut, user } = useAuth();
  const { flags } = useEmbed();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const slug = currentWorkspace?.slug ?? profile?.slug;

  const items = [
    { label: "Visão geral", icon: Home, path: slug ? `/${slug}/workspace/overview` : "/" },
    { label: "Fluxos", icon: Boxes, path: workspaceRoot(slug) },
    { label: "Execuções", icon: Activity, path: slug ? `/${slug}/workspace/executions` : "/" },
    { label: "Integrações", icon: Plug, path: slug ? `/${slug}/workspace/integrations` : "/" },
  ];

  const isActive = (path: string, label: string) => {
    if (label === "Fluxos") return /^\/[^/]+\/workspace(?:\/folder\/[^/]+)?\/?$/.test(pathname);
    return pathname === path;
  };

  async function handleLogout() {
    await signOut();
    navigate("/");
  }

  return (
    <aside className={`${collapsed ? "w-[64px]" : "w-[220px]"} shrink-0 border-r bg-[#08060d] text-white h-full flex flex-col transition-[width] duration-200`}>
      <div className={`flex items-center border-b border-white/10 h-[72px] ${collapsed ? "justify-center px-2" : "justify-between px-4"}`}>
        {!collapsed && (
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">Workspace</div>
            <div className="mt-1 truncate text-sm font-semibold">{currentWorkspace?.name ?? profile?.display_name ?? "Meu workspace"}</div>
          </div>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          title={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
          className="h-9 w-9 shrink-0 rounded-lg flex items-center justify-center text-white/65 hover:bg-white/10 hover:text-white transition-colors"
        >
          {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {items.map(({ label, icon: Icon, path }) => (
          <button
            key={label}
            type="button"
            onClick={() => navigate(path)}
            title={collapsed ? label : undefined}
            className={`w-full flex items-center rounded-lg py-2.5 text-sm transition-colors ${collapsed ? "justify-center px-0" : "gap-3 px-3 text-left"} ${
              isActive(path, label)
                ? "bg-white/10 text-white"
                : "text-white/60 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{label}</span>}
          </button>
        ))}
      </nav>

      <div className="border-t border-white/10 p-3 space-y-1">
        {flags.showProfile && (
          <button
            type="button"
            onClick={() => navigate(perfilRoute(slug))}
            title={collapsed ? "Perfil" : undefined}
            className={`w-full flex items-center rounded-lg py-2.5 text-sm text-white/65 hover:bg-white/5 hover:text-white transition-colors ${collapsed ? "justify-center px-0" : "gap-3 px-3 text-left"}`}
          >
            <UserRound className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Perfil</span>}
          </button>
        )}

        <button
          type="button"
          onClick={() => navigate(configsRoute(slug))}
          title={collapsed ? "Configurações" : undefined}
          className={`w-full flex items-center rounded-lg py-2.5 text-sm text-white/65 hover:bg-white/5 hover:text-white transition-colors ${collapsed ? "justify-center px-0" : "gap-3 px-3 text-left"}`}
        >
          <Settings2 className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Configurações</span>}
        </button>

        {flags.allowLogout && user && (
          <button
            type="button"
            onClick={handleLogout}
            title={collapsed ? "Sair" : undefined}
            className={`w-full flex items-center rounded-lg py-2.5 text-sm text-white/65 hover:bg-white/5 hover:text-white transition-colors ${collapsed ? "justify-center px-0" : "gap-3 px-3 text-left"}`}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Sair</span>}
          </button>
        )}
      </div>
    </aside>
  );
}
