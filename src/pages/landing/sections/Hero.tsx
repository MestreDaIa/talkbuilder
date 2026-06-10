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

	const headline = ["Crie fluxos.", "Automatize.", "Conecte."];

	return (
		<section
			ref={ref}
			className="relative pt-32 pb-20 overflow-hidden landing-grain"
		>
			<div className="absolute inset-0 landing-grid pointer-events-none" />
			<div
				data-hero-blob-1
				className="landing-blob w-[500px] h-[500px] -top-20 -left-32 bg-[#460863]"
			/>
			<div
				data-hero-blob-2
				className="landing-blob w-[400px] h-[400px] top-40 -right-20 bg-[#920027]"
			/>

			<div className="relative max-w-6xl mx-auto px-6 text-center">
				<div
					data-hero-badge
					className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur text-xs font-medium text-foreground/80 mb-8"
				>
					<Sparkles className="w-3.5 h-3.5 text-[#920027]" />
					Editor visual de chatbots — sem código — Zailom Flow
				</div>

				<h1 className="font-display text-5xl sm:text-7xl md:text-[5rem] lg:text-[6rem] font-bold tracking-tight leading-[1.1] mb-8 flex flex-wrap justify-center gap-x-6">
					{headline.map((w, i) => (
						<span
							key={i}
							data-hero-word
							className={`${
								i > 0 ? "text-gradient-violet" : "text-white"
							}`}
						>
							{w}
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
							className="px-8 h-12 text-base bg-[#920027] hover:bg-[#b00030] text-white border-0 shadow-[0_10px_40px_-10px_rgba(146,0,39,0.7)] group"
						>
							Comece agora
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

				<div
					data-hero-meta
					className="flex items-center justify-center gap-4 sm:gap-8 text-[10px] sm:text-xs font-semibold tracking-widest text-white/70"
				>
					<div className="flex items-center gap-2">
						<div className="w-2 h-2 bg-[#920027] rounded-[2px]" />
						CRIE FLUXOS
					</div>
					<div className="flex items-center gap-2">
						<div className="w-2 h-2 bg-[#460863] rounded-[2px]" />
						AUTOMATIZE
					</div>
					<div className="flex items-center gap-2">
						<div className="w-2 h-2 bg-white/30 rounded-[2px]" />
						CONECTE
					</div>
				</div>

				<div data-hero-mockup className="mt-20 relative">
					<div className="absolute -inset-x-20 -inset-y-10 bg-gradient-to-b from-transparent via-[#460863]/10 to-transparent blur-3xl" />
					<EditorMockup className="relative" />
				</div>
			</div>
		</section>
	);
}
