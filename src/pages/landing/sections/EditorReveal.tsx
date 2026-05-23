import { useGsapContext, gsap, ScrollTrigger } from "../../../hooks/useGsap";
import EditorMockup from "./EditorMockup";

export default function EditorReveal() {
	const ref = useGsapContext<HTMLDivElement>(() => {
		const ctx = ref.current;
		if (!ctx) return;

		// Mockup grows + tilts on scroll
		gsap.fromTo(
			"[data-reveal-mockup]",
			{ scale: 0.85, rotateX: 18, opacity: 0.7 },
			{
				scale: 1,
				rotateX: 0,
				opacity: 1,
				ease: "none",
				scrollTrigger: {
					trigger: ctx,
					start: "top 80%",
					end: "center center",
					scrub: 1,
				},
			},
		);

		// Nodes appear in sequence
		gsap.from("[data-reveal-mockup] [data-node]", {
			scale: 0.7,
			opacity: 0,
			stagger: 0.2,
			ease: "back.out(1.6)",
			scrollTrigger: {
				trigger: ctx,
				start: "top 60%",
				end: "center 30%",
				scrub: 1,
			},
		});

		// Lines draw
		gsap.to("[data-reveal-mockup] [data-node-line]", {
			strokeDashoffset: 0,
			stagger: 0.15,
			ease: "none",
			scrollTrigger: {
				trigger: ctx,
				start: "top 50%",
				end: "center 30%",
				scrub: 1,
			},
		});

		ScrollTrigger.refresh();
	}, []);

	return (
		<section ref={ref} className="relative py-32 overflow-hidden">
			<div className="absolute inset-0 landing-grid opacity-50 pointer-events-none" />
			<div className="max-w-6xl mx-auto px-6 text-center mb-12 relative">
				<p className="text-xs uppercase tracking-[0.2em] text-[#920027] mb-4 font-medium">
					Veja em ação
				</p>
				<h2 className="font-display text-4xl sm:text-5xl font-bold tracking-tight max-w-3xl mx-auto leading-tight">
					Seu fluxo, <span className="text-gradient-violet">vivo no canvas</span>.
				</h2>
				<p className="text-muted-foreground mt-4 max-w-xl mx-auto">
					Cada bloco vira uma etapa real da conversa. Edite, teste, publique.
				</p>
			</div>

			<div className="max-w-6xl mx-auto px-6 [perspective:2000px]">
				<div data-reveal-mockup>
					<EditorMockup animateNodes />
				</div>
			</div>
		</section>
	);
}
