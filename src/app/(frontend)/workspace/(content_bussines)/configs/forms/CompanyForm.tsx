"use client";

import { z } from "zod";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Label } from "@/components/ui/label";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { FormInputField } from "./components/FormInputField";

const companySchema = z.object({
	name: z.string().min(2, "Nome da empresa é obrigatório"),
	cnpj: z.string().min(14, "CNPJ inválido"),
	email: z.string().email("Email inválido"),
	phone: z.string().min(10, "Telefone inválido"),
	address: z.string().min(10, "Endereço invalido"),
	sector: z.string().min(10, "Setor inválido"),
	webSite: z.string().min(5, "Site inválido"),
});

type CompanyFormData = z.infer<typeof companySchema>;

export function CompanyForm() {
	const { toast } = useToast();

	const {
		register,
		handleSubmit,
		control,
		formState: { errors, isSubmitting },
	} = useForm<CompanyFormData>({
		resolver: zodResolver(companySchema),
		defaultValues: {
			name: "",
			cnpj: "",
			email: "",
			phone: "",
			address: "",
			sector: "",
			webSite: "",
		},
	});

	function onSubmit(data: CompanyFormData) {
		console.log(data);
		toast({
			title: "Empresa Salva",
			description: "As Informações da empresa foram atualizadas com sucesso.",
		});
	}

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
			<div className="space-y-1">
				<FormInputField
					label="Nome da Empresa"
					name="name"
					register={register}
					errors={errors}
					placeholder="Digite o nome da empresa"
				/>
			</div>

			<div className="space-y-1">
				<FormInputField
					label="CNPJ"
					name="cnpj"
					register={register}
					errors={errors}
					placeholder="Digite o CNPJ"
				/>
			</div>
			<div className="space-y-1">
				<FormInputField
					label="Email Comercial"
					name="email"
					register={register}
					errors={errors}
					placeholder="Digite o Email Comercial"
				/>
			</div>
			<div className="space-y-1">
				<FormInputField
					label="Telefone Comercial"
					name="phone"
					register={register}
					errors={errors}
					placeholder="Digite o Telefone Comercial"
				/>
			</div>
			<div className="space-y-1">
				<FormInputField
					label="Endereço"
					name="address"
					register={register}
					errors={errors}
					placeholder="Digite o Endereço"
				/>
			</div>
			<div className="space-y-1">
				<Label> Setor de Atuação</Label>
				<Controller
					name="sector"
					control={control}
					render={({ field }) => (
						<Select onValueChange={field.onChange} defaultValue={field.value}>
							<SelectTrigger>
								<SelectValue placeholder="Selecione um setor" />
							</SelectTrigger>
							<SelectContent defaultValue="tecnologia">
								<SelectItem value="tecnologia">Tecnologia</SelectItem>
								<SelectItem value="varejo">Varejo</SelectItem>
								<SelectItem value="servicos">Serviços</SelectItem>
								<SelectItem value="industria">Indústria</SelectItem>
								<SelectItem value="saude">Saúde</SelectItem>
								<SelectItem value="educacao">Educação</SelectItem>
								<SelectItem value="financeiro">Financeiro</SelectItem>
								<SelectItem value="outros">Outros</SelectItem>
							</SelectContent>
						</Select>
					)}
				/>
				{errors.sector && <p className="text-red-500">{errors.sector.message}</p>}
			</div>

			<div className="space-y-1">
				<FormInputField
					label="Site"
					name="webSite"
					register={register}
					errors={errors}
					placeholder="Digite o Site"
				/>
			</div>
			<Button type="submit" disabled={isSubmitting}>
				{isSubmitting ? "Salvando..." : "Salvar"}
			</Button>
		</form>
	);
}
