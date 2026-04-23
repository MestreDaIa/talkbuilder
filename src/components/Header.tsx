import { Settings } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useNavigate } from "react-router-dom";
import { useEmbed } from "../context/EmbedContext";

export default function Header() {
  const navigate = useNavigate();
  const { flags } = useEmbed();

  return (
    <div className="relative top-0 left-0 w-full bg-gray-800 text-white flex items-center justify-between py-2 px-4 sm:px-9 z-[99] gap-3">
      <span
        className="cursor-pointer text-sm font-medium tracking-wide shrink-0"
        onClick={() => navigate("/")}
      >
        WORKSPACE
      </span>
      <h1 className="flex-1 text-center text-base sm:text-lg font-semibold truncate">
        Talk-Flow-Creator
      </h1>
      <div className="flex items-center shrink-0">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Settings className="relative z-10 w-6 h-6 cursor-pointer" />
          </DropdownMenu.Trigger>

          <DropdownMenu.Content
            side="left"
            sideOffset={8}
            className="relative z-10 data-[side=left]:animate-slide-down data-[side=right]:animate-slide-up p-2 bg-white rounded-md shadow-md text-gray-800"
          >
            {flags.showProfile && (
              <DropdownMenu.Item
                className="select-none outline-none cursor-pointer px-3 rounded-md data-[highlighted]:bg-gray-100 data-[highlighted]:text-green-500"
                onClick={() => navigate("/workspace/perfil")}
              >
                PERFIL
              </DropdownMenu.Item>
            )}
            <DropdownMenu.Item
              className="select-none outline-none cursor-pointer px-3 rounded-md data-[highlighted]:bg-gray-100 data-[highlighted]:text-green-500"
              onClick={() => navigate("/workspace/configs")}
            >
              CONFIGURAÇÕES
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </div>
    </div>
  );
}
