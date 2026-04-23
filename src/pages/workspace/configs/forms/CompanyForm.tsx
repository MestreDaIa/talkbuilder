"use client";

import { z } from "zod";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";

import { FormInputField } from "./components/FormInputField";
import { Label } from "../../../../components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../../../../components/ui/select";
import { Button } from "../../../../components/ui/button";
import { useToast } from "../../../../hooks/use-toast";
import { getSupabase } from "../../../../lib/supabaseClient";
import { useAuth } from "../../../../context/AuthContext";

const companySchema = z.object({
	name: z.string().min(2, "Nome da empresa é obrigatório"),
	cnpj: z.string().min(14, "CNPJ inválido"),
	email: z.string().email("Email inválido"),
	phone: z.string().min(10, "Telefone inválido"),
	address: z.string().min(10, "Endereço invalido"),
	sector: z.string().min(2, "Setor inválido"),
	webSite: z.string().min(5, "Site inválido"),
});

type CompanyFormData = z.infer<typeof companySchema>;

const EMPTY: CompanyFormData = {
	name: "",
	cnpj: "",
	email: "",
	phone: "",
	address: "",
	sector: "",
	webSite: "",
};

type CompanyFormProps = {
	onNameChange?: (name: string) => void;
};

export function CompanyForm({ onNameChange }: CompanyFormProps = {}) {
	const { toast } = useToast();
	const { user } = useAuth();
	const [loading, setLoading] = useState(true);

	const {
		register,
		handleSubmit,
		control,
		reset,
		formState: { errors, isSubmitting },
	} = useForm<CompanyFormData>({
		resolver: zodResolver(companySchema),
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
			.from("companies")
			.select("name,cnpj,email,phone,address,sector,website")
			.eq("user_id", user.id)
			.maybeSingle()
			.then(({ data, error }) => {
				if (cancelled) return;
				if (error) console.error(error);
				if (data) {
					reset({
						name: data.name ?? "",
						cnpj: data.cnpj ?? "",
						email: data.email ?? "",
						phone: data.phone ?? "",
						address: data.address ?? "",
						sector: data.sector ?? "",
						webSite: data.website ?? "",
					});
					onNameChange?.(data.name ?? "");
				}
				setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [user, reset, onNameChange]);

	async function onSubmit(data: CompanyFormData) {
		const supabase = getSupabase();
		if (!supabase || !user) return;
		const { error } = await supabase.from("companies").upsert({
			user_id: user.id,
			name: data.name,
			cnpj: data.cnpj,
			email: data.email,
			phone: data.phone,
			address: data.address,
			sector: data.sector,
			website: data.webSite,
		});
		if (error) {
			toast({ title: "Erro ao salvar empresa", description: error.message });
			return;
		}
		onNameChange?.(data.name);
		toast({
			title: "Empresa Salva",
			description: "As informações da empresa foram atualizadas com sucesso.",
		});
	}

	if (loading) {
		return <div className="text-sm text-gray-500">Carregando...</div>;
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
						<Select onValueChange={field.onChange} value={field.value}>
							<SelectTrigger>
								<SelectValue placeholder="Selecione um setor" />
							</SelectTrigger>
							<SelectContent>
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
