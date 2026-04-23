"use client";

import { Link } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Check, MessageSquare, Workflow, Zap } from "lucide-react";
import { PLAN_LABELS, PLAN_LIMITS, type PlanId } from "../../context/PlanContext";

const PLAN_PRICES: Record<PlanId, string> = {
	starter: "Grátis",
	pro: "R$ 49/mês",
	business: "R$ 149/mês",
};

const PLAN_FEATURES: Record<PlanId, string[]> = {
	starter: ["1 chatbot", "1.000 mensagens/mês", "Editor visual completo"],
	pro: ["3 chatbots", "10.000 mensagens/mês", "Integrações WhatsApp"],
	business: ["Bots ilimitados", "50.000 mensagens/mês", "Suporte prioritário"],
};

export default function LandingPage() {
	return (
		<div className="min-h-svh bg-gradient-to-br from-background via-background to-muted">
			{/* Hero */}
			<section className="max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
				<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-6">
					<Zap className="w-3 h-3" /> Construa chatbots sem código
				</div>
				<h1 className="text-4xl sm:text-6xl font-bold tracking-tight mb-6">
					Transforme conversas em{" "}
					<span className="text-primary">resultados</span>
				</h1>
				<p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
					TalkMap é o construtor visual de chatbots que conecta WhatsApp,
					Instagram e seu site. Arraste, conecte, publique.
				</p>
				<div className="flex items-center justify-center gap-3 flex-wrap">
					<Link to="/signup">
						<Button size="lg" className="px-8">
							Começar grátis
						</Button>
					</Link>
					<Link to="/login">
						<Button size="lg" variant="outline" className="px-8">
							Já tenho conta
						</Button>
					</Link>
				</div>
			</section>

			{/* Features */}
			<section className="max-w-5xl mx-auto px-6 py-16 grid sm:grid-cols-3 gap-6">
				<Card>
					<CardHeader>
						<Workflow className="w-8 h-8 text-primary mb-2" />
						<CardTitle className="text-lg">Editor visual</CardTitle>
					</CardHeader>
					<CardContent className="text-sm text-muted-foreground">
						Monte fluxos arrastando blocos. Sem código, sem dor de cabeça.
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<MessageSquare className="w-8 h-8 text-primary mb-2" />
						<CardTitle className="text-lg">Multi-canal</CardTitle>
					</CardHeader>
					<CardContent className="text-sm text-muted-foreground">
						WhatsApp, Instagram, Telegram e widget pro seu site.
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<Zap className="w-8 h-8 text-primary mb-2" />
						<CardTitle className="text-lg">Integra com tudo</CardTitle>
					</CardHeader>
					<CardContent className="text-sm text-muted-foreground">
						Webhooks, HTTP requests e variáveis dinâmicas no fluxo.
					</CardContent>
				</Card>
			</section>

			{/* Pricing */}
			<section className="max-w-5xl mx-auto px-6 py-16">
				<h2 className="text-3xl font-bold text-center mb-3">
					Escolha seu plano
				</h2>
				<p className="text-muted-foreground text-center mb-10">
					Comece grátis. Atualize quando precisar de mais.
				</p>
				<div className="grid sm:grid-cols-3 gap-6">
					{(["starter", "pro", "business"] as PlanId[]).map((p) => (
						<Card key={p} className={p === "pro" ? "border-primary shadow-lg" : ""}>
							<CardHeader>
								<CardTitle>{PLAN_LABELS[p]}</CardTitle>
								<div className="text-3xl font-bold mt-2">
									{PLAN_PRICES[p]}
								</div>
							</CardHeader>
							<CardContent>
								<ul className="space-y-2 text-sm mb-6">
									{PLAN_FEATURES[p].map((f) => (
										<li key={f} className="flex items-start gap-2">
											<Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
											<span>{f}</span>
										</li>
									))}
								</ul>
								<Link to={`/signup?plan=${p}`}>
									<Button
										className="w-full"
										variant={p === "pro" ? "default" : "outline"}
									>
										Escolher {PLAN_LABELS[p]}
									</Button>
								</Link>
							</CardContent>
						</Card>
					))}
				</div>
			</section>

			<footer className="text-center text-xs text-muted-foreground py-8">
				© {new Date().getFullYear()} TalkMap
			</footer>
		</div>
	);
}
