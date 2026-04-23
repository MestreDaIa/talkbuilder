"use client";

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { getSupabase } from "../../lib/supabaseClient";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
} from "../../components/ui/card";
import { useToast } from "../../hooks/use-toast";
import { Check, Loader2, X } from "lucide-react";
import { PLAN_LABELS, PLAN_LIMITS, type PlanId } from "../../context/PlanContext";

const slugRegex = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/;

const schema = z.object({
	display_name: z.string().trim().min(1, "Nome obrigatório").max(100),
	email: z.string().trim().email("Email inválido").max(255),
	password: z.string().min(6, "Senha deve ter ao menos 6 caracteres").max(72),
	slug: z
		.string()
		.trim()
		.toLowerCase()
		.regex(
			slugRegex,
			"Use 3 a 32 caracteres: letras minúsculas, números e hífen"
		),
	plan: z.enum(["starter", "pro", "business"]),
});

type SlugStatus = "idle" | "checking" | "available" | "taken" | "invalid";

const PLAN_PRICES: Record<PlanId, string> = {
	starter: "Grátis",
	pro: "R$ 49/mês",
	business: "R$ 149/mês",
};

export default function SignupPage() {
	const { toast } = useToast();
	const navigate = useNavigate();

	const [displayName, setDisplayName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [slug, setSlug] = useState("");
	const [plan, setPlan] = useState<PlanId>("starter");
	const [slugStatus, setSlugStatus] = useState<SlugStatus>("idle");
	const [submitting, setSubmitting] = useState(false);

	// debounce slug check
	useEffect(() => {
		if (!slug) {
			setSlugStatus("idle");
			return;
		}
		if (!slugRegex.test(slug)) {
			setSlugStatus("invalid");
			return;
		}
		setSlugStatus("checking");
		const t = setTimeout(async () => {
			const supabase = getSupabase();
			if (!supabase) return;
			const { data, error } = await supabase.rpc("is_slug_available", {
				p_slug: slug,
			});
			if (error) {
				console.error("[Signup] is_slug_available error:", error);
				setSlugStatus("idle");
				return;
			}
			setSlugStatus(data ? "available" : "taken");
		}, 400);
		return () => clearTimeout(t);
	}, [slug]);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		const parsed = schema.safeParse({
			display_name: displayName,
			email,
			password,
			slug,
			plan,
		});
		if (!parsed.success) {
			toast({
				title: "Confira os campos",
				description: parsed.error.issues[0].message,
				variant: "destructive",
			});
			return;
		}
		if (slugStatus !== "available") {
			toast({
				title: "Escolha um @ disponível",
				description: "O identificador precisa estar livre.",
				variant: "destructive",
			});
			return;
		}

		setSubmitting(true);
		const supabase = getSupabase()!;
		const { data, error } = await supabase.auth.signUp({
			email: parsed.data.email,
			password: parsed.data.password,
			options: {
				emailRedirectTo: `${window.location.origin}/`,
				data: {
					display_name: parsed.data.display_name,
					slug: parsed.data.slug,
					plan: parsed.data.plan,
				},
			},
		});
		setSubmitting(false);

		if (error) {
			toast({
				title: "Falha no cadastro",
				description: error.message,
				variant: "destructive",
			});
			return;
		}

		// Se confirmação de email estiver desativada, já vem com session
		if (data.session) {
			toast({ title: "Conta criada!", description: "Bem-vindo ao TalkMap." });
			navigate("/", { replace: true });
		} else {
			toast({
				title: "Confira seu email",
				description: `Mandamos um link de confirmação pra ${parsed.data.email}.`,
			});
			navigate("/login", { replace: true });
		}
	}

	return (
		<div className="min-h-svh flex items-center justify-center p-6 bg-gradient-to-br from-background to-muted">
			<Card className="max-w-lg w-full">
				<CardHeader>
					<CardTitle>Criar sua conta TalkMap</CardTitle>
					<CardDescription>
						Escolha seu @ — ele vira sua URL pública (ex:{" "}
						<code>talkmap.com.br/{slug || "seu-nome"}</code>).
					</CardDescription>
				</CardHeader>
				<CardContent>
					{sent ? (
						<div className="text-sm space-y-2">
							<p className="font-medium">📬 Confira seu email</p>
							<p className="text-muted-foreground">
								Mandamos um link mágico pra <strong>{email}</strong>. Clica
								nele pra ativar sua conta.
							</p>
						</div>
					) : (
						<form onSubmit={handleSubmit} className="space-y-4">
							<div>
								<Label htmlFor="name">Seu nome</Label>
								<Input
									id="name"
									value={displayName}
									onChange={(e) => setDisplayName(e.target.value)}
									placeholder="João Silva"
									required
								/>
							</div>

							<div>
								<Label htmlFor="email">Email</Label>
								<Input
									id="email"
									type="email"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									placeholder="voce@empresa.com"
									required
								/>
							</div>

							<div>
								<Label htmlFor="slug">Seu @</Label>
								<div className="relative">
									<span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
										@
									</span>
									<Input
										id="slug"
										value={slug}
										onChange={(e) =>
											setSlug(
												e.target.value
													.toLowerCase()
													.replace(/[^a-z0-9-]/g, "")
											)
										}
										placeholder="seu-nome"
										className="pl-7 pr-10"
										required
									/>
									<span className="absolute right-3 top-1/2 -translate-y-1/2">
										{slugStatus === "checking" && (
											<Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
										)}
										{slugStatus === "available" && (
											<Check className="w-4 h-4 text-primary" />
										)}
										{(slugStatus === "taken" || slugStatus === "invalid") && (
											<X className="w-4 h-4 text-destructive" />
										)}
									</span>
								</div>
								<p className="text-xs text-muted-foreground mt-1">
									{slugStatus === "available" &&
										"✓ Disponível"}
									{slugStatus === "taken" && "Esse @ já está em uso"}
									{slugStatus === "invalid" &&
										"3-32 caracteres: letras minúsculas, números, hífen"}
									{slugStatus === "idle" &&
										"3-32 caracteres: letras minúsculas, números, hífen"}
								</p>
							</div>

							<div>
								<Label>Plano</Label>
								<div className="grid grid-cols-3 gap-2 mt-1">
									{(["starter", "pro", "business"] as PlanId[]).map((p) => (
										<button
											key={p}
											type="button"
											onClick={() => setPlan(p)}
											className={`border rounded-md p-2 text-left transition ${
												plan === p
													? "border-primary bg-primary/5"
													: "border-border hover:border-primary/50"
											}`}
										>
											<div className="text-xs font-semibold">
												{PLAN_LABELS[p]}
											</div>
											<div className="text-xs text-muted-foreground">
												{PLAN_PRICES[p]}
											</div>
											<div className="text-[10px] text-muted-foreground mt-1">
												{Number.isFinite(PLAN_LIMITS[p].bots)
													? `${PLAN_LIMITS[p].bots} bots`
													: "Bots ilimitados"}
											</div>
										</button>
									))}
								</div>
							</div>

							<Button
								type="submit"
								className="w-full"
								disabled={submitting || slugStatus !== "available"}
							>
								{submitting ? "Criando..." : "Criar conta"}
							</Button>

							<p className="text-sm text-muted-foreground text-center">
								Já tem conta?{" "}
								<Link to="/login" className="text-primary underline">
									Entrar
								</Link>
							</p>
						</form>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
