"use client";

import { Activity, Boxes, Home, Plug, Settings2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";
import { configsRoute, workspaceRoot } from "../lib/workspaceRoutes";

const items = [
  { key: "overview", label: "Visão geral", icon: Home },
  { key: "flows", label: "Fluxos", icon: Boxes },
  { key: "executions", label: "Execuções", icon: Activity },
  { key: "integrations", label: "Integrações", icon: Plug },
  { key: "settings", label: "Configurações", icon: Settings2 },
] as const;

export default function WorkspaceSidebar() {
  const { profile, currentWorkspace } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const slug = currentWorkspace?.slug ?? profile?.slug;
  const base = workspaceRoot(slug);

  function routeFor(key: (typeof items)[number]["key"]) {
    switch (key) {
      case "overview":
        return `${base}/overview`;
      case "flows":
        return base;
      case "executions":
        return `${base}/executions`;
      case "integrations":
        return `${base}/integrations`;
      case "settings":
        return configsRoute(slug);
    }
  }

  function isActive(key: (typeof items)[number]["key"]) {
    const route = routeFor(key);
    if (key === "flows") {
      return pathname === base || pathname.startsWith(`${base}/folder/`);
    }
    return pathname === route;
  }

  return (
    <aside className="w-[220px] min-w-[220px] h-full shrink-0 border-r bg-slate-950 text-slate-100 flex flex-col">
      <div className="px-5 py-5 border-b border-slate-800">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Workspace
        </div>
        <div className="mt-1 truncate text-sm font-semibold text-white">
          {currentWorkspace?.name ?? "Meu workspace"}
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1" aria-label="Navegação do workspace">
        {items.map(({ key, label, icon: Icon }) => {
          const active = isActive(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => navigate(routeFor(key))}
              className={[
                "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                active
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-100",
              ].join(" ")}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>

      <div className="px-5 py-4 border-t border-slate-800">
        <div className="text-[10px] uppercase tracking-[0.16em] text-slate-600">
          Zailom Flow
        </div>
        <div className="mt-1 text-xs text-slate-500">
          Automação conectada
        </div>
      </div>
    </aside>
  );
}
