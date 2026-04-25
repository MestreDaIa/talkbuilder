"use client";

import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
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
	const redirectTo =
		(location.state as { from?: string } | null)?.from ?? "/";

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		const parsed = schema.safeParse({ email, password });
		if (!parsed.success) {
			toast({
				title: "Confira os campos",
				description: parsed.error.issues[0].message,
				variant: "destructive",
			});
			return;
		}

		setSubmitting(true);
		const supabase = getSupabase()!;
		const { data, error } = await supabase.auth.signInWithPassword({
			email: parsed.data.email,
			password: parsed.data.password,
		});
		setSubmitting(false);

		if (error) {
			toast({
				title: "Falha ao entrar",
				description: error.message,
				variant: "destructive",
			});
			return;
		}

		// Busca slug do profile pra montar a URL do workspace
		let target = redirectTo;
		if (target === "/" && data.user) {
			const { data: prof } = await supabase
				.from("profiles")
				.select("slug")
				.eq("id", data.user.id)
				.maybeSingle();
			if (prof?.slug) target = `/${prof.slug}/workspace`;
		}

		toast({ title: "Bem-vindo de volta!" });
		navigate(target, { replace: true });
	}

	return (
		<div className="min-h-svh flex items-center justify-center p-6 bg-gradient-to-br from-background to-muted">
			<Card className="max-w-md w-full">
				<CardHeader>
					<CardTitle>Entrar no TalkMap</CardTitle>
					<CardDescription>
						Use seu email e senha pra acessar sua conta.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit} className="space-y-4">
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
						<Button type="submit" className="w-full" disabled={submitting}>
							{submitting ? "Entrando..." : "Entrar"}
						</Button>
						<p className="text-sm text-muted-foreground text-center">
							Ainda não tem conta?{" "}
							<Link to="/signup" className="text-primary underline">
								Criar agora
							</Link>
						</p>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
