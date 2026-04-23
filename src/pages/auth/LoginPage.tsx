"use client";

import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { z } from "zod";
import { getSupabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { useToast } from "../../hooks/use-toast";

const schema = z.object({
	email: z.string().trim().email("Email inválido").max(255),
});

export default function LoginPage() {
	const navigate = useNavigate();
	const location = useLocation();
	const { toast } = useToast();
	const [email, setEmail] = useState("");
	const [sent, setSent] = useState(false);
	const [submitting, setSubmitting] = useState(false);

	const redirectTo =
		(location.state as { from?: string } | null)?.from ?? "/";

	if (!isSupabaseConfigured()) {
		return (
			<div className="min-h-svh flex items-center justify-center p-6">
				<Card className="max-w-md w-full">
					<CardHeader>
						<CardTitle>Configure o Supabase primeiro</CardTitle>
						<CardDescription>
							Pra entrar, o TalkMap precisa estar conectado a um projeto
							Supabase.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button className="w-full" onClick={() => navigate("/setup")}>
							Configurar agora
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		const parsed = schema.safeParse({ email });
		if (!parsed.success) {
			toast({
				title: "Email inválido",
				description: parsed.error.issues[0].message,
				variant: "destructive",
			});
			return;
		}

		setSubmitting(true);
		const supabase = getSupabase()!;
		const { error } = await supabase.auth.signInWithOtp({
			email: parsed.data.email,
			options: {
				shouldCreateUser: false,
				emailRedirectTo: `${window.location.origin}${redirectTo}`,
			},
		});
		setSubmitting(false);

		if (error) {
			toast({
				title: "Falha ao enviar link",
				description: error.message,
				variant: "destructive",
			});
			return;
		}
		setSent(true);
	}

	return (
		<div className="min-h-svh flex items-center justify-center p-6 bg-gradient-to-br from-background to-muted">
			<Card className="max-w-md w-full">
				<CardHeader>
					<CardTitle>Entrar no TalkMap</CardTitle>
					<CardDescription>
						Vamos te mandar um link mágico por email. Sem senha.
					</CardDescription>
				</CardHeader>
				<CardContent>
					{sent ? (
						<div className="text-sm space-y-2">
							<p className="font-medium">📬 Link enviado!</p>
							<p className="text-muted-foreground">
								Confira sua caixa de entrada em <strong>{email}</strong> e
								clique no link pra entrar.
							</p>
							<Button
								variant="ghost"
								className="px-0"
								onClick={() => {
									setSent(false);
									setEmail("");
								}}
							>
								Usar outro email
							</Button>
						</div>
					) : (
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
								/>
							</div>
							<Button type="submit" className="w-full" disabled={submitting}>
								{submitting ? "Enviando..." : "Receber link mágico"}
							</Button>
							<p className="text-sm text-muted-foreground text-center">
								Ainda não tem conta?{" "}
								<Link to="/signup" className="text-primary underline">
									Criar agora
								</Link>
							</p>
						</form>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
