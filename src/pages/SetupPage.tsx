"use client";

// Página pública de configuração inicial do Supabase.
// Acessível SEM login — resolve o catch-22 onde /workspace/configs
// exigia auth, mas auth exigia Supabase configurado.

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Database, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "../components/ui/card";
import { useToast } from "../hooks/use-toast";
import {
	getSupabaseConfig,
	saveSupabaseConfig,
	clearSupabaseConfig,
} from "../lib/supabaseClient";

export default function SetupPage() {
	const navigate = useNavigate();
	const { toast } = useToast();
	const [url, setUrl] = useState("");
	const [anonKey, setAnonKey] = useState("");
	const [connected, setConnected] = useState(false);

	useEffect(() => {
		const cfg = getSupabaseConfig();
		if (cfg) {
			setUrl(cfg.url);
			setAnonKey(cfg.anonKey);
			setConnected(true);
		}
	}, []);

	function handleSave() {
		if (!url.trim() || !anonKey.trim()) {
			toast({ title: "Preencha URL e Anon Key", variant: "destructive" });
			return;
		}
		try {
			new URL(url.trim());
		} catch {
			toast({
				title: "URL inválida",
				description: "Ex.: https://xxxx.supabase.co",
				variant: "destructive",
			});
			return;
		}
		saveSupabaseConfig({ url: url.trim(), anonKey: anonKey.trim() });
		setConnected(true);
		toast({
			title: "Supabase conectado!",
			description: "Agora você pode criar sua conta.",
		});
		setTimeout(() => {
			window.location.href = "/signup";
		}, 600);
	}

	function handleDisconnect() {
		clearSupabaseConfig();
		setUrl("");
		setAnonKey("");
		setConnected(false);
	}

	return (
		<div className="min-h-svh flex items-center justify-center p-6 bg-gradient-to-br from-background to-muted">
			<Card className="max-w-xl w-full">
				<CardHeader>
					<div className="flex items-center gap-3 mb-2">
						<div className="p-2 rounded-xl bg-emerald-100">
							<Database className="w-5 h-5 text-emerald-600" />
						</div>
						<CardTitle>Configurar TalkMap</CardTitle>
					</div>
					<CardDescription>
						Conecte seu projeto Supabase para habilitar login, cadastro e
						armazenamento dos seus chatbots. Leva 2 minutos.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-5">
					<ol className="text-sm space-y-1.5 text-muted-foreground list-decimal list-inside">
						<li>
							Crie um projeto grátis em{" "}
							<a
								href="https://supabase.com/dashboard"
								target="_blank"
								rel="noreferrer"
								className="text-primary underline"
							>
								supabase.com
							</a>
						</li>
						<li>
							Vá em <strong>Project Settings → API</strong> e copie{" "}
							<strong>Project URL</strong> + <strong>anon public key</strong>
						</li>
						<li>Cole abaixo e clique em Conectar</li>
						<li>
							Abra o <strong>SQL Editor</strong> do Supabase, cole o
							conteúdo de <code>docs/supabase-setup.sql</code> e rode
						</li>
					</ol>

					<div className="space-y-3 pt-2 border-t">
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="sb-url">Project URL</Label>
							<Input
								id="sb-url"
								placeholder="https://xxxxxxxx.supabase.co"
								value={url}
								onChange={(e) => setUrl(e.target.value)}
							/>
						</div>
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="sb-key">Anon / Public Key</Label>
							<Input
								id="sb-key"
								type="password"
								placeholder="eyJhbGciOi..."
								value={anonKey}
								onChange={(e) => setAnonKey(e.target.value)}
							/>
							<span className="text-xs text-muted-foreground">
								Use a chave <strong>anon/public</strong> — nunca a
								service_role.
							</span>
						</div>

						{connected && (
							<div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 p-3 rounded-md">
								<CheckCircle2 className="w-4 h-4" />
								Conectado. Você já pode prosseguir.
							</div>
						)}

						<div className="flex flex-col sm:flex-row gap-2">
							<Button onClick={handleSave} className="flex-1">
								{connected ? "Atualizar conexão" : "Conectar Supabase"}
							</Button>
							{connected && (
								<>
									<Button
										variant="outline"
										onClick={() => navigate("/signup")}
									>
										Ir para cadastro <ArrowRight className="w-4 h-4 ml-1" />
									</Button>
									<Button variant="ghost" onClick={handleDisconnect}>
										Desconectar
									</Button>
								</>
							)}
						</div>

						<p className="text-xs text-muted-foreground text-center pt-2">
							<Link to="/" className="underline">
								← Voltar pra home
							</Link>
						</p>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
