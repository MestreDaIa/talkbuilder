import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Camera, User2 } from "lucide-react";
import React from "react";
import { CompanyForm } from "../forms/CompanyForm";

export default function Building() {
	return (
		<div>
			<Card>
				<CardHeader>
					<CardTitle>Dados da Empresa</CardTitle>
					<CardDescription>
						Gerencie sua empresa, workspace e preferências
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<div className="relative flex w-full space-x-4 items-center">
						<div className="relative w-fit rounded-full p-3 border-2 border-red-600">
							<User2 className="w-24 h-24 text-xs text-gray-200" />
							<Camera className="absolute -bottom-0 right-1 w-8 h-8 text-white border-2 border-white bg-[#06B6D4] rounded-full p-1.5 cursor-pointer" />
						</div>
						<div className="flex-1">
							<h4 className="text-lg ">Logo da Empresa</h4>
							<p className="text-sm text-gray-500">PNG, JPG até 2MB</p>
						</div>
					</div>
					<Separator />
					<div>
						<CompanyForm />
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
