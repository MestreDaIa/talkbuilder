import { LogOut, Settings } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useNavigate } from "react-router-dom";
import { useEmbed } from "../context/EmbedContext";
import { useAuth } from "../context/AuthContext";
import { configsRoute, perfilRoute, workspaceRoot } from "../lib/workspaceRoutes";
import logoMark from "../assets/logo-mark.svg";
import logoWordmark from "../assets/logo-wordmark.svg";

export default function Header() {
  const navigate = useNavigate();
  const { flags } = useEmbed();
  const { user, profile, signOut, currentWorkspace } = useAuth();
  const slug = currentWorkspace?.slug || profile?.slug;
  const userRole = currentWorkspace?.role || 'owner';
  const showSettings = userRole === 'owner' || userRole === 'admin';

  async function handleLogout() {
    await signOut();
    navigate("/");
  }

  return (
    <div className="relative top-0 left-0 w-full bg-gray-800 text-white flex items-center justify-between py-2 px-4 sm:px-9 z-[99] gap-3">
      <button
        type="button"
        className="cursor-pointer shrink-0 flex items-center gap-2"
        onClick={() => navigate(workspaceRoot(slug))}
      >
        <img src={logoMark} alt="ZyloFlow" className="h-7 w-auto" />
      </button>
      <h1 className="flex-1 text-center flex items-center justify-center gap-2 truncate">
        <img src={logoWordmark} alt="ZyloFlow" className="h-6 w-auto inline-block" />
        <span className="text-base sm:text-lg font-semibold truncate">
          {slug ? `@${slug}` : ""}
          {profile?.display_name ? ` - ${profile.display_name}` : ""}
        </span>
      </h1>
      <div className="flex items-center shrink-0 gap-2">
        {showSettings && (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Settings className="relative z-10 w-6 h-6 cursor-pointer" />
            </DropdownMenu.Trigger>

            <DropdownMenu.Content
              side="left"
              sideOffset={8}
              className="relative z-10 data-[side=left]:animate-slide-down data-[side=right]:animate-slide-up p-2 bg-white rounded-md shadow-md text-gray-800 min-w-[180px]"
            >
              {flags.showProfile && (
                <DropdownMenu.Item
                  className="select-none outline-none cursor-pointer px-3 py-1.5 rounded-md data-[highlighted]:bg-gray-100 data-[highlighted]:text-green-500"
                  onClick={() => navigate(perfilRoute(slug))}
                >
                  PERFIL
                </DropdownMenu.Item>
              )}
              <DropdownMenu.Item
                className="select-none outline-none cursor-pointer px-3 py-1.5 rounded-md data-[highlighted]:bg-gray-100 data-[highlighted]:text-green-500"
                onClick={() => navigate(configsRoute(slug))}
              >
                CONFIGURAÇÕES
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        )}
        {flags.allowLogout && user && (
          <button
            onClick={handleLogout}
            className="p-1 hover:bg-gray-700 rounded-full transition-colors flex items-center justify-center"
            title="SAIR"
          >
            <LogOut className="w-6 h-6" />
          </button>
        )}
      </div>
    </div>
  );
}
