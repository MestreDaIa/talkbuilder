import { useState } from "react";
import { Plus } from "lucide-react";
import { useGsapContext, gsap } from "../../../hooks/useGsap";

const faqs = [
	{
		q: "Preciso saber programar pra usar o TalkMap?",
		a: "Não. O editor é 100% visual: você arrasta blocos e conecta. Conhecimento técnico só ajuda nas integrações avançadas (webhooks, scripts), mas não é obrigatório.",
	},
	{
		q: "Quais canais já estão funcionando?",
		a: "Hoje o widget pro seu site já roda. WhatsApp, Instagram e Telegram estão na fila — vamos liberar conforme o produto evolui.",
	},
	{
		q: "Posso testar grátis sem cartão?",
		a: "Sim. O plano Starter é grátis pra sempre, sem pedir cartão na criação da conta. Você só atualiza se quiser mais bots ou mensagens.",
	},
	{
		q: "Meus dados ficam seguros?",
		a: "Sim. Usamos infraestrutura com criptografia em trânsito e em repouso, autenticação isolada por workspace e backups automáticos.",
	},
	{
		q: "Consigo migrar fluxos do meu construtor atual?",
		a: "Temos export/import em JSON. Se você já tem fluxos em outro lugar, é possível adaptar — pra casos complexos, fala com a gente.",
	},
	{
		q: "E se eu precisar de mais mensagens que o plano oferece?",
		a: "Você pode subir de plano a qualquer momento ou contratar pacotes adicionais. Sem multa, sem fidelidade.",
	},
];

function FaqItem({ q, a, idx }: { q: string; a: string; idx: number }) {
	const [open, setOpen] = useState(false);
	return (
		<div
			data-faq
			className="bento-card overflow-hidden"
		>
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left hover:bg-white/[0.02] transition-colors"
				aria-expanded={open}
			>
				<span className="font-medium text-foreground/95">
					<span className="text-muted-foreground/60 font-mono text-xs mr-3">
						0{idx + 1}
					</span>
					{q}
				</span>
				<Plus
					className={`w-5 h-5 shrink-0 text-muted-foreground transition-transform duration-300 ${
						open ? "rotate-45" : ""
					}`}
				/>
			</button>
			<div
				className={`grid transition-all duration-300 ease-out ${
					open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
				}`}
			>
				<div className="overflow-hidden">
					<p className="px-6 pb-5 text-sm text-muted-foreground leading-relaxed">
						{a}
					</p>
				</div>
			</div>
		</div>
	);
}

export default function Faq() {
	const ref = useGsapContext<HTMLDivElement>(() => {
		gsap.from("[data-faq]", {
			y: 20,
			opacity: 0,
			stagger: 0.06,
			duration: 0.5,
			ease: "power2.out",
			scrollTrigger: {
				trigger: ref.current,
				start: "top 80%",
			},
		});
	}, []);

	return (
		<section id="faq" ref={ref} className="relative py-28">
			<div className="max-w-3xl mx-auto px-6">
				<div className="text-center mb-12">
					<p className="text-xs uppercase tracking-[0.2em] text-[oklch(0.78_0.18_295)] mb-4 font-medium">
						FAQ
					</p>
					<h2 className="font-display text-4xl sm:text-5xl font-bold tracking-tight">
						Perguntas <span className="text-gradient-violet">frequentes</span>.
					</h2>
				</div>
				<div className="space-y-3">
					{faqs.map((f, i) => (
						<FaqItem key={f.q} q={f.q} a={f.a} idx={i} />
					))}
				</div>
			</div>
		</section>
	);
}
