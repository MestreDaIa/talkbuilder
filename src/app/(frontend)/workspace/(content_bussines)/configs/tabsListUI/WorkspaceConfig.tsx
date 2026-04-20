"use client";

import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

import { Button } from "@/components/ui/button";

import { FormInputField } from "../forms/components/FormInputField";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Trash2Icon } from "lucide-react";

const workspaceConfigSchema = z.object({
	workspaceName: z.string().min(2).max(100),
	fusoHours: z.string().min(2).max(100),
	language: z.string().min(2).max(100),
});

type WorkspaceConfigFormData = z.infer<typeof workspaceConfigSchema>;
export default function WorkspaceConfig() {
	const { toast } = useToast();

	const {
		register,
		handleSubmit,
		control,
		formState: { errors, isSubmitting },
	} = useForm<WorkspaceConfigFormData>({
		resolver: zodResolver(workspaceConfigSchema),
		defaultValues: {
			workspaceName: "",
			fusoHours: "",
			language: "",
		},
	});

	function onSubmit(data: WorkspaceConfigFormData) {
		console.log(data);
		toast({
			title: "Workspace Atualizado",
			description: "As Informações do workspace foram atualizadas com sucesso.",
		});
	}

	const members = [
		{
			name: "Luis",
			email: "email@exemplo.com",
			role: "Admin",
		},
		{
			name: "Maria",
			email: "maria@exemplo.com",
			role: "Membro",
		},
	];

	return (
		<div className="flex flex-col gap-4">
			<Card>
				<CardHeader>
					<CardTitle>Configurações do Workspace</CardTitle>
					<CardDescription>
						Configurações operacionais do seu ambiente de trabalho
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
						<FormInputField
							label="Nome do Workspace"
							name="workspaceName"
							register={register}
							errors={errors}
							placeholder="Digite o Nome do Workspace"
						/>

						<div className="space-y-1">
							<Label> Fuso Horário</Label>
							<Controller
								name="fusoHours"
								control={control}
								render={({ field }) => (
									<Select onValueChange={field.onChange} defaultValue={field.value}>
										<SelectTrigger>
											<SelectValue placeholder="Selecione um fuso horário" />
										</SelectTrigger>
										<SelectContent defaultValue="america/saopaulo">
											<SelectItem value="america/saopaulo">
												America/Sao Paulo (GMT-3)
											</SelectItem>
											<SelectItem value="america/new_york">
												America/New York (GMT-5)
											</SelectItem>
											<SelectItem value="europe/london">Europe/London (GMT+0)</SelectItem>
											<SelectItem value="asia/tokyo">Asia/Tokyo (GMT+9)</SelectItem>
										</SelectContent>
									</Select>
								)}
							/>
							{errors.fusoHours && (
								<p className="text-red-500">{errors.fusoHours.message}</p>
							)}
						</div>
						<div className="space-y-1">
							<Label> Idioma</Label>
							<Controller
								name="language"
								control={control}
								render={({ field }) => (
									<Select onValueChange={field.onChange} defaultValue={field.value}>
										<SelectTrigger>
											<SelectValue placeholder="Selecione um idioma" />
										</SelectTrigger>
										<SelectContent defaultValue="BR">
											<SelectItem value="BR">Brasil</SelectItem>
											<SelectItem value="EN">Inglês(us)</SelectItem>
											<SelectItem value="ES">Espanhol</SelectItem>
										</SelectContent>
									</Select>
								)}
							/>
							{errors.language && (
								<p className="text-red-500">{errors.language.message}</p>
							)}
						</div>
						<Button type="submit" disabled={isSubmitting}>
							Salvar alterações
						</Button>
					</form>
					{/* <Separator /> */}
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<div className="flex justify-between items-center">
						<CardTitle>Membros da Equipe</CardTitle>
						<Button variant="default">Convidar</Button>
					</div>
					<CardDescription>
						Gerencie os membros da sua equipe, convites e permissões do seu workspace
					</CardDescription>
				</CardHeader>
				<CardContent>
					{/* cards item de membro contendo nome, email e select e lixeira */}
					<div className="space-y-2">
						<div className="flex flex-col gap-2 justify-between ">
							{members.map((member, item) => (
								<div
									key={item}
									className="flex flex-col p-3 gap-2 rounded-2xl bg-gray-200/40 "
								>
									<div className="flex gap-4 items-center">
										<p className="font-semibold">{member.name}</p>
										<p className="text-sm text-muted-foreground">{member.email}</p>
									</div>
									<div className="flex items-center gap-2">
										<Select>
											<SelectTrigger>
												<SelectValue placeholder="Selecione uma permissão" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="admin">Admin</SelectItem>
												<SelectItem value="editor">Editor</SelectItem>
												<SelectItem value="viewer">Viewer</SelectItem>
											</SelectContent>
										</Select>
										<Button variant="destructive">
											<Trash2Icon />{" "}
										</Button>
									</div>
								</div>
							))}
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
