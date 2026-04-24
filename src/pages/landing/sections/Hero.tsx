import { Link } from "react-router-dom";
import { Button } from "../../../components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import { useGsapContext, gsap } from "../../../hooks/useGsap";
import EditorMockup from "./EditorMockup";

export default function Hero() {
	const ref = useGsapContext<HTMLDivElement>(() => {
		const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
		tl.from("[data-hero-badge]", { y: -20, opacity: 0, duration: 0.6 })
			.from(
				"[data-hero-word]",
				{ y: 40, opacity: 0, duration: 0.8, stagger: 0.08 },
				"-=0.3",
			)
			.from("[data-hero-sub]", { y: 20, opacity: 0, duration: 0.6 }, "-=0.4")
			.from(
				"[data-hero-cta]",
				{ y: 20, opacity: 0, duration: 0.5, stagger: 0.1 },
				"-=0.3",
			)
			.from("[data-hero-meta]", { opacity: 0, duration: 0.5 }, "-=0.2")
			.from(
				"[data-hero-mockup]",
				{ y: 60, opacity: 0, scale: 0.95, duration: 1, ease: "power4.out" },
				"-=0.6",
			);

		// Floating blobs parallax
		gsap.to("[data-hero-blob-1]", {
			y: -40,
			scrollTrigger: {
				trigger: ref.current,
				start: "top top",
				end: "bottom top",
				scrub: 1,
			},
		});
		gsap.to("[data-hero-blob-2]", {
			y: 60,
			scrollTrigger: {
				trigger: ref.current,
				start: "top top",
				end: "bottom top",
				scrub: 1,
			},
		});
	}, []);

	const headline = ["Construa", "chatbots", "que", "vendem", "por", "você."];

	return (
		<section
			ref={ref}
			className="relative pt-32 pb-20 overflow-hidden landing-grain"
		>
			<div className="absolute inset-0 landing-grid pointer-events-none" />
			<div
				data-hero-blob-1
				className="landing-blob w-[500px] h-[500px] -top-20 -left-32 bg-[oklch(0.55_0.25_295)]"
			/>
			<div
				data-hero-blob-2
				className="landing-blob w-[400px] h-[400px] top-40 -right-20 bg-[oklch(0.55_0.22_350)]"
			/>

			<div className="relative max-w-6xl mx-auto px-6 text-center">
				<div
					data-hero-badge
					className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur text-xs font-medium text-foreground/80 mb-8"
				>
					<Sparkles className="w-3.5 h-3.5 text-[oklch(0.78_0.18_295)]" />
					Editor visual de chatbots — sem código
				</div>

				<h1 className="font-display text-5xl sm:text-7xl md:text-8xl font-bold tracking-tight leading-[0.95] mb-8">
					{headline.map((w, i) => (
						<span key={i} className="inline-block overflow-hidden align-bottom">
							<span
								data-hero-word
								className={`inline-block mr-3 ${
									w === "vendem" || w === "por"
										? "text-gradient-violet"
										: ""
								}`}
							>
								{w}
							</span>
						</span>
					))}
				</h1>

				<p
					data-hero-sub
					className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
				>
					Conecte WhatsApp, Instagram e seu site. Monte fluxos arrastando
					blocos. Publique em minutos — não em meses.
				</p>

				<div className="flex items-center justify-center gap-3 flex-wrap mb-6">
					<Link to="/signup" data-hero-cta>
						<Button
							size="lg"
							className="px-8 h-12 text-base bg-gradient-to-r from-[oklch(0.65_0.22_295)] to-[oklch(0.68_0.20_350)] hover:opacity-90 text-white border-0 shadow-[0_10px_40px_-10px_rgba(170,100,255,0.7)] group"
						>
							Começar grátis
							<ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
						</Button>
					</Link>
					<a href="#how" data-hero-cta>
						<Button
							size="lg"
							variant="outline"
							className="px-8 h-12 text-base bg-white/5 border-white/10 hover:bg-white/10 backdrop-blur"
						>
							Ver como funciona
						</Button>
					</a>
				</div>

				<p
					data-hero-meta
					className="text-xs text-muted-foreground/70"
				>
					Sem cartão de crédito · Plano grátis pra sempre
				</p>

				<div data-hero-mockup className="mt-20 relative">
					<div className="absolute -inset-x-20 -inset-y-10 bg-gradient-to-b from-transparent via-[oklch(0.65_0.22_295/0.15)] to-transparent blur-3xl" />
					<EditorMockup className="relative" />
				</div>
			</div>
		</section>
	);
}
