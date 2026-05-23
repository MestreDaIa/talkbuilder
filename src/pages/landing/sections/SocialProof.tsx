import { Star } from "lucide-react";
import { useGsapContext, gsap } from "../../../hooks/useGsap";

const testimonials = [
	{
		name: "Marina Costa",
		role: "Founder · Loja Bem-me-quer",
		initials: "MC",
		color: "#920027",
		text: "Em uma tarde montei um bot de qualificação que substituiu um formulário de 8 campos. Conversão dobrou.",
	},
	{
		name: "Rafael Tavares",
		role: "Marketing · AgênciaFlux",
		initials: "RT",
		color: "#460863",
		text: "Saímos de planilhas pra fluxos automatizados pra todos os clientes. O editor é o mais intuitivo que testei.",
	},
	{
		name: "Você?",
		role: "Próximo case de sucesso",
		initials: "+",
		color: "#1E0828",
		text: "Tem espaço aqui pra sua história. Comece agora mesmo e descubra o poder do ZailomFLow.",
	},
];

export default function SocialProof() {
	const ref = useGsapContext<HTMLDivElement>(() => {
		gsap.from("[data-testimonial]", {
			y: 40,
			opacity: 0,
			stagger: 0.12,
			duration: 0.7,
			ease: "power3.out",
			scrollTrigger: {
				trigger: ref.current,
				start: "top 75%",
			},
		});
	}, []);

	return (
		<section ref={ref} className="relative py-28">
			<div className="max-w-6xl mx-auto px-6">
				<div className="text-center mb-14">
					<p className="text-xs uppercase tracking-[0.2em] text-[#920027] mb-4 font-medium">
						Quem já usa
					</p>
					<h2 className="font-display text-4xl sm:text-5xl font-bold tracking-tight">
						Times pequenos. <span className="text-gradient-violet">Resultados grandes.</span>
					</h2>
				</div>

				<div className="grid md:grid-cols-3 gap-5">
					{testimonials.map((t) => (
						<div
							key={t.name}
							data-testimonial
							className="bento-card p-7 flex flex-col"
						>
							<div className="flex gap-0.5 mb-4">
								{Array.from({ length: 5 }).map((_, i) => (
									<Star
										key={i}
										className="w-4 h-4 fill-[#920027] text-[#920027]"
									/>
								))}
							</div>
							<p className="text-foreground/90 leading-relaxed mb-6 flex-1">
								"{t.text}"
							</p>
							<div className="flex items-center gap-3 pt-4 border-t border-white/5">
								<div
									className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-white text-sm"
									style={{ background: t.color }}
								>
									{t.initials}
								</div>
								<div>
									<div className="text-sm font-medium">{t.name}</div>
									<div className="text-xs text-muted-foreground">
										{t.role}
									</div>
								</div>
							</div>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
