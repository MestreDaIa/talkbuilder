import { Globe, Instagram, MessageCircle, Send } from "lucide-react";
import { useGsapContext, gsap } from "../../../hooks/useGsap";

const channels = [
	{ icon: MessageCircle, label: "WhatsApp", soon: true, color: "#920027" },
	{ icon: Send, label: "Telegram", soon: true, color: "#460863" },
	{ icon: Instagram, label: "Instagram", soon: true, color: "#1E0828" },
	{ icon: Globe, label: "Web Widget", soon: false, color: "#920027" },
];

export default function Channels() {
	const ref = useGsapContext<HTMLDivElement>(() => {
		gsap.from("[data-channel]", {
			y: 30,
			opacity: 0,
			stagger: 0.1,
			duration: 0.6,
			ease: "power3.out",
			scrollTrigger: {
				trigger: ref.current,
				start: "top 80%",
			},
		});
	}, []);

	return (
		<section ref={ref} className="relative py-20 border-y border-white/5">
			<div className="max-w-6xl mx-auto px-6">
				<p className="text-center text-xs uppercase tracking-[0.2em] text-muted-foreground mb-10 font-medium">
					Conecte com os canais que seus clientes usam
				</p>
				<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6">
					{channels.map(({ icon: Icon, label, soon, color }) => (
						<div
							key={label}
							data-channel
							className="relative flex flex-col items-center justify-center gap-3 py-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/15 transition-colors"
						>
							{soon && (
								<span className="absolute top-2 right-2 text-[9px] uppercase tracking-wider text-muted-foreground/80 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-full">
									Em breve
								</span>
							)}
							<Icon
								className="w-7 h-7"
								style={{ color }}
							/>
							<span className="text-sm font-medium text-foreground/90">
								{label}
							</span>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
