import {
	Workflow,
	MessageSquare,
	Variable,
	Webhook,
	LayoutTemplate,
	BarChart3,
} from "lucide-react";
import { useGsapContext, gsap } from "../../../hooks/useGsap";
import EditorMockup from "./EditorMockup";

const features = [
	{
		icon: MessageSquare,
		title: "Multi-canal",
		desc: "Um fluxo, múltiplos canais. Atende WhatsApp, Instagram e site simultaneamente.",
		span: "md:col-span-1",
	},
	{
		icon: Variable,
		title: "Variáveis dinâmicas",
		desc: "Salve respostas, calcule, personalize. Cada conversa é única.",
		span: "md:col-span-1",
	},
	{
		icon: Webhook,
		title: "Webhooks & HTTP",
		desc: "Integre com qualquer sistema externo. CRMs, planilhas, APIs próprias.",
		span: "md:col-span-1",
	},
	{
		icon: LayoutTemplate,
		title: "Templates prontos",
		desc: "Comece de modelos validados: agendamento, suporte, qualificação de lead.",
		span: "md:col-span-1",
	},
	{
		icon: BarChart3,
		title: "Analytics em tempo real",
		desc: "Acompanhe taxa de conclusão, gargalos e performance de cada nó.",
		span: "md:col-span-1",
	},
];

export default function FeaturesBento() {
	const ref = useGsapContext<HTMLDivElement>(() => {
		gsap.from("[data-feature]", {
			y: 40,
			opacity: 0,
			stagger: 0.08,
			duration: 0.7,
			ease: "power3.out",
			scrollTrigger: {
				trigger: ref.current,
				start: "top 70%",
			},
		});
	}, []);

	return (
		<section
			id="features"
			ref={ref}
			className="relative py-28 overflow-hidden"
		>
			<div className="max-w-6xl mx-auto px-6">
				<div className="text-center mb-16">
					<p className="text-xs uppercase tracking-[0.2em] text-[#920027] mb-4 font-medium">
						Recursos
					</p>
					<h2 className="font-display text-4xl sm:text-5xl font-bold tracking-tight max-w-2xl mx-auto leading-tight">
						Tudo que você precisa pra{" "}
						<span className="text-gradient-violet">automatizar</span> seu
						atendimento.
					</h2>
				</div>

				<div className="grid md:grid-cols-3 gap-4 md:gap-5">
					{/* Big card with mockup */}
					<div
						data-feature
						className="bento-card md:col-span-2 md:row-span-2 p-7 flex flex-col"
					>
						<div className="flex items-center gap-3 mb-4">
							<div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#460863] to-[#920027] flex items-center justify-center shadow-lg">
								<Workflow className="w-5 h-5 text-white" />
							</div>
							<div>
								<h3 className="font-display text-xl font-semibold">
									Editor visual drag-and-drop
								</h3>
							</div>
						</div>
						<p className="text-muted-foreground mb-6 max-w-md">
							Construa fluxos complexos arrastando blocos no canvas. Cada nó é
							uma ação: enviar mensagem, capturar input, condição, integração.
						</p>
						<div className="mt-auto -mb-4 -mr-4 rounded-tl-xl overflow-hidden border-t border-l border-white/5">
							<EditorMockup className="!aspect-[16/10]" />
						</div>
					</div>

					{features.map(({ icon: Icon, title, desc, span }) => (
						<div
							key={title}
							data-feature
							className={`bento-card p-6 ${span}`}
						>
							<div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
								<Icon className="w-5 h-5 text-[#920027]" />
							</div>
							<h3 className="font-display text-lg font-semibold mb-2">
								{title}
							</h3>
							<p className="text-sm text-muted-foreground leading-relaxed">
								{desc}
							</p>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
