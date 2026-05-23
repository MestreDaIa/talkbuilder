"use client";

import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
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

const schema = z.object({
	email: z.string().trim().email("Email inválido").max(255),
	password: z.string().min(6, "Senha deve ter ao menos 6 caracteres").max(72),
});

export default function LoginPage() {
	const location = useLocation();
	const navigate = useNavigate();
	const { toast } = useToast();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [submitting, setSubmitting] = useState(false);

	// Se vier de uma rota protegida (ProtectedRoute setou state.from), volta pra ela.
	// Caso contrário, manda pra "/" e o HomeRoute redireciona pro workspace do slug.
	const query = new URLSearchParams(location.search);
	const redirectTo =
		query.get("redirect") || (location.state as { from?: string } | null)?.from || "/";
	const isInviteAuth = redirectTo.startsWith("/invite/");

	if (isInviteAuth) {
		return <Navigate to={redirectTo} replace />;
	}

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		console.log("[Login] Botão clicado");
		
		const parsed = schema.safeParse({ email, password });
		if (!parsed.success) {
			console.log("[Login] Erro de validação:", parsed.error.issues);
			toast({
				title: "Confira os campos",
				description: parsed.error.issues[0].message,
				variant: "destructive",
			});
			return;
		}

		setSubmitting(true);
		try {
			const supabase = getSupabase();
			if (!supabase) {
				console.error("[Login] Supabase não inicializado");
				setSubmitting(false);
				toast({
					title: "Supabase não configurado",
					description: "Não foi possível conectar ao banco do projeto.",
					variant: "destructive",
				});
				return;
			}

			console.log("[Login] Tentando auth com:", parsed.data.email);
			const { data, error } = await supabase.auth.signInWithPassword({
				email: parsed.data.email,
				password: parsed.data.password,
			});

			if (error) {
				console.error("[Login] Erro no Supabase Auth:", error);
				setSubmitting(false);
				toast({
					title: "Falha ao entrar",
					description: error.message,
					variant: "destructive",
				});
				return;
			}

			console.log("[Login] Auth sucesso, user ID:", data.user?.id);

			// Busca slug do profile pra montar a URL do workspace
			let target = redirectTo;
			if (target === "/" && data.user) {
				const { data: prof, error: profileError } = await supabase
					.from("profiles")
					.select("slug")
					.eq("id", data.user.id)
					.maybeSingle();
				
				if (profileError) {
					console.error("[Login] Falha ao carregar profile:", profileError);
				}
				
				if (prof?.slug) {
					target = `/${prof.slug}/workspace`;
				}
			}

			console.log("[Login] Redirecionando para:", target);
			toast({ title: "Bem-vindo de volta!" });
			navigate(target, { replace: true });
		} catch (err: any) {
			console.error("[Login] Erro inesperado:", err);
			toast({
				title: "Erro inesperado",
				description: err.message || "Ocorreu um erro ao tentar entrar.",
				variant: "destructive",
			});
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<div className="min-h-svh flex items-center justify-center p-6 bg-gradient-to-br from-background to-muted">
			<Card className="max-w-md w-full">
				<CardHeader>
					<CardTitle className="flex items-center gap-2">Entrar no <img src={(new URL("../../assets/logo-wordmark.svg", import.meta.url)).href} alt="ZailomFlow" className="h-5 w-auto inline-block" /></CardTitle>
					<CardDescription>
						Use seu email e senha pra acessar sua conta.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form 
						onSubmit={(e) => {
							console.log("[Login] onSubmit disparado");
							handleSubmit(e);
						}} 
						className="space-y-4"
					>
						<div>
							<Label htmlFor="email">Email</Label>
							<Input
								id="email"
								type="email"
								placeholder="voce@empresa.com"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								required
								autoFocus
								autoComplete="email"
							/>
						</div>
						<div>
							<Label htmlFor="password">Senha</Label>
							<Input
								id="password"
								type="password"
								placeholder="••••••••"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
								autoComplete="current-password"
							/>
						</div>
						<Button 
							type="submit" 
							className="w-full" 
							disabled={submitting}
							onClick={() => console.log("[Login] Button onClick")}
						>
							{submitting ? "Entrando..." : "Entrar"}
						</Button>
						<p className="text-sm text-muted-foreground text-center">
							Ainda não tem conta?{" "}
							<Link to={`/signup${location.search}`} className="text-primary underline">
								Criar agora
							</Link>
						</p>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
