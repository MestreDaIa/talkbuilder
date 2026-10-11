import {
  Bell,
  Building2,
  Shield,
  Users,
} from "lucide-react";

import Building from "./tabsListUI/Building";
import WorkspaceConfig from "./tabsListUI/WorkspaceConfig";
import Preference from "./tabsListUI/Preference";
import SecurityConfig from "./tabsListUI/Security";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import { useEmbed } from "../../../context/EmbedContext";

export default function ConfigurationWorkspace() {
  const { flags } = useEmbed();
  const defaultTab = "workspace";

  return (
    <div className="relative flex h-full overflow-y-auto bg-[#F8F9FA]">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-start gap-8 px-6 py-8">
        <div className="w-full space-y-1 text-left">
          <h2 className="text-3xl font-extrabold tracking-tight text-[#1A1C1E]">Configurações</h2>
          <p className="text-base text-[#64748B]">Gerencie sua empresa, workspace e preferências</p>
        </div>

        <div className="w-full">
          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="mb-8 flex w-fit items-center justify-start rounded-xl border border-[#E2E8F0] bg-[#EDF2F7] p-1">
              {flags.showCompanyTab && (
                <TabsTrigger value="building" className="rounded-lg px-4 py-2.5 capitalize transition-all duration-200 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">
                  <Building2 className="mr-2 h-5 w-5" />
                  <span className="hidden md:inline">Empresa</span>
                </TabsTrigger>
              )}
              <TabsTrigger value="workspace" className="rounded-lg px-4 py-2.5 capitalize transition-all duration-200 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">
                <Users className="mr-2 h-5 w-5" />
                <span className="hidden md:inline">Workspace</span>
              </TabsTrigger>
              <TabsTrigger value="preference" className="rounded-lg px-4 py-2.5 capitalize transition-all duration-200 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">
                <Bell className="mr-2 h-5 w-5" />
                <span className="hidden md:inline">Preferências</span>
              </TabsTrigger>
              <TabsTrigger value="security" className="rounded-lg px-4 py-2.5 capitalize transition-all duration-200 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">
                <Shield className="mr-2 h-5 w-5" />
                <span className="hidden md:inline">Segurança</span>
              </TabsTrigger>
            </TabsList>

            <div className="mt-2">
              {flags.showCompanyTab && (
                <TabsContent value="building">
                  <div className="animate-in fade-in slide-in-from-bottom-2 duration-300"><Building /></div>
                </TabsContent>
              )}
              <TabsContent value="workspace">
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300"><WorkspaceConfig /></div>
              </TabsContent>
              <TabsContent value="preference">
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300"><Preference /></div>
              </TabsContent>
              <TabsContent value="security">
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300"><SecurityConfig /></div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
