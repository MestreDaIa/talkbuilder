import { ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEmbed } from "../context/EmbedContext";
import { useAuth } from "../context/AuthContext";
import { workspaceRoot } from "../lib/workspaceRoutes";
import logoMark from "../assets/logo-mark.svg";
import logoWordmark from "../assets/logo-wordmark.svg";
import NotificationBell from "./NotificationBell";
import { useSuperAdmin } from "../hooks/useSuperAdmin";

export default function Header() {
  const navigate = useNavigate();
  const { flags, mode } = useEmbed();
  const { profile, currentWorkspace } = useAuth();
  const { isSuperAdmin } = useSuperAdmin();
  const slug = currentWorkspace?.slug || profile?.slug;

  return (
    <div className="relative top-0 left-0 w-full bg-[#08060d] border-b border-white/5 text-white flex items-center justify-between py-2 px-4 sm:px-9 z-[99] gap-3">
      <button
        type="button"
        className="cursor-pointer shrink-0 flex items-center gap-2"
        onClick={() => navigate(workspaceRoot(slug))}
      >
        <img src={logoMark} alt="Zailom Flow" className="h-7 w-auto" />
      </button>
      <h1 className="flex-1 text-center flex items-center justify-center gap-2 truncate">
        <img src={logoWordmark} alt="Zailom Flow" className="h-6 w-auto inline-block" />
        <span className="text-base sm:text-lg font-semibold truncate">
          {slug ? `@${slug}` : ""}
          {profile?.display_name ? ` - ${profile.display_name}` : ""}
        </span>
      </h1>
      <div className="flex items-center shrink-0 gap-2">
        {mode !== "embedded" && <NotificationBell />}
        {isSuperAdmin && (
          <button
            onClick={() => navigate("/admin")}
            title="Super Admin"
            className="p-1 hover:bg-white/10 rounded-full transition"
          >
            <ShieldCheck className="w-6 h-6 text-amber-300" />
          </button>
        )}

      </div>
    </div>
  );
}
