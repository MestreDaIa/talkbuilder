import { Link } from "react-router-dom";
import { Button } from "../../../components/ui/button";
import { ArrowRight } from "lucide-react";
import { useGsapContext, gsap } from "../../../hooks/useGsap";

export default function CtaFinal() {
	const ref = useGsapContext<HTMLDivElement>(() => {
		gsap.from("[data-cta-content]", {
			y: 40,
			opacity: 0,
			duration: 0.8,
			ease: "power3.out",
			scrollTrigger: {
				trigger: ref.current,
				start: "top 75%",
			},
		});
	}, []);

	return (
		<section ref={ref} className="relative py-28">
			<div className="max-w-5xl mx-auto px-6">
				<div
					data-cta-content
					className="relative overflow-hidden rounded-3xl border border-white/10 p-10 sm:p-16 text-center bg-gradient-to-br from-[oklch(0.30_0.18_295)] via-[oklch(0.22_0.12_295)] to-[oklch(0.30_0.18_350)]"
				>
					<div className="absolute -top-20 -left-20 w-80 h-80 bg-[oklch(0.65_0.22_295)] rounded-full blur-3xl opacity-40" />
					<div className="absolute -bottom-20 -right-20 w-80 h-80 bg-[oklch(0.68_0.20_350)] rounded-full blur-3xl opacity-40" />

					<div className="relative">
						<h2 className="font-display text-4xl sm:text-6xl font-bold tracking-tight leading-[1.05] mb-6">
							Pronto pra deixar de{" "}
							<span className="text-gradient-violet">responder</span>
							<br />
							e começar a <span className="text-gradient-violet">vender</span>?
						</h2>
						<p className="text-muted-foreground text-lg max-w-xl mx-auto mb-10">
							Crie sua conta agora. Em 10 minutos seu primeiro bot tá no ar.
						</p>
						<div className="flex items-center justify-center gap-3 flex-wrap">
							<Link to="/signup">
								<Button
									size="lg"
									className="px-8 h-12 text-base bg-white text-[oklch(0.20_0.10_295)] hover:bg-white/90 border-0 font-semibold group"
								>
									Começar grátis agora
									<ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
								</Button>
							</Link>
							<Link to="/login">
								<Button
									size="lg"
									variant="outline"
									className="px-8 h-12 text-base bg-white/5 border-white/20 hover:bg-white/10 backdrop-blur"
								>
									Já tenho conta
								</Button>
							</Link>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
