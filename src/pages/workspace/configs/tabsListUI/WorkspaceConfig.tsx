"use client";

import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useEffect, useState } from "react";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "../../../../components/ui/card";

import { Button } from "../../../../components/ui/button";

import { FormInputField } from "../forms/components/FormInputField";

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../../../../components/ui/select";
import { Trash2Icon } from "lucide-react";
import { useToast } from "../../../../hooks/use-toast";
import { Label } from "../../../../components/ui/label";
import { getSupabase } from "../../../../lib/supabaseClient";
import { useAuth } from "../../../../context/AuthContext";
import { InviteMemberDialog } from "../../../../components/settings/InviteMemberDialog";

const workspaceConfigSchema = z.object({
	workspaceName: z.string().min(2).max(100),
	fusoHours: z.string().min(2).max(100),
	language: z.string().min(2).max(100),
});

type WorkspaceConfigFormData = z.infer<typeof workspaceConfigSchema>;

const EMPTY: WorkspaceConfigFormData = {
	workspaceName: "",
	fusoHours: "",
	language: "",
};

export default function WorkspaceConfig() {
	const { toast } = useToast();
	const { user } = useAuth();
	const [loading, setLoading] = useState(true);

	const {
		register,
		handleSubmit,
		control,
		reset,
		formState: { errors, isSubmitting },
	} = useForm<WorkspaceConfigFormData>({
		resolver: zodResolver(workspaceConfigSchema),
		defaultValues: EMPTY,
	});

	useEffect(() => {
		const supabase = getSupabase();
		if (!supabase || !user) {
			setLoading(false);
			return;
		}
		let cancelled = false;
		supabase
			.from("workspace_settings")
			.select("workspace_name,timezone,language")
			.eq("user_id", user.id)
			.maybeSingle()
			.then(({ data, error }) => {
				if (cancelled) return;
				if (error) console.error(error);
				if (data) {
					reset({
						workspaceName: data.workspace_name ?? "",
						fusoHours: data.timezone ?? "",
						language: data.language ?? "",
					});
				}
				setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [user, reset]);

	async function onSubmit(data: WorkspaceConfigFormData) {
		const supabase = getSupabase();
		if (!supabase || !user) return;
		const { error } = await supabase.from("workspace_settings").upsert({
			user_id: user.id,
			workspace_name: data.workspaceName,
			timezone: data.fusoHours,
			language: data.language,
		});
		if (error) {
			toast({ title: "Erro ao salvar", description: error.message });
			return;
		}
		toast({
			title: "Workspace Atualizado",
			description: "As Informações do workspace foram atualizadas com sucesso.",
		});
	}

	const [members, setMembers] = useState<any[]>([]);
	const { currentWorkspace } = useAuth();

	useEffect(() => {
		const supabase = getSupabase();
		if (!supabase || !currentWorkspace) return;

		supabase
			.from("workspace_members")
			.select("role, user_id")
			.eq("workspace_id", currentWorkspace.id)
			.then(({ data, error }) => {
				if (error) console.error(error);
				if (data) {
					// Aqui idealmente faríamos um join com profiles para pegar nome/email
					// Por simplicidade agora, usaremos os IDs
					setMembers(data.map(m => ({ 
						name: `Usuário ${m.user_id.slice(0,4)}`, 
						email: "Carregando...", 
						role: m.role 
					})));
				}
			});
	}, [currentWorkspace]);

	return (
		<div className="flex flex-col gap-6">
			<Card className="border-none shadow-sm bg-white overflow-hidden">
				<CardHeader className="border-b border-gray-100 bg-gray-50/50 pb-6">
					<CardTitle className="text-xl font-bold text-gray-800">Geral</CardTitle>
					<CardDescription className="text-gray-500">
						Configurações operacionais do seu ambiente de trabalho
					</CardDescription>
				</CardHeader>
				<CardContent className="pt-8">
					{loading ? (
						<div className="flex items-center justify-center py-12">
							<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
						</div>
					) : (
						<form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
							<FormInputField
								label="Nome do Workspace"
								name="workspaceName"
								register={register}
								errors={errors}
								placeholder="Ex: Minha Empresa"
							/>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
								<div className="space-y-2">
									<Label className="text-sm font-semibold text-gray-700">Fuso Horário</Label>
									<Controller
										name="fusoHours"
										control={control}
										render={({ field }) => (
											<Select onValueChange={field.onChange} value={field.value}>
												<SelectTrigger className="bg-white border-gray-200 focus:ring-primary/20">
													<SelectValue placeholder="Selecione um fuso horário" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="america/saopaulo">
														America/Sao Paulo (GMT-3)
													</SelectItem>
													<SelectItem value="america/new_york">
														America/New York (GMT-5)
													</SelectItem>
													<SelectItem value="europe/london">
														Europe/London (GMT+0)
													</SelectItem>
													<SelectItem value="asia/tokyo">Asia/Tokyo (GMT+9)</SelectItem>
												</SelectContent>
											</Select>
										)}
									/>
									{errors.fusoHours && (
										<p className="text-xs text-red-500 mt-1">{errors.fusoHours.message}</p>
									)}
								</div>

								<div className="space-y-2">
									<Label className="text-sm font-semibold text-gray-700">Idioma</Label>
									<Controller
										name="language"
										control={control}
										render={({ field }) => (
											<Select onValueChange={field.onChange} value={field.value}>
												<SelectTrigger className="bg-white border-gray-200 focus:ring-primary/20">
													<SelectValue placeholder="Selecione um idioma" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="BR">Português (Brasil)</SelectItem>
													<SelectItem value="EN">English (US)</SelectItem>
													<SelectItem value="ES">Español</SelectItem>
												</SelectContent>
											</Select>
										)}
									/>
									{errors.language && (
										<p className="text-xs text-red-500 mt-1">{errors.language.message}</p>
									)}
								</div>
							</div>

							<div className="pt-4 border-t border-gray-100 flex justify-end">
								<Button type="submit" disabled={isSubmitting} className="px-8 shadow-sm hover:shadow-md transition-all">
									{isSubmitting ? "Salvando..." : "Salvar alterações"}
								</Button>
							</div>
						</form>
					)}
				</CardContent>
			</Card>

			<Card className="border-none shadow-sm bg-white overflow-hidden">
				<CardHeader className="border-b border-gray-100 bg-gray-50/50 pb-6 flex flex-row justify-between items-center">
					<div className="space-y-1">
						<CardTitle className="text-xl font-bold text-gray-800">Membros da Equipe</CardTitle>
						<CardDescription className="text-gray-500">
							Gerencie os membros da sua equipe e suas permissões
						</CardDescription>
					</div>
					<InviteMemberDialog />
				</CardHeader>
				<CardContent className="pt-6">
					<div className="space-y-3">
						{members.length > 0 ? (
							members.map((member, index) => (
								<div
									key={index}
									className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border border-gray-100 bg-gray-50/30 hover:bg-gray-50 transition-colors gap-4"
								>
									<div className="flex items-center gap-4">
										<div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
											{member.role === 'owner' ? '👑' : (member.name?.charAt(0) || "U")}
										</div>
										<div className="flex flex-col">
											<p className="font-bold text-gray-800">{member.name} {member.role === 'owner' && <span className="text-[10px] bg-amber-100 text-amber-700 px-1 rounded ml-1">OWNER</span>}</p>
											<p className="text-sm text-gray-500">{member.email}</p>
										</div>
									</div>
									
									<div className="flex items-center gap-3">
										<Select defaultValue={member.role?.toLowerCase()}>
											<SelectTrigger className="w-[130px] bg-white border-gray-200">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="admin">Administrador</SelectItem>
												<SelectItem value="editor">Editor</SelectItem>
												<SelectItem value="membro">Membro</SelectItem>
												<SelectItem value="viewer">Visualizador</SelectItem>
											</SelectContent>
										</Select>
										<Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50">
											<Trash2Icon className="w-5 h-5" />
										</Button>
									</div>
								</div>
							))
						) : (
							<div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-gray-100 rounded-xl">
								<p className="text-gray-400">Nenhum membro encontrado.</p>
							</div>
						)}
					</div>
				</CardContent>
			</Card>
		</div>

	);
}
