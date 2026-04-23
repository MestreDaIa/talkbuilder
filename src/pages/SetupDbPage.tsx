"use client";

// Página pública de checklist para rodar o SQL de setup no Supabase.
// Acessível em /setup-db — não exige login (usa o System DB via env).

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
	CheckCircle2,
	XCircle,
	Loader2,
	ExternalLink,
	Copy,
	Check,
	Database,
	RefreshCw,
} from "lucide-react";
import { Button } from "../components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "../components/ui/card";
import { useToast } from "../hooks/use-toast";
import { getSupabase, isSupabaseConfigured } from "../lib/supabaseClient";

// Embute o SQL no bundle pra exibir/copiar sem precisar de fetch
import setupSqlRaw from "../../docs/supabase-setup.sql?raw";

type CheckStatus = "idle" | "running" | "ok" | "fail";

interface CheckResult {
	id: string;
	label: string;
	status: CheckStatus;
	detail?: string;
}

const INITIAL_CHECKS: Omit<CheckResult, "status">[] = [
	{ id: "env", label: "Credenciais do Supabase carregadas (.env.local)" },
	{ id: "profiles", label: "Tabela public.profiles existe e é consultável" },
	{ id: "rls", label: "RLS de profiles permite leitura pública (select)" },
	{
		id: "rpc",
		label: "Função is_slug_available(text) existe e responde",
	},
];

