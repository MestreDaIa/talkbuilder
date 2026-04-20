"use client";

import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import React from "react";
import { FormInputField } from "../forms/components/FormInputField";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Download, Shield, Trash2 } from "lucide-react";

const securityConfigSchema = z.object({
	pwdActual: z.string().min(6).max(100),
	newPwd: z.string().min(6).max(100),
	confirmPwd: z.string().min(6).max(100),
});

type WorkspaceConfigFormData = z.infer<typeof securityConfigSchema>;

export default function SecurityConfig() {
	const { toast } = useToast();

	const {
		register,
		handleSubmit,
		control,
		formState: { errors, isSubmitting },
	} = useForm<WorkspaceConfigFormData>({
		resolver: zodResolver(securityConfigSchema),
		defaultValues: {
			pwdActual: "",
			newPwd: "",
			confirmPwd: "",
		},
	});

	function onSubmit(data: WorkspaceConfigFormData) {
		console.log(data);
		toast({
			title: "Workspace Atualizado",
			description: "As Informações do workspace foram atualizadas com sucesso.",
		});
	}
	return (
		<div className="flex flex-col gap-4">
			<Card>
				<CardHeader>
					<CardTitle>Senha</CardTitle>
					<CardDescription>Mantenha sua conta segura</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
						<div className="space-y-1">
							<FormInputField
								label="Senha Atual"
								name="pwdActual"
								register={register}
								errors={errors}
								placeholder="Digite a Senha Atual"
							/>
						</div>
						<div className="space-y-1">
							<FormInputField
								label="Nova Senha"
								name="newPwd"
								register={register}
								errors={errors}
								placeholder="Digite a Nova Senha"
							/>
						</div>
						<div className="space-y-1">
							<FormInputField
								label="Confirmar Nova Senha"
								name="confirmPwd"
								register={register}
								errors={errors}
								placeholder="Digite a Confirmação da Nova Senha"
							/>
						</div>
						<Button type="submit" disabled={isSubmitting}>
							Salvar alterações
						</Button>
					</form>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Autenticação de Dois Fatores</CardTitle>
					<CardDescription>Adicione uma camada extra de segurança</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex justify-center items-center w-full p-4 border rounded-lg">
						<div className="flex justify-between items-center w-full gap-2">
							<div className="flex items-center justify-center bg-green-300/60 h-full p-2 rounded-lg">
								<Shield className="h-8 w-6 text-green-600" />
							</div>
							<CardHeader className="p-0 px-0.5 -space-y-0">
								<CardTitle className="text-sm">2FA via Aplicativo</CardTitle>
								<CardDescription className="text-xs">
									Use o Google Authenticator ou similar
								</CardDescription>
							</CardHeader>
							<Button variant="outline">Ativar</Button>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Adicionar card para sessões ativas - gerenciar dispositivos conectados */}

			<Card>
				<CardHeader>
					<CardTitle>Zona de Perigo</CardTitle>
					<CardDescription>Ações irreversíveis para a sua conta</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<div className="bg-red-300/40 flex justify-center items-center w-full  border border-red-300/60 rounded-xl">
						<div className=" p-4 gap-3 flex flex-col w-full">
							<CardHeader className="p-0 text-left">
								<CardTitle>Exportar todos os dados</CardTitle>
								<CardDescription>
									Baixe uma cópia de todos os seus dados
								</CardDescription>
							</CardHeader>
							<Button className=" w-full" variant="outline">
								<Download />
								Exportar
							</Button>
						</div>
					</div>
					<div className="bg-red-300/40 flex  w-full  border border-red-300/60 rounded-xl">
						<div className=" p-4 gap-3 flex flex-col w-full">
							<CardHeader className="p-0 text-left ">
								<CardTitle>Excluir conta</CardTitle>
								<CardDescription>
									Isso Removerá permanentemente sua conta e todos os dados
								</CardDescription>
							</CardHeader>
							<Button className="text-red-600 w-full" variant="outline">
								<Trash2 />
								Excluir conta
							</Button>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
