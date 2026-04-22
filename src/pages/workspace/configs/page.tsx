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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";

export default function ConfigurationWorkspace() {
	return (
		<div className="relative flex border border-red-600 h-full overflow-hidden">
			<div className='bg-gray-200/40 px-6 py-4 flex w-full flex-col items-center justify-start gap-4 h-full overflow-auto'>
				<div className="flex-1 w-full text-left">
					<h2 className="text-3xl font-bold text-gray-600">Configurações</h2>
					<span className=" text-sm">
						Gerencie sua empresa, workspace e preferências
					</span>
				</div>
				<div className="w-full">
					<Tabs defaultValue="workspace" className="w-full">
						<TabsList className="bg-gray-200 w-full flex items-center justify-start px-2 py-6 gap-2">
							<TabsTrigger value="building" className="capitalize bg-gray-300">
								<Building2 />
							</TabsTrigger>
							<TabsTrigger value="workspace" className="capitalize bg-gray-300">
								<Users />
							</TabsTrigger>
							<TabsTrigger value="preference" className="capitalize bg-gray-300">
								<Bell />
							</TabsTrigger>
							<TabsTrigger value="security" className="capitalize bg-gray-300">
								<Shield />
							</TabsTrigger>
							<TabsTrigger value="key" className="capitalize bg-gray-300">
								<Key />
							</TabsTrigger>
							<TabsTrigger value="integration" className="capitalize bg-gray-300">
								<Plug />
							</TabsTrigger>
							<TabsTrigger value="paymentPlan" className="capitalize bg-gray-300">
								<CreditCard />
							</TabsTrigger>
						</TabsList>
						<TabsContent value="building">
							<div>
								<Building />{" "}
							</div>
						</TabsContent>
						<TabsContent value="workspace">
							<div>
								<WorkspaceConfig />{" "}
							</div>
						</TabsContent>
						<TabsContent value="preference">
							<div>
								<Preference />
							</div>
						</TabsContent>
						<TabsContent value="security">
							<div>
								<SecurityConfig />
							</div>
						</TabsContent>
						<TabsContent value="key">
							<div>
								<KeysApi />
							</div>
						</TabsContent>
						<TabsContent value="integration">
							<div>
								<IntegrationsSettings />
							</div>
						</TabsContent>
						<TabsContent value="paymentPlan">
							<div>
								<PaymentPlan />
							</div>
						</TabsContent>
					</Tabs>
				</div>
			</div>
		</div>
	);
}