export default function SetupDbPage() {
	const { toast } = useToast();
	const [copied, setCopied] = useState(false);
	const [checks, setChecks] = useState<CheckResult[]>(
		INITIAL_CHECKS.map((c) => ({ ...c, status: "idle" })),
	);
	const [running, setRunning] = useState(false);

	const projectRef = useMemo(() => {
		const url = import.meta.env.VITE_TALKMAP_SUPABASE_URL;
		if (!url) return null;
		try {
			const host = new URL(url).hostname; // xxxx.supabase.co
			return host.split(".")[0];
		} catch {
			return null;
		}
	}, []);

	const sqlEditorUrl = projectRef
		? `https://supabase.com/dashboard/project/${projectRef}/sql/new`
		: "https://supabase.com/dashboard";

	const allOk =
		checks.length > 0 && checks.every((c) => c.status === "ok");

	useEffect(() => {
		// roda automaticamente uma vez ao abrir
		void runChecks();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	function patchCheck(id: string, patch: Partial<CheckResult>) {
		setChecks((prev) =>
			prev.map((c) => (c.id === id ? { ...c, ...patch } : c)),
		);
	}

	async function runChecks() {
		if (running) return;
		setRunning(true);
		setChecks(INITIAL_CHECKS.map((c) => ({ ...c, status: "running" })));

		// 1) env
		if (!isSupabaseConfigured()) {
			patchCheck("env", {
				status: "fail",
				detail:
					"VITE_TALKMAP_SUPABASE_URL ou VITE_TALKMAP_SUPABASE_ANON_KEY ausentes no build.",
			});
			["profiles", "rls", "rpc"].forEach((id) =>
				patchCheck(id, {
					status: "fail",
					detail: "Sem credenciais — não dá pra testar.",
				}),
			);
			setRunning(false);
			return;
		}
		patchCheck("env", { status: "ok" });

		const sb = getSupabase();
		if (!sb) {
			patchCheck("profiles", {
				status: "fail",
				detail: "Falha ao instanciar o cliente Supabase.",
			});
			setRunning(false);
			return;
		}

		// 2) profiles existe (count com head:true não traz dados)
		try {
			const { error } = await sb
				.from("profiles")
				.select("id", { count: "exact", head: true });
			if (error) {
				patchCheck("profiles", {
					status: "fail",
					detail: `${error.code ?? ""} ${error.message}`.trim(),
				});
			} else {
				patchCheck("profiles", { status: "ok" });
			}
		} catch (err) {
			patchCheck("profiles", {
				status: "fail",
				detail: err instanceof Error ? err.message : String(err),
			});
		}

		// 3) RLS permite SELECT pra anon
		try {
			const { error } = await sb.from("profiles").select("id").limit(1);
			if (error) {
				patchCheck("rls", {
					status: "fail",
					detail:
						error.message +
						" — confira a policy profiles_select_public.",
				});
			} else {
				patchCheck("rls", { status: "ok" });
			}
		} catch (err) {
			patchCheck("rls", {
				status: "fail",
				detail: err instanceof Error ? err.message : String(err),
			});
		}

		// 4) RPC is_slug_available
		try {
			const probe = `__check_${Math.random().toString(36).slice(2, 8)}`;
			const { data, error } = await sb.rpc("is_slug_available", {
				p_slug: probe,
			});
			if (error) {
				patchCheck("rpc", {
					status: "fail",
					detail: `${error.code ?? ""} ${error.message}`.trim(),
				});
			} else if (data !== true) {
				patchCheck("rpc", {
					status: "fail",
					detail: `Esperava true para slug aleatório, recebi ${JSON.stringify(data)}.`,
				});
			} else {
				patchCheck("rpc", { status: "ok" });
			}
		} catch (err) {
			patchCheck("rpc", {
				status: "fail",
				detail: err instanceof Error ? err.message : String(err),
			});
		}

		setRunning(false);
	}

	async function copySql() {
		try {
			await navigator.clipboard.writeText(setupSqlRaw);
			setCopied(true);
			toast({
				title: "SQL copiado!",
				description: "Cole no SQL Editor do Supabase e rode.",
			});
			setTimeout(() => setCopied(false), 2000);
		} catch {
			toast({
				title: "Não consegui copiar",
				description: "Selecione manualmente o texto abaixo.",
				variant: "destructive",
			});
		}
	}

	return (
		<div className="min-h-svh bg-gradient-to-br from-background to-muted py-10 px-4">
			<div className="max-w-3xl mx-auto space-y-6">
				<header className="flex items-center gap-3">
					<div className="p-2 rounded-xl bg-emerald-100">
						<Database className="w-5 h-5 text-emerald-600" />
					</div>
					<div>
						<h1 className="text-2xl font-bold">
							Checklist — Setup do banco TalkMap
						</h1>
						<p className="text-sm text-muted-foreground">
							Rode o SQL no seu Supabase e verifique aqui se a tabela{" "}
							<code>profiles</code> e os triggers ficaram OK.
						</p>
					</div>
				</header>

				{/* Passo 1 — copiar SQL */}
				<Card>
					<CardHeader>
						<CardTitle className="text-base">
							1. Copie o SQL de setup
						</CardTitle>
						<CardDescription>
							Conteúdo de <code>docs/supabase-setup.sql</code>. Cria o
							enum <code>plan_id</code>, a tabela <code>profiles</code>,
							as policies de RLS, o trigger{" "}
							<code>on_auth_user_created</code> e a função{" "}
							<code>is_slug_available</code>.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3">
						<div className="flex gap-2">
							<Button onClick={copySql} className="gap-2">
								{copied ? (
									<>
										<Check className="w-4 h-4" /> Copiado
									</>
								) : (
									<>
										<Copy className="w-4 h-4" /> Copiar SQL
									</>
								)}
							</Button>
						</div>
						<pre className="text-xs bg-muted p-3 rounded-md max-h-64 overflow-auto whitespace-pre-wrap break-words">
							{setupSqlRaw}
						</pre>
					</CardContent>
				</Card>

				{/* Passo 2 — abrir SQL editor */}
				<Card>
					<CardHeader>
						<CardTitle className="text-base">
							2. Abra o SQL Editor do Supabase
						</CardTitle>
						<CardDescription>
							{projectRef ? (
								<>
									Detectei seu projeto:{" "}
									<code className="font-mono">{projectRef}</code>. Vou
									abrir direto o SQL Editor dele.
								</>
							) : (
								<>
									Não consegui detectar o projeto pelas envs. Vou abrir o
									dashboard geral.
								</>
							)}
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button asChild variant="outline" className="gap-2">
							<a
								href={sqlEditorUrl}
								target="_blank"
								rel="noreferrer"
							>
								Abrir SQL Editor <ExternalLink className="w-4 h-4" />
							</a>
						</Button>
						<p className="text-xs text-muted-foreground mt-2">
							Cole o SQL, clique em <strong>Run</strong>, espere o
							"Success. No rows returned" — depois volte aqui.
						</p>
					</CardContent>
				</Card>

				{/* Passo 3 — verificar */}
				<Card>
					<CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
						<div>
							<CardTitle className="text-base">
								3. Verificar instalação
							</CardTitle>
							<CardDescription>
								Roda 4 checks contra o seu Supabase pra confirmar que
								tudo subiu certo.
							</CardDescription>
						</div>
						<Button
							size="sm"
							variant="outline"
							onClick={runChecks}
							disabled={running}
							className="gap-2 shrink-0"
						>
							{running ? (
								<Loader2 className="w-4 h-4 animate-spin" />
							) : (
								<RefreshCw className="w-4 h-4" />
							)}
							Verificar de novo
						</Button>
					</CardHeader>
					<CardContent className="space-y-2">
						{checks.map((c) => (
							<div
								key={c.id}
								className="flex items-start gap-3 p-3 rounded-md border bg-card"
							>
								<StatusIcon status={c.status} />
								<div className="flex-1 min-w-0">
									<p className="text-sm font-medium">{c.label}</p>
									{c.detail && (
										<p className="text-xs text-muted-foreground mt-0.5 break-words">
											{c.detail}
										</p>
									)}
								</div>
							</div>
						))}

						{allOk && (
							<div className="flex items-center justify-between gap-3 p-4 rounded-md bg-emerald-50 border border-emerald-200 mt-3">
								<div className="flex items-center gap-2 text-emerald-700">
									<CheckCircle2 className="w-5 h-5" />
									<span className="font-medium text-sm">
										Tudo certo! Banco pronto pra uso.
									</span>
								</div>
								<Button asChild size="sm">
									<Link to="/signup">Criar conta</Link>
								</Button>
							</div>
						)}
					</CardContent>
				</Card>

				<p className="text-xs text-muted-foreground text-center">
					<Link to="/" className="underline">
						← Voltar pra home
					</Link>
				</p>
			</div>
		</div>
	);
}

function StatusIcon({ status }: { status: CheckStatus }) {
	if (status === "ok")
		return (
			<CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
		);
	if (status === "fail")
		return <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />;
	if (status === "running")
		return (
			<Loader2 className="w-5 h-5 text-muted-foreground animate-spin shrink-0 mt-0.5" />
		);
	return (
		<div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 shrink-0 mt-0.5" />
	);
}
