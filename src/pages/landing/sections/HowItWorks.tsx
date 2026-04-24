import { Plug, MousePointerClick, Rocket } from "lucide-react";
import { useGsapContext, gsap } from "../../../hooks/useGsap";

const steps = [
	{
		n: "01",
		icon: Plug,
		title: "Conecte seu canal",
		desc: "Escolha WhatsApp, Instagram ou widget pro site. Configuração em poucos cliques.",
	},
	{
		n: "02",
		icon: MousePointerClick,
		title: "Monte o fluxo",
		desc: "Arraste blocos no editor visual. Sem código, sem dor de cabeça.",
	},
	{
		n: "03",
		icon: Rocket,
		title: "Publique e atenda",
		desc: "Ative o bot e veja conversas chegarem. Edite ao vivo quando quiser.",
	},
];

export default function HowItWorks() {
	const ref = useGsapContext<HTMLDivElement>(() => {
		gsap.from("[data-step]", {
			y: 50,
			opacity: 0,
			stagger: 0.15,
			duration: 0.8,
			ease: "power3.out",
			scrollTrigger: {
				trigger: ref.current,
				start: "top 70%",
			},
		});
	}, []);

	return (
		<section id="how" ref={ref} className="relative py-28">
			<div className="max-w-6xl mx-auto px-6">
				<div className="text-center mb-16">
					<p className="text-xs uppercase tracking-[0.2em] text-[oklch(0.78_0.18_295)] mb-4 font-medium">
						Como funciona
					</p>
					<h2 className="font-display text-4xl sm:text-5xl font-bold tracking-tight">
						Do zero ao bot publicado em{" "}
						<span className="text-gradient-violet">3 passos</span>.
					</h2>
				</div>

				<div className="grid md:grid-cols-3 gap-6 relative">
					{/* Connection line behind */}
					<div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

					{steps.map(({ n, icon: Icon, title, desc }) => (
						<div
							key={n}
							data-step
							className="relative bento-card p-7 text-center"
						>
							<div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-[oklch(0.65_0.22_295)] to-[oklch(0.68_0.20_350)] flex items-center justify-center mb-4 shadow-[0_8px_24px_-8px_rgba(170,100,255,0.6)]">
								<Icon className="w-6 h-6 text-white" />
							</div>
							<div className="text-xs font-mono text-muted-foreground/60 mb-2">
								{n}
							</div>
							<h3 className="font-display text-xl font-semibold mb-2">
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
