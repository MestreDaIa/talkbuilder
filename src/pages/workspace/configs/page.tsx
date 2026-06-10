// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Bell,
	Building2,
	CreditCard,
	Key,
	Plug,
	Shield,
	Users,
} from "lucide-react";

import Building from "./tabsListUI/Building";
import WorkspaceConfig from "./tabsListUI/WorkspaceConfig";
import Preference from "./tabsListUI/Preference";
import SecurityConfig from "./tabsListUI/Security";
import KeysApi from "./tabsListUI/KeysApi";
import IntegrationsSettings from "./tabsListUI/IntegrationsSettings";
import PaymentPlan from "./tabsListUI/PaymentPlan";
// WhatsAppConfig logic moved into IntegrationsSettings
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import { useEmbed } from "../../../context/EmbedContext";
import { useAuth } from "../../../context/AuthContext";
import { resolveEffectivePlan } from "../../../lib/planResolver";

export default function ConfigurationWorkspace() {
	const { flags, mode, host } = useEmbed();
	const { user, profile } = useAuth();
	const userMeta = (user?.user_metadata ?? {}) as Record<string, any>;
	const resolved = resolveEffectivePlan(profile);
	const isBookingManaged =
		resolved.managedBy === "booking" ||
		(mode === "embedded" && host === "booking") ||
		userMeta.source === "booking";
	const showBilling = flags.showBilling && !isBookingManaged;
	const defaultTab = "workspace";
	return (
		<div className="relative flex h-full overflow-hidden bg-[#F8F9FA]">
			<div className='px-6 py-8 flex w-full flex-col items-center justify-start gap-8 h-full overflow-auto max-w-5xl mx-auto'>
				<div className="w-full text-left space-y-1">
					<h2 className="text-3xl font-extrabold text-[#1A1C1E] tracking-tight">Configurações</h2>
					<p className="text-[#64748B] text-base">
						Gerencie sua empresa, workspace e preferências
					</p>
				</div>
				
				<div className="w-full">
					<Tabs defaultValue={defaultTab} className="w-full">
						<TabsList className="bg-[#EDF2F7] w-fit flex items-center justify-start p-1 rounded-xl mb-8 border border-[#E2E8F0]">
							{flags.showCompanyTab && (
								<TabsTrigger 
									value="building" 
									className="capitalize px-4 py-2.5 rounded-lg data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all duration-200"
								>
									<Building2 className="w-5 h-5 mr-2" />
									<span className="hidden md:inline">Empresa</span>
								</TabsTrigger>
							)}
							<TabsTrigger 
								value="workspace" 
								className="capitalize px-4 py-2.5 rounded-lg data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all duration-200"
							>
								<Users className="w-5 h-5 mr-2" />
								<span className="hidden md:inline">Workspace</span>
							</TabsTrigger>
							<TabsTrigger 
								value="preference" 
								className="capitalize px-4 py-2.5 rounded-lg data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all duration-200"
							>
								<Bell className="w-5 h-5 mr-2" />
								<span className="hidden md:inline">Preferências</span>
							</TabsTrigger>
							<TabsTrigger 
								value="security" 
								className="capitalize px-4 py-2.5 rounded-lg data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all duration-200"
							>
								<Shield className="w-5 h-5 mr-2" />
								<span className="hidden md:inline">Segurança</span>
							</TabsTrigger>
							<TabsTrigger 
								value="key" 
								className="capitalize px-4 py-2.5 rounded-lg data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all duration-200"
							>
								<Key className="w-5 h-5 mr-2" />
								<span className="hidden md:inline">Chaves API</span>
							</TabsTrigger>
							<TabsTrigger 
								value="integration" 
								className="capitalize px-4 py-2.5 rounded-lg data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all duration-200"
							>
								<Plug className="w-5 h-5 mr-2" />
								<span className="hidden md:inline">Integrações</span>
							</TabsTrigger>
							{showBilling && (
								<TabsTrigger 
									value="paymentPlan" 
									className="capitalize px-4 py-2.5 rounded-lg data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all duration-200"
								>
									<CreditCard className="w-5 h-5 mr-2" />
									<span className="hidden md:inline">Faturamento</span>
								</TabsTrigger>
							)}
						</TabsList>

						<div className="mt-2">
							{flags.showCompanyTab && (
								<TabsContent value="building">
									<div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
										<Building />
									</div>
								</TabsContent>
							)}
							<TabsContent value="workspace">
								<div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
									<WorkspaceConfig />
								</div>
							</TabsContent>
							<TabsContent value="preference">
								<div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
									<Preference />
								</div>
							</TabsContent>
							<TabsContent value="security">
								<div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
									<SecurityConfig />
								</div>
							</TabsContent>
							<TabsContent value="key">
								<div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
									<KeysApi />
								</div>
							</TabsContent>
							<TabsContent value="integration">
								<div className="animate-in fade-in slide-in-from-bottom-2 duration-300 flex flex-col gap-6">
									<IntegrationsSettings />
								</div>
							</TabsContent>
							{showBilling && (
								<TabsContent value="paymentPlan">
									<div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
										<PaymentPlan />
									</div>
								</TabsContent>
							)}
						</div>
					</Tabs>
				</div>
			</div>
		</div>

	);
}
