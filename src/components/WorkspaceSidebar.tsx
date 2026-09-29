"use client";

import { Activity, Boxes, Home, Plug, Settings2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { configsRoute, workspaceRoot } from "../lib/workspaceRoutes";

export default function WorkspaceSidebar() {
  const { profile, currentWorkspace } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const slug = currentWorkspace?.slug ?? profile?.slug;

  const items = [
    { label: "Visão geral", icon: Home, path: slug ? `/${slug}/workspace/overview` : "/" },
    { label: "Fluxos", icon: Boxes, path: workspaceRoot(slug) },
    { label: "Execuções", icon: Activity, path: slug ? `/${slug}/workspace/executions` : "/" },
    { label: "Integrações", icon: Plug, path: slug ? `/${slug}/workspace/integrations` : "/" },
    { label: "Configurações", icon: Settings2, path: configsRoute(slug) },
  ];

  const isActive = (path: string, label: string) => {
    if (label === "Fluxos") {
      return /^\/[^/]+\/workspace(?:\/folder\/[^/]+)?\/?$/.test(pathname);
    }
    return pathname === path;
  };

  return (
    <aside className="w-[220px] shrink-0 border-r bg-background h-full flex flex-col">
      <div className="px-4 py-5 border-b">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Workspace</div>
        <div className="mt-1 truncate text-sm font-semibold">
          {currentWorkspace?.name ?? profile?.display_name ?? "Meu workspace"}
        </div>
      </div>

      <nav className="p-3 space-y-1">
        {items.map(({ label, icon: Icon, path }) => (
          <button
            key={label}
            type="button"
            onClick={() => navigate(path)}
            className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-left transition-colors ${
              isActive(path, label)
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
